import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  normalizeTier, creativeSuiteTierCaps, adFormat, formatAllowed,
  screenCreative, scoreCreative, playbookFor, generationsRemaining, allFormatKeys,
} from "../../sdk/creative-suite.ts";
import { adBranding, watermarkImageHint } from "../../sdk/ad-branding.ts";

// aiCreativeSuiteGenerate — the "generate" step of the AI Creative Suite. One brief → compliant, brand-aligned
// variants across every requested ad format, biased by the advertiser's self-learning playbook, each
// compliance-screened and given a predictive score, then persisted as CreativeAsset rows. Works for all three
// tiers (limits/formats/images come from the tier caps).
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const tier = normalizeTier(body.tier);
    const caps = creativeSuiteTierCaps(tier);
    if (!caps.enabled) return Response.json({ error: "The AI Creative Suite is currently disabled." }, { status: 403 });

    const brief = String(body.brief ?? "").trim();
    if (!brief) return Response.json({ error: "A creative brief is required." }, { status: 400 });
    const audience = String(body.audience ?? "adults 18+, gaming/rewards").slice(0, 300);
    const brandKit = (caps.brand_kit && body.brand_kit && typeof body.brand_kit === "object") ? body.brand_kit : null;
    const wantImages = !!body.generate_images && caps.image_generation;

    // Resolve requested formats against what this tier allows.
    const requested: string[] = Array.isArray(body.formats) && body.formats.length ? body.formats.map(String) : ["social_post", "interstitial", "square_1080"];
    const formats = requested.filter((f) => formatAllowed(tier, f) && adFormat(f)).slice(0, 12);
    if (!formats.length) return Response.json({ error: "None of the requested formats are available on this tier.", allowed: caps.formats }, { status: 400 });

    const perFormat = Math.max(1, Math.min(Number(body.count) || caps.max_variants_per_brief, caps.max_variants_per_brief));

    // Quota (soft): remaining generations this period, estimated from recent CreativeAsset rows.
    const used = await db.count("CreativeAsset", { advertiser_id: user.id }).catch(() => 0);
    const remaining = generationsRemaining(tier, used);
    if (remaining <= 0) return Response.json({ error: "Generation quota reached for this period.", tier, cap: caps.monthly_generations }, { status: 429 });

    const playbook = await playbookFor(db, user.id).catch(() => null);
    const topAttrs = playbook?.top ?? {};

    const brandLine = brandKit
      ? `Brand voice: ${JSON.stringify(brandKit).slice(0, 400)}. Match this voice, palette and do/don't list exactly.`
      : "No brand kit provided — use a friendly, trustworthy, benefit-led voice.";
    const learnLine = Object.keys(topAttrs).length
      ? `Historically best-performing attributes (favor these): ${JSON.stringify(topAttrs)}.`
      : "No performance history yet — vary hook/tone/length so the A/B test can learn.";

    const out: Record<string, unknown>[] = [];
    for (const fk of formats) {
      const spec = adFormat(fk)!;
      const n = Math.min(perFormat, Number.isFinite(remaining) ? Math.max(1, remaining - out.length) : perFormat);
      if (n <= 0) break;

      const prompt = `You are a senior direct-response ad creative director for an 18+ closed-loop play-to-earn / survey-rewards platform.
Generate ${n} DISTINCT ad creatives for this format.

FORMAT: ${spec.label} (${spec.medium}). Surfaces: ${spec.surfaces.join(", ")}.
Character budgets — headline ≤ ${spec.headline_max ?? 60}, body ≤ ${spec.body_max ?? 150}, cta ≤ ${spec.cta_max ?? 20}.
BRIEF: ${brief}
AUDIENCE: ${audience}
${brandLine}
${learnLine}

STRICT COMPLIANCE — this is mandatory. Do NOT promise or imply any financial return, ROI, "2x/4x", "double your money", guaranteed earnings, guaranteed income, "risk-free", "get rich", or investment framing. Rewards are non-cashable store credit ("Site Cash"); earnings vary and are never guaranteed. Sell the experience and the delivered value, never a return.

For EACH creative return: headline, body, cta, and an attributes object tagging: hook (question|benefit|curiosity|social_proof|discount|bold_claim), tone (playful|urgent|premium|friendly|informative), length (short|medium|long), cta_style (action|soft|urgency), visual_style (clean|bold|photographic|illustrated|minimal), emoji (none|light|heavy), urgency (none|low|high). ${spec.medium === "image" || spec.medium === "video" ? "Also include image_prompt: a vivid prompt to generate the visual." : ""}`;

      const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            variants: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  headline: { type: "string" }, body: { type: "string" }, cta: { type: "string" },
                  image_prompt: { type: "string" },
                  attributes: {
                    type: "object",
                    properties: {
                      hook: { type: "string" }, tone: { type: "string" }, length: { type: "string" },
                      cta_style: { type: "string" }, visual_style: { type: "string" }, emoji: { type: "string" }, urgency: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      }).catch(() => ({ variants: [] }));

      const variants = Array.isArray(res?.variants) ? res.variants : [];
      for (const v of variants.slice(0, n)) {
        const attrs = { ...(v.attributes || {}), format: fk };
        const screen = screenCreative(v);
        // A creative that fails a BLOCK rule is not shipped — flag it and skip persistence.
        const compliant = screen.ok;
        const score = scoreCreative({ headline: v.headline, body: v.body, cta: v.cta, format: fk, attributes: attrs, compliant }, playbook || undefined);

        let image_url: string | null = null;
        if (compliant && wantImages && (spec.medium === "image" || spec.medium === "video") && v.image_prompt) {
          const img = await base44.asServiceRole.integrations.Core.GenerateImage({
            prompt: `${v.image_prompt}. ${spec.width && spec.height ? `Composition sized for ${spec.width}x${spec.height}.` : ""} No text overlays claiming guaranteed money/returns.${watermarkImageHint()}`,
          }).catch(() => ({ url: null }));
          image_url = img?.url ?? null;
        }

        const asset = {
          advertiser_id: user.id, tier, format: fk, medium: spec.medium,
          headline: v.headline ?? "", body: v.body ?? "", cta: v.cta ?? "",
          image_prompt: v.image_prompt ?? null, image_url,
          attributes: attrs, score, compliant, violations: screen.violations,
          branding: adBranding(),   // Get Goods Gratis watermark + website link, stamped on every ad (all tiers)
          status: compliant ? "draft" : "blocked",
          impressions: 0, clicks: 0, created_at: new Date().toISOString(),
        };
        if (compliant) {
          const created = await db.create("CreativeAsset", asset).catch(() => null) as Record<string, unknown> | null;
          if (created?.id) (asset as Record<string, unknown>).id = created.id;   // the UI needs the id to launch a test
        }
        out.push(asset);
      }
    }

    out.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    return Response.json({
      success: true, tier, formats,
      generated: out.length,
      shipped: out.filter((o) => o.compliant).length,
      blocked: out.filter((o) => !o.compliant).length,
      playbook_top: topAttrs,
      quota: { cap: caps.monthly_generations, used, remaining: Number.isFinite(remaining) ? remaining : "unlimited" },
      creatives: out,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
