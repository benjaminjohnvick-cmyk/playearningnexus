// scam-guard.ts — protect users in buddy/group chat from the scams a money platform attracts.
//
// The dangerous pattern (romance / "pig-butchering" / investment scams) always starts the same way: move
// the conversation OFF-platform (Instagram, WhatsApp, Telegram…), then ask for money or push an "investment".
// Because your platform involves earning, you're a target for exactly this. So we BLOCK the messages that
// carry that pattern — off-platform contact, payment handles, money solicitation, raw contact info, external
// links — with a clear, kind explanation, and keep everything in-app where moderation and blocking work.
//
// This is coarse by design (false positives are acceptable when the downside is a scam); human reporting +
// the transcript archive back it up.

export type ScamCategory =
  | "off_platform_contact" | "payment_handle" | "money_solicitation" | "contact_info" | "external_link" | null;

export interface ScamScan { ok: boolean; blocked: boolean; category: ScamCategory; message: string }

const OFF_PLATFORM = /\b(instagram|insta|ig|snap(chat)?|whats\s?app|wa\.me|telegram|tele|signal app|facebook|fb\.com|messenger|tiktok|discord|kik|onlyfans)\b/i;
const OFF_PLATFORM_INVITE = /\b(add me|dm me|hit me up|find me on|text me on|message me on|off here|off the app|off this app)\b/i;
const PAYMENT = /\b(cash\s?app|cashtag|\$[a-z0-9_]{3,}|venmo|paypal|pay\s?pal|zelle|wire transfer|western union|money\s?gram|gift\s?card|bitcoin|btc|ethereum|eth|usdt|crypto|wallet address|0x[a-f0-9]{6,})\b/i;
const MONEY_ASK = /\b(send (me )?money|send (me )?\$|invest(ment)?|double your|guaranteed returns?|deposit|loan me|pay me|wire me|venmo me|cashapp me)\b/i;
const PHONE = /(\+?\d[\s\-.]?){7,}/;
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const URL = /\b((https?:\/\/)|(www\.))\S+|\b[a-z0-9-]+\.(com|net|org|io|xyz|link|me|gg)\b/i;

const say = (m: string) => m;

/** Scan a chat message. Returns blocked:true for the scam-carrying categories. */
export function scanMessage(text: string): ScamScan {
  const t = String(text || "");
  if (OFF_PLATFORM.test(t) || OFF_PLATFORM_INVITE.test(t)) {
    return { ok: false, blocked: true, category: "off_platform_contact", message: say("For your safety, keep chats here — sharing other apps or moving off-platform is how scammers operate.") };
  }
  if (PAYMENT.test(t)) {
    return { ok: false, blocked: true, category: "payment_handle", message: say("Payment details aren't allowed in chat. Never send money to someone you met here.") };
  }
  if (MONEY_ASK.test(t)) {
    return { ok: false, blocked: true, category: "money_solicitation", message: say("That looks like a request involving money — blocked for your safety. Never send money to another user.") };
  }
  if (EMAIL.test(t) || PHONE.test(t)) {
    return { ok: false, blocked: true, category: "contact_info", message: say("Keep personal contact info out of chat — stay in-app where we can keep you safe.") };
  }
  if (URL.test(t)) {
    return { ok: false, blocked: true, category: "external_link", message: say("Links aren't allowed in buddy/group chat.") };
  }
  return { ok: true, blocked: false, category: null, message: "" };
}

/** Short, always-visible safety reminder for any stranger chat surface. */
export const SAFETY_TIP = "Keep it friendly and on-platform. Never send money, and don't share contact info. Report anything off.";
