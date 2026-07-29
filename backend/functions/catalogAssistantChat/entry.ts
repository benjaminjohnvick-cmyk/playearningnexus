import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { kycStatus, kycProfileText } from "../../sdk/kyc.ts";
import { compileProfile } from "../../sdk/user-profile.ts";
import { buildSiteContext } from "../../sdk/site-model.ts";
import { Core } from "../../sdk/integrations.ts";
import { db } from "../../sdk/db.ts";
import { emitEvent } from "../../sdk/events.ts";
import { memoryContext, hasMemory, recordTurn, learnFromConversation, shouldLearn } from "../../sdk/assistant-memory.ts";

// catalogAssistantChat (authenticated) — the AI shopping assistant that greets a member the FIRST time
// they open the marketplace catalog. It opens by asking what they're interested in, but it is already
// grounded in their KYC survey answers, so the question is warm and specific rather than cold. Powers
// the ongoing back-and-forth too. Grounded in: KYC answers + compiled user profile + the evolving site
// model + a few real catalog listings that match the user's stated interests.
//
// Body:
//   { action: "greet" }                       → opening message + suggested interest chips
//   { message, history?: [{role,content}] }    → a chat turn

const KYC_TO_CATALOG: Record<string, string[]> = {
  "Electronics": ["Electronics", "Headphones", "Cameras & Photo", "Wearable Technology"],
  "Computers & Gaming": ["Computers & Tablets", "PC Gaming", "Video Games", "Gaming Accessories", "Laptops"],
  "Home & Kitchen": ["Home & Kitchen", "Kitchen & Dining", "Furniture", "Home Décor"],
  "Beauty & Personal Care": ["Beauty & Personal Care", "Skin Care", "Makeup", "Hair Care"],
  "Health & Wellness": ["Health & Household", "Vitamins & Supplements", "Sports Nutrition"],
  "Clothing & Shoes": ["Women's Clothing", "Men's Clothing", "Women's Shoes", "Men's Shoes"],
  "Toys & Games": ["Toys & Games", "Board Games", "Building Toys"],
  "Sports & Outdoors": ["Sports & Outdoors", "Exercise & Fitness", "Camping & Hiking"],
  "Automotive": ["Automotive", "Car Electronics", "Car Care"],
  "Pet Supplies": ["Pet Supplies", "Dog Supplies", "Cat Supplies"],
  "Books & Media": ["Books", "Movies & TV", "Music CDs & Vinyl"],
  "Grocery & Gourmet": ["Grocery & Gourmet Food", "Coffee Tea & Cocoa", "Snack Foods"],
  "Baby & Kids": ["Baby", "Baby Toys", "Kids' Shoes"],
  "Tools & Home Improvement": ["Tools & Home Improvement", "Power Tools", "Hand Tools"],
  "Office & School": ["Office Products", "School Supplies", "Office Supplies"],
  "Musical Instruments": ["Musical Instruments", "Guitars", "Keyboards & Pianos"],
};

