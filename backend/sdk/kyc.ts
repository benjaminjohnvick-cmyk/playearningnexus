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

export type KycSurvey = { title: string; description: string; questions: KycQuestion[] };

// ── Editable survey layer ─────────────────────────────────────────────────────────────────────────
// The survey is no longer fixed in code: a KycSurveyConfig singleton holds the ACTIVE survey (editable
// by an admin) plus any PENDING AI-proposed survey awaiting human review. getActiveSurvey() falls back
// to the built-in KYC_SURVEY default when nothing has been customized. This is what makes the survey
// adjustable both by a human (admin editor) and by AI (proposal → human-approve), with no code deploy.
const CONFIG_ENTITY = "KycSurveyConfig";
const CONFIG_KEY = "kyc";

export interface KycSurveyConfigRow {
  id?: string;
  singleton: string;
  active_survey: KycSurvey | null;
  proposal: KycSurvey | null;
  proposal_meta: { source: string; rationale: string; created_at: string; by?: string } | null;
  version: number;
  source: "default" | "human" | "ai";
  updated_by: string | null;
  updated_at: string;
}

/** Validate a survey's shape so a bad human/AI edit can't corrupt onboarding. Returns cleaned survey. */
export function validateSurvey(raw: unknown): { ok: boolean; error?: string; survey?: KycSurvey } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Survey must be an object." };
  const s = raw as any;
  const title = String(s.title ?? "").trim();
  const description = String(s.description ?? "").trim();
  if (!title) return { ok: false, error: "Survey needs a title." };
  if (!Array.isArray(s.questions) || s.questions.length === 0) return { ok: false, error: "Survey needs at least one question." };
  if (s.questions.length > 30) return { ok: false, error: "Too many questions (max 30)." };
  const ids = new Set<string>();
  const types = new Set(["single", "multi", "scale", "text"]);
  const questions: KycQuestion[] = [];
  for (const q of s.questions) {
    const id = String(q?.id ?? "").trim().slice(0, 60);
    const text = String(q?.text ?? "").trim().slice(0, 300);
    const type = String(q?.type ?? "").trim();
    if (!id) return { ok: false, error: "Every question needs an id." };
    if (ids.has(id)) return { ok: false, error: `Duplicate question id: ${id}` };
    if (!text) return { ok: false, error: `Question "${id}" needs text.` };
    if (!types.has(type)) return { ok: false, error: `Question "${id}" has an invalid type.` };
    ids.add(id);
    const out: KycQuestion = { id, text, type: type as KycQuestion["type"] };
    if (q?.required) out.required = true;
    if (q?.help) out.help = String(q.help).slice(0, 300);
    if (type === "single" || type === "multi") {
      const options = Array.isArray(q?.options) ? q.options.map((o: unknown) => String(o).slice(0, 120)).filter(Boolean).slice(0, 40) : [];
      if (options.length < 2) return { ok: false, error: `Question "${id}" needs at least 2 options.` };
      out.options = options;
    }
    questions.push(out);
  }
  return { ok: true, survey: { title: title.slice(0, 160), description: description.slice(0, 600), questions } };
}

async function getConfigRow(): Promise<KycSurveyConfigRow | null> {
  const rows = await db.filter(CONFIG_ENTITY, { singleton: CONFIG_KEY }, "-created_date", 1).catch(() => []) as KycSurveyConfigRow[];
  return rows[0] || null;
}

/** The survey members actually see: the admin/AI-approved active survey, or the built-in default. */
export async function getActiveSurvey(): Promise<KycSurvey> {
  const row = await getConfigRow().catch(() => null);
  if (row?.active_survey) {
    const v = validateSurvey(row.active_survey);
    if (v.ok && v.survey) return v.survey;
  }
  return KYC_SURVEY;
}

/** Everything the admin editor needs: active survey, the built-in default, and any pending proposal. */
export async function getSurveyAdminView(): Promise<{ active: KycSurvey; default: KycSurvey; proposal: KycSurvey | null; proposal_meta: KycSurveyConfigRow["proposal_meta"]; version: number; source: string }> {
  const row = await getConfigRow().catch(() => null);
  const active = (row?.active_survey && validateSurvey(row.active_survey).ok) ? (row!.active_survey as KycSurvey) : KYC_SURVEY;
  return { active, default: KYC_SURVEY, proposal: row?.proposal ?? null, proposal_meta: row?.proposal_meta ?? null, version: row?.version ?? 0, source: row?.source ?? "default" };
}

/** Set the ACTIVE survey (human edit or an approved AI proposal). Clears any pending proposal. */
export async function saveActiveSurvey(survey: KycSurvey, source: "human" | "ai", updatedBy?: string): Promise<void> {
  const row = await getConfigRow().catch(() => null);
  const now = new Date().toISOString();
  const patch = { singleton: CONFIG_KEY, active_survey: survey, proposal: null, proposal_meta: null, version: (row?.version ?? 0) + 1, source, updated_by: updatedBy ?? null, updated_at: now };
  if (row?.id) await db.update(CONFIG_ENTITY, row.id, patch).catch(() => null);
  else await db.create(CONFIG_ENTITY, patch, updatedBy).catch(() => null);
}

/** Stage an AI-proposed survey for human review (does NOT change what members see). */
export async function saveProposal(survey: KycSurvey, rationale: string, by?: string): Promise<void> {
  const row = await getConfigRow().catch(() => null);
  const now = new Date().toISOString();
  const meta = { source: "ai", rationale: String(rationale || "").slice(0, 2000), created_at: now, by };
  if (row?.id) await db.update(CONFIG_ENTITY, row.id, { proposal: survey, proposal_meta: meta, updated_at: now }).catch(() => null);
  else await db.create(CONFIG_ENTITY, { singleton: CONFIG_KEY, active_survey: null, proposal: survey, proposal_meta: meta, version: 0, source: "default", updated_by: by ?? null, updated_at: now }, by).catch(() => null);
}

/** Discard the pending AI proposal. */
export async function clearProposal(): Promise<void> {
  const row = await getConfigRow().catch(() => null);
  if (row?.id) await db.update(CONFIG_ENTITY, row.id, { proposal: null, proposal_meta: null, updated_at: new Date().toISOString() }).catch(() => null);
}

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

// Bound answers so a client can't inflate storage: cap array length + string length. Known ids come
// from the ACTIVE survey (which may be admin/AI-customized), so answers to custom questions are kept.
function sanitizeAnswers(raw: unknown, knownIds?: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!raw || typeof raw !== "object") return out;
  const known = knownIds && knownIds.size ? knownIds : new Set(KYC_SURVEY.questions.map((q) => q.id));
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
  const activeSurvey = await getActiveSurvey().catch(() => KYC_SURVEY);
  const answers = sanitizeAnswers(rawAnswers, new Set(activeSurvey.questions.map((q) => q.id)));
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
  // Include any CUSTOM question answers (from an admin/AI-adjusted survey) generically, so a tailored
  // survey still feeds the chatbot and downstream AI.
  const known = new Set(["goals", "categories", "game_genres", "shopping_budget", "shopping_style", "shopping_frequency", "device", "interests_text"]);
  for (const [k, v] of Object.entries(answers)) {
    if (known.has(k)) continue;
    const val = list(v);
    if (val) parts.push(`${k}: ${val.slice(0, 200)}`);
  }
  return parts.length ? parts.join(". ") + "." : "No KYC preferences on file yet.";
}
