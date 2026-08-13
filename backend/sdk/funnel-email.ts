// funnel-email.ts — turns an AI-concierge recommendation into a COMPLIANT re-engagement email a customer can
// reply to and continue the conversation. It does NOT decide who is allowed to be emailed — the calling
// function must gate on canEmailMarket() (consent + opt-out + email_marketing flag) first. Every body here
// appends the required CAN-SPAM unsubscribe + physical-address footer.
import { snapBool, snapNumber, snapString } from "./settings.ts";
import { emailUnsubscribeFooter } from "./messaging-consent.ts";
import type { Recommendation } from "./ai-funnel.ts";

export const funnelEmailEnabled = () => snapBool("FUNNEL_EMAIL_ENABLED", true);
export const funnelEmailMinDaysBetween = () => Math.max(0, snapNumber("FUNNEL_EMAIL_MIN_DAYS_BETWEEN", 7));
export const funnelEmailFrom = () => snapString("FUNNEL_EMAIL_FROM", "") || undefined;
export const funnelEmailCtaPath = () => snapString("FUNNEL_EMAIL_CTA_PATH", "/AIFunnelConcierge") || "/AIFunnelConcierge";

const money = (n: number | null | undefined) => (n == null ? "" : `$${Number(n).toLocaleString()}`);

function ctaUrl(): string {
  const base = (Deno.env.get("FRONTEND_URL") ?? "https://gamergain.app").replace(/\/$/, "");
  const path = funnelEmailCtaPath();
  return `${base}${path.startsWith("/") ? path : "/" + path}`;
}

/** Build a re-engagement email from a recommendation. Honest subject, conversational body, clear CTA
 *  (reply or open the concierge), and the required unsubscribe/postal footer. */
export function buildReengageEmail(user: Record<string, unknown>, rec: Recommendation, opts?: { productName?: string; resultsUsd?: number }): { subject: string; body: string } {
  const name = String(user.full_name ?? user.name ?? "there").split(" ")[0] || "there";
  const product = opts?.productName ?? rec.current_key ?? "your plan";
  const recName = rec.recommend_name ?? "your current plan";
  const url = ctaUrl();

  let subject: string;
  let lead: string;
  if (rec.gate === "results") {
    const r = money(opts?.resultsUsd);
    subject = `A quick suggestion about ${recName}`;
    if (rec.direction === "up") {
      lead = `Your results on ${product} look strong${r ? ` (${r})` : ""}. When you're ready to scale, ${recName} is built for that — want me to walk you through it?`;
    } else if (rec.direction === "down") {
      lead = `I looked at how ${product} has been doing for you${r ? ` (${r} so far)` : ""}, and I think ${recName} would fit you better right now so you're not overpaying. Happy to switch you — just reply.`;
    } else {
      lead = `Checking in on ${product}${r ? ` — ${r} so far` : ""}. A couple of tweaks could help; reply and I'll walk through them with you.`;
    }
  } else {
    subject = `Picking the right plan — a quick hand`;
    if (rec.direction === "up") {
      lead = `You were looking at ${product}. Based on what you're trying to do, ${recName} ${rec.recommend_price_usd != null ? `(${money(rec.recommend_price_usd)}) ` : ""}might actually be the better fit. Want to talk it through?`;
    } else if (rec.direction === "down") {
      lead = `You were looking at ${product}. Honestly, ${recName} ${rec.recommend_price_usd != null ? `(${money(rec.recommend_price_usd)}) ` : ""}is a better-sized place to start — you can always move up once it's working. Reply and I'll set it up.`;
    } else {
      lead = `You were looking at ${product} — it looks like a solid fit. If you have questions before you decide, just reply to this email.`;
    }
  }

  const body =
    `Hi ${name},\n\n${lead}\n\n` +
    `You can reply straight to this email, or pick up where we left off here: ${url}\n\n` +
    `No pressure at all — if now isn't the time, just ignore this.\n\n— The plan concierge` +
    emailUnsubscribeFooter(user);

  return { subject, body };
}