async function sampleListingsForInterests(interests: string[], country: string, limit = 8): Promise<any[]> {
  const cats = new Set<string>();
  for (const i of interests) for (const c of (KYC_TO_CATALOG[i] || [i])) cats.add(c);
  const out: any[] = [];
  const seen = new Set<string>();
  for (const cat of cats) {
    if (out.length >= limit) break;
    const rows = await db.filter(
      "MarketplaceListing",
      { seller_id: "platform_catalog", status: "active", category: cat, country },
      "-created_date",
      3,
    ).catch(() => []) as any[];
    for (const r of rows) {
      if (out.length >= limit || seen.has(r.id)) continue;
      seen.add(r.id);
      out.push({ title: r.title, category: r.category, price_usd: r.price_usd, id: r.id });
    }
  }
  return out;
}

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const raw = await req.json().catch(() => ({}));
    const action = raw?.action;
    const country = String((user as any).country || (raw?.country ?? "US")).toUpperCase();
    const status = await kycStatus(user.id).catch(() => ({ answers: null } as any));
    const kycText = kycProfileText(status.answers);
    const interests: string[] = Array.isArray((status.answers as any)?.categories) ? (status.answers as any).categories : [];

    const hasLLM = !!(Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("OPENAI_API_KEY"));

    // ---- GREET: opening line for the first catalog view ----
    if (action === "greet") {
      // Mark the first-view so the frontend/telemetry knows the greeting happened (idempotent-ish).
      base44.asServiceRole.entities.User.update(user.id, { catalog_first_view_at: (user as any).catalog_first_view_at || new Date().toISOString() }).catch(() => {});
      emitEvent("catalog.first_view", { user_id: user.id }, { source: "catalogAssistantChat" }).catch(() => {});

      const chips = interests.slice(0, 6);
      const name = ((user as any).full_name || "").split(" ")[0] || "there";
      // Remembered context from this member's past chats — so a returning member gets "welcome back"
      // grounded in what we learned last time, not a cold open.
      const [mem, returning] = await Promise.all([
        memoryContext(user.id).catch(() => ""),
        hasMemory(user.id).catch(() => false),
      ]);
      let greeting =
        returning
          ? `Welcome back, ${name}! Want to pick up where we left off, or is there something new you're after today?`
          : interests.length
            ? `Hi ${name}! Based on what you told us, I can help you find great ${interests.slice(0, 3).join(", ")} picks. What are you shopping for today?`
            : `Hi ${name}! I'm your shopping assistant. What are you interested in today — tell me a category, a product, or an occasion and I'll pull the best matches.`;

      if (hasLLM) {
        try {
          const site = await buildSiteContext().catch(() => "");
          const samples = await sampleListingsForInterests(interests, country, 6);
          const out = await Core.InvokeLLM({
            prompt:
              `You are GamerGain's friendly catalog shopping assistant greeting a member as they open the store. ` +
              `${returning ? "This is a RETURNING member — greet them like you remember them and reference what you know, then ask how you can help today." : "Greet them warmly by first name, reference their interests, and ASK what they're looking for today."} ` +
              `One or two sentences, no lists.\n\n` +
              `First name: ${name}\nTheir KYC preferences: ${kycText}\n${mem ? mem + "\n" : ""}${site}\n` +
              `${samples.length ? "A few live catalog items you can mention: " + JSON.stringify(samples) : ""}\n\nGreeting:`,
          }) as string;
          if (typeof out === "string" && out.trim()) greeting = out.trim();
        } catch { /* keep template greeting */ }
      }
      return Response.json({ greeting, suggested_interests: chips, kyc_on_file: !!status.answers, returning });
    }

    // ---- CHAT TURN ----
    if (!raw?.message || typeof raw.message !== "string") return Response.json({ error: "message required" }, { status: 400 });
    const message = raw.message.slice(0, 2000);
    const history = Array.isArray(raw.history)
      ? raw.history.slice(-8).map((m: any) => ({ role: m?.role, content: String(m?.content ?? "").slice(0, 2000) }))
      : [];

    if (!hasLLM) {
      return Response.json({ reply: "I can help you find items in the store! Tell me a category or product and I'll point you to matches. (Live AI replies turn on once an AI key is configured.)" });
    }

    const [profile, site, samples, mem] = await Promise.all([
      compileProfile(base44, user.id).catch(() => ({})),
      buildSiteContext().catch(() => ""),
      sampleListingsForInterests(interests, country, 8),
      memoryContext(user.id).catch(() => ""),   // durable, per-member memory from past chats
    ]);
    const convo = history.map((m: any) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`).join("\n");

    const replyRaw = await Core.InvokeLLM({
      prompt:
        `You are GamerGain's catalog shopping assistant. Help the member find products in OUR store, tailored to them. ` +
        `Be concise, warm, and genuinely useful; use what you REMEMBER about this member to personalize; suggest categories ` +
        `and specific items when relevant; encourage exploring and purchasing without being pushy; never make ` +
        `guaranteed-earnings claims. If nothing in the catalog fits, suggest the closest categories or the neutral product ` +
        `search. Do not invent items that aren't plausible for our catalog.\n\n` +
        `Member KYC preferences: ${kycText}\nMember profile: ${JSON.stringify(profile)}\n` +
        `${mem ? mem + "\n" : ""}${site}\n` +
        `${samples.length ? "Relevant live catalog items: " + JSON.stringify(samples) + "\n" : ""}` +
        `${convo ? "\nConversation so far:\n" + convo + "\n" : ""}\nUser: ${message}\nAssistant:`,
    }) as string;
    const reply = typeof replyRaw === "string" && replyRaw.trim() ? replyRaw : "Happy to help — what are you shopping for?";

    // Remember this exchange on the member's individual file, then periodically re-distill what we've
    // learned about them so the assistant keeps improving per user. Best-effort — never blocks the reply.
    try {
      const turnCount = await recordTurn(user.id, message, reply);
      if (shouldLearn(turnCount)) await learnFromConversation(user.id);
    } catch { /* memory is best-effort */ }

    return Response.json({ reply });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
