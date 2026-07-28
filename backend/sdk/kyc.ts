// Know-Your-Customer (KYC) survey — the mandatory FIRST survey a new user completes after their first
// login. Its purpose is personalization, not compliance-KYC/identity: it captures what the member is
// interested in so the catalog first-view chatbot and every downstream AI (recommendations, catalog
// generation, ranking) can tailor what it predicts, produces, and recommends.
//
// On completion the user is granted KYC_REWARD_USD ($5 by default) of NON-CASHABLE promotional value.
// To reuse the existing, already-integrated spend path, the reward tops up the welcome-rewards pool
// (per-order cap + expiry + breakage apply), so it is real value at ~$0 cash cost and lives inside the
// substantiated "up to $X value" stack. Double-grant is prevented by a one-way flag on the User.
//
// Answers are stored on the User (kyc_answers) AND as a KYCResponse row so the statistical layer can
// aggregate interest distributions and feed them back to the self-learning loop.

import { db } from "./db.ts";
import { getNumber } from "./settings.ts";
import { ensureWelcomeCredit } from "./welcome-credit.ts";

export interface KycQuestion {
  id: string;
  text: string;
  type: "single" | "multi" | "scale" | "text";
  options?: string[];
  required?: boolean;
  help?: string;
}

// The survey. Interest-first so the catalog chatbot has something concrete to personalize from.
// Options intentionally mirror the top catalog departments so answers map straight onto the catalog.
export const KYC_SURVEY: { title: string; description: string; questions: KycQuestion[] } = {
  title: "Welcome — tell us what you're into",
  description:
    "A quick one-time survey so we can tailor your store, deals, and recommendations to you. " +
    "Complete it to unlock your personalized catalog and claim your welcome reward.",
  questions: [
    {
      id: "goals",
      text: "What do you mainly want from GamerGain?",
      type: "multi",
      required: true,
      options: ["Earn cash from surveys & offers", "Shop deals in the store", "Play games", "Sell my own items", "Buy-now-pay-later on real goods", "Just exploring"],
    },
    {
      id: "categories",
      text: "Which product categories interest you most?",
      type: "multi",
      required: true,
      help: "Pick as many as you like — this shapes your catalog.",
      options: [
        "Electronics", "Computers & Gaming", "Home & Kitchen", "Beauty & Personal Care",
        "Health & Wellness", "Clothing & Shoes", "Toys & Games", "Sports & Outdoors",
        "Automotive", "Pet Supplies", "Books & Media", "Grocery & Gourmet",
        "Baby & Kids", "Tools & Home Improvement", "Office & School", "Musical Instruments",
      ],
    },
    {
      id: "game_genres",
      text: "Favorite game genres?",
      type: "multi",
      options: ["Action / Shooter", "RPG / Adventure", "Strategy", "Puzzle / Casual", "Sports / Racing", "Simulation", "MMO / Multiplayer", "Card / Board"],
    },
    {
      id: "shopping_budget",
      text: "About how much do you spend shopping online in a typical month?",
      type: "single",
      options: ["Under $25", "$25–$100", "$100–$250", "$250–$500", "$500+"],
    },
    {
      id: "shopping_style",
      text: "Which best describes your shopping style?",
      type: "single",
      options: ["Deal hunter — best price wins", "Brand loyal", "Premium / quality first", "Eco-conscious", "Impulse / trend-driven"],
    },
    {
      id: "shopping_frequency",
      text: "How often do you shop online?",
      type: "single",
      options: ["Daily", "Weekly", "A few times a month", "Monthly", "Rarely"],
    },
    {
      id: "device",
      text: "Where will you mostly use GamerGain?",
      type: "single",
      options: ["Phone", "Tablet", "Laptop / Desktop", "Game console"],
    },
    {
      id: "interests_text",
      text: "Anything specific you're shopping for or into right now? (optional)",
      type: "text",
      help: "Brands, hobbies, a product you want — anything helps us personalize.",
    },
  ],
};

export interface KycStatus {
  completed: boolean;
  required: boolean;
  reward_usd: number;
  answers: Record<string, unknown> | null;
}

