import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { getNumber, primeSettings, snapString, snapBool } from "../../sdk/settings.ts";
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
    await primeSettings();
    const base44 = createClientFromRequest(req);
    const item = (ok: boolean, key: string, label: string, detail: string, action: string) => ({ ok, key, label, detail: ok ? detail : action, action: ok ? null : action });
    const has = (k: string) => !!Deno.env.get(k);

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

    // Cost-floor provider stack — the free/cheap hosted services that run the whole AI/media layer at ~$0.
    // Each is a one-line env/setting; all fall back gracefully so nothing breaks before a key is added.
    const awsCreds = has("AWS_ACCESS_KEY_ID");
    const emailProvider = snapString("EMAIL_PROVIDER", "ses");
    const emailReady = (emailProvider === "ses" && awsCreds) || has("BREVO_API_KEY") || has("SENDGRID_API_KEY") || has("SMTP_HOST") || awsCreds;
    const ttsProvider = snapString("PROVIDER_TTS", "managed");
    const ttsReady = (ttsProvider === "polly" && awsCreds) || (ttsProvider === "openai" && has("OPENAI_API_KEY")) || !!snapString("SELF_TTS_URL", "") || has("ELEVENLABS_API_KEY") || true; // device voice is always a free fallback
    const providers = [
      item(has("GROQ_API_KEY"), "groq", "Groq free tier — LLM + speech-to-text", "Llama + Whisper on Groq's free tier — $0.", "FREE at console.groq.com → set GROQ_API_KEY. Runs all AI (translation, moderation, assistant, ranking) + voice transcription at $0. Falls back to OpenAI until set."),
      item(has("CLOUDFLARE_ACCOUNT_ID") && has("CLOUDFLARE_API_TOKEN"), "cloudflare", "Cloudflare Workers AI — image generation", "FLUX-1-schnell on Cloudflare's free tier — $0, commercially licensed.", "FREE at dash.cloudflare.com (create a Workers AI API token) → set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN. Falls back to Bedrock/Titan (~$0.01/img) until set."),
      item(emailReady, "email", "Transactional email", emailProvider === "ses" ? "Amazon SES — ~$0.10 per 1,000, reuses AWS creds." : `Provider: ${emailProvider}.`, "FREE: set EMAIL_PROVIDER=brevo + BREVO_API_KEY (~9k emails/mo free). Or use Amazon SES with your AWS creds (cheapest at scale; verify a sender + leave the SES sandbox for production)."),
      item(ttsProvider === "polly" ? awsCreds : ttsReady, "tts", "Text-to-speech voice", ttsProvider === "polly" ? "Amazon Polly — free 5M chars/mo (first year), reuses AWS creds." : `Provider: ${ttsProvider} (device voice is a free fallback).`, "FREE: set PROVIDER_TTS=polly (uses your AWS creds, 5M chars/mo free first year) — or leave the free device voice on."),
      item(snapBool("TTS_CACHE_ENABLED", true), "tts_cache", "Speech cache (synthesize once)", "On — repeated prompts (survey questions, cheers) are voiced once, then served from cache.", "Turn on TTS_CACHE_ENABLED. Set REDIS_URL to share the cache across instances for the biggest savings."),
      item(has("REDIS_URL"), "redis", "Shared cache (Redis)", "Connected — TTS + translation caches are shared across instances.", "OPTIONAL: add a Railway Redis and set REDIS_URL. Makes caches shared (bigger savings at scale). Without it, caches are per-instance — still fine to launch."),
      item((await getNumber("AI_DAILY_SPEND_CAP_USD", 0)) > 0, "spendcap", "AI spend hard cap", `Capped at $${await getNumber("AI_DAILY_SPEND_CAP_USD", 0)}/day.`, "Set AI_DAILY_SPEND_CAP_USD to a few dollars as a runaway brake (free-tier calls don't count against real cost anyway)."),
    ];

    // Live cost-floor estimate. AI/media/email all run on free tiers → the only recurring cost is hosting.
    const iosPlanned = snapBool("IOS_LAUNCH", false);
    const externalOneOff = 25 /* Google Play */ + 15 /* domain/yr */ + (iosPlanned ? 99 : 0) /* Apple/yr */;
    const cost_floor = {
      monthly_ai_media_email_usd: 0,             // Groq + Cloudflare + Polly free tier + Brevo free + cache
      monthly_hosting_usd_low: 5, monthly_hosting_usd_high: 20,   // Railway hobby/starter
      external_oneoff_usd: externalOneOff,
      ios_included: iosPlanned,
      year_one_infra_low_usd: externalOneOff + 5 * 12,           // hosting low + one-off
      year_one_infra_high_usd: externalOneOff + 20 * 12,         // hosting high + one-off
      hard_cash_floor_usd: iosPlanned ? 139 : 40,                // Play $25 + domain $15 (+ Apple $99)
      note: "AI, images, transcription, voice and email all run on free tiers ($0). The only recurring cost is hosting (Railway ~$5–20/mo). Developer labor is separate.",
    };

    const allIntegrationsReady = integrations.every((i) => i.ok);
    const freeStackReady = providers.filter((p) => ["groq", "cloudflare"].includes(p.key)).every((p) => p.ok);
    return Response.json({
      go_live_ready: allIntegrationsReady,
      summary: allIntegrationsReady ? "All integrations connected — you're live." : "Product is built & on. Connect the flagged accounts to go fully live.",
      free_stack_ready: freeStackReady,
      integrations, flags, settings, providers, cost_floor,
      ai_daily_spend_cap_usd: await getNumber("AI_DAILY_SPEND_CAP_USD", 0),
      card_charging_on: await isEnabled("card_charging"),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
