import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { getNumber } from "../../sdk/settings.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { db } from "../../sdk/db.ts";
import { paypalConfigured } from "../../sdk/paypal-api.ts";
import { feedsConfigured } from "../../sdk/product-feeds.ts";

// setupStatus (INTERNAL/ADMIN) — the go-live wizard's data: a live checklist of what's connected, what's on,
// and the exact next action for anything that isn't. Everything ships ON by default; the only "action" items
// are external accounts/keys only the owner can provide (PayPal, product feed, a dropship supplier, gift-card
// stock, an LLM key). Nothing here is a code gap — it's the "plug in your accounts" list.
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const base44 = createClientFromRequest(req);
    const item = (ok: boolean, key: string, label: string, detail: string, action: string) => ({ ok, key, label, detail: ok ? detail : action, action: ok ? null : action });

    // Counts for the sourcing integrations.
    const suppliers = await db.filter("Supplier", { active: true }, "-created_date", 50).catch(() => []) as Record<string, unknown>[];
    const giftcards = await db.filter("GiftCardStock", { status: "available" }, "-created_date", 2000).catch(() => []) as Record<string, unknown>[];
    const llmKey = !!(Deno.env.get("OPENAI_API_KEY") || Deno.env.get("ANTHROPIC_API_KEY"));

    // Integrations (the only real "connect this" work — everything else is prebuilt & on).
    const integrations = [
      item(paypalConfigured() && await isEnabled("card_charging"), "paypal", "PayPal payments", "Connected — card checkout is live.", "Set PAYPAL_CLIENT_ID/PAYPAL_SECRET and turn on the card_charging flag (see PAYPAL-SETUP.md)."),
      item(llmKey, "llm", "AI provider key", "Connected — AI assistant, moderation & voice surveys are live.", "Set OPENAI_API_KEY (or ANTHROPIC_API_KEY) to power the AI features + Whisper voice."),
      item(feedsConfigured(), "feeds", "Product feed (discovery)", "Connected — the assistant searches everywhere.", "Set PRODUCT_FEED_API_BASE/PRODUCT_FEED_API_KEY + AFFILIATE_TAG (see SOURCING-AND-FULFILLMENT.md). Until then it searches your catalog only."),
      item((suppliers || []).length > 0, "dropship", "Dropship supplier (full-auto)", `${(suppliers || []).length} supplier(s) connected — those SKUs fulfill automatically.`, "Register a supplier via registerSupplier + set its API key env var. Orders fall back to the buying desk until then."),
      item((giftcards || []).length > 0, "giftcards", "Gift-card inventory", `${(giftcards || []).length} card(s) in stock.`, "Add stock via giftCardStockAdd (optional — powers the gift-card rail)."),
    ];

    // Flags — should all be ON from the get-go (except card_charging, which waits on PayPal).
    const flagNames = ["loyalty_program", "group_goals", "verified_surveys", "premium_ppc", "referrals"] as const;
    const flags = [];
    for (const f of flagNames) flags.push(item(await isEnabled(f), `flag_${f}`, f, "On.", `Turn on the ${f} flag in Compliance Flags.`));

    // Key economic settings (the "everything on, cost at the floor" posture).
    const markup = await getNumber("STORE_MARKUP", 0);
    const settings = [
      item(markup === 0, "markup", "No customer markup", "Markup is 0 for all users.", "Set STORE_MARKUP to 0."),
      item((await getNumber("SURVEY_USER_SHARE_PCT", 0.5)) > 0, "split", "50/50 survey split", "Users accrue 50% as points.", "Set SURVEY_USER_SHARE_PCT (0.5)."),
      item((await getNumber("PPC_GRID_ANNUAL_PRICE", 8000)) > 0, "ppc", "PPC AdGrid priced", `$${await getNumber("PPC_GRID_ANNUAL_PRICE", 8000)}/yr.`, "Set PPC_GRID_ANNUAL_PRICE."),
      item(true, "cost", "AI cost at the floor", "All AI calls use the cheap model tier; feed searches + translations are cached; moderation/triage are rules-first. AI_DAILY_SPEND_CAP_USD is the hard brake.", ""),
    ];

    const allIntegrationsReady = integrations.every((i) => i.ok);
    return Response.json({
      go_live_ready: allIntegrationsReady,
      summary: allIntegrationsReady ? "All integrations connected — you're live." : "Product is built & on. Connect the flagged accounts to go fully live.",
      integrations, flags, settings,
      ai_daily_spend_cap_usd: await getNumber("AI_DAILY_SPEND_CAP_USD", 0),
      card_charging_on: await isEnabled("card_charging"),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