/** Current KYC state for a user: whether they must still complete it and the reward on offer. */
export async function kycStatus(userId: string): Promise<KycStatus> {
  const required = (await getNumber("KYC_SURVEY_REQUIRED", 1)) ? true : false;
  const reward = Math.max(0, await getNumber("KYC_REWARD_USD", 5));
  const user = (await db.get("User", userId).catch(() => null)) as any;
  const completed = !!user?.kyc_completed;
  return {
    completed,
    required: required && !completed,
    reward_usd: reward,
    answers: (user?.kyc_answers as Record<string, unknown>) ?? null,
  };
}

// Bound answers so a client can't inflate storage: cap array length + string length.
function sanitizeAnswers(raw: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!raw || typeof raw !== "object") return out;
  const known = new Set(KYC_SURVEY.questions.map((q) => q.id));
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!known.has(k)) continue;
    if (Array.isArray(v)) out[k] = v.slice(0, 32).map((x) => String(x).slice(0, 120));
    else if (typeof v === "number") out[k] = v;
    else out[k] = String(v ?? "").slice(0, 600);
  }
  return out;
}

/** Save KYC answers, grant the one-time non-cashable reward, and record a KYCResponse for stats.
 *  Idempotent: a second submit updates answers but never re-grants the reward. */
export async function saveKyc(userId: string, rawAnswers: unknown): Promise<{ ok: boolean; reward_granted: number; first_time: boolean }> {
  const user = (await db.get("User", userId).catch(() => null)) as any;
  if (!user) return { ok: false, reward_granted: 0, first_time: false };
  const answers = sanitizeAnswers(rawAnswers);
  const firstTime = !user.kyc_completed;
  const now = new Date().toISOString();

  let granted = 0;
  if (firstTime && !user.kyc_reward_granted) {
    const reward = Math.max(0, await getNumber("KYC_REWARD_USD", 5));
    if (reward > 0) {
      // Ensure the welcome pool exists, then atomically top it up by the KYC reward (non-cashable).
      await ensureWelcomeCredit(userId).catch(() => null);
      for (let attempt = 0; attempt < 4; attempt++) {
        const u = (await db.get("User", userId).catch(() => null)) as any;
        if (!u) break;
        const cur = Number(u.welcome_credit_usd) || 0;
        const next = Math.round((cur + reward) * 100) / 100;
        const ok = await db.updateIf("User", userId, { welcome_credit_usd: next }, { field: "welcome_credit_usd", equals: cur }).catch(() => false);
        if (ok) { granted = reward; break; }
      }
    }
  }

  await db.update("User", userId, {
    kyc_completed: true,
    kyc_answers: answers,
    kyc_completed_at: user.kyc_completed_at || now,
    ...(granted > 0 ? { kyc_reward_granted: true, kyc_reward_usd: granted } : {}),
  }).catch(() => null);

  // Persist a response row for aggregate statistics (one per user; update if it exists).
  const existing = await db.filter("KYCResponse", { user_id: userId }, "-created_date", 1).catch(() => []);
  const row = { user_id: userId, answers, completed_at: now };
  if ((existing || []).length) await db.update("KYCResponse", (existing[0] as any).id, row).catch(() => null);
  else await db.create("KYCResponse", row, userId).catch(() => null);

  return { ok: true, reward_granted: granted, first_time: firstTime };
}

/** Compact, human-readable KYC summary for grounding AI prompts (chatbot, recommendations). */
export function kycProfileText(answers: Record<string, unknown> | null | undefined): string {
  if (!answers || typeof answers !== "object") return "No KYC preferences on file yet.";
  const parts: string[] = [];
  const list = (v: unknown) => Array.isArray(v) ? v.join(", ") : (v ? String(v) : "");
  if (list(answers.goals)) parts.push(`Goals: ${list(answers.goals)}`);
  if (list(answers.categories)) parts.push(`Interested categories: ${list(answers.categories)}`);
  if (list(answers.game_genres)) parts.push(`Game genres: ${list(answers.game_genres)}`);
  if (answers.shopping_budget) parts.push(`Monthly budget: ${answers.shopping_budget}`);
  if (answers.shopping_style) parts.push(`Style: ${answers.shopping_style}`);
  if (answers.shopping_frequency) parts.push(`Shops online: ${answers.shopping_frequency}`);
  if (answers.device) parts.push(`Primary device: ${answers.device}`);
  if (answers.interests_text) parts.push(`Free-text interests: ${String(answers.interests_text).slice(0, 300)}`);
  return parts.length ? parts.join(". ") + "." : "No KYC preferences on file yet.";
}
