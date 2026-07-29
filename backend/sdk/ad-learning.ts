// ad-learning.ts — closes the learn→improve loop for the Premium PPC AI advertiser.
//
// Every ad the AI queues produces an OUTCOME when the member acts on it (posts it, or skips it). We turn
// those outcomes into the SAME learning primitives the rest of the platform's self-improvement loop
// already consumes — OptimizationSignal (weighted feedback the optimizer / self-learning grounding
// reads) and AgentLearningMemory (the durable per-agent lesson that learningInsights rolls up and
// learningDistill compresses). The generator then reads those signals back (adLearningInsights) to bias
// the NEXT batch: prioritize the platforms members actually post to, and show the model examples of copy
// that members chose to post. Nothing is silently discarded — a skipped ad is a negative signal, not a
// deletion.
//
// No new tables: reuses OptimizationSignal, AgentLearningMemory, and SocialMediaPost (all JSONB
// doc-store rows), so this adds a learning loop without a schema change.

import { db } from "./db.ts";

/** Agent name under which ad learning shows up in the oversight feed + learningInsights dashboard. */
export const AD_AGENT = "ppc_ad_ai";

export type AdOutcome = "posted" | "auto_posted" | "dismissed";

/** Weight of each outcome as a learning signal (a hand-posted ad is the strongest positive; an
 *  auto-post is stronger still because the account is API-connected; a skip is a mild negative). */
function outcomeWeight(o: AdOutcome): number {
  if (o === "auto_posted") return 3;
  if (o === "posted") return 2;
  return -1; // dismissed
}

/** Record a member's decision on an AI-generated ad as learning signals the self-improvement loop reads.
 *  Best-effort — never throws into the caller (the member's action must always succeed). */
export async function recordAdOutcome(
  post: Record<string, unknown> | null | undefined,
  outcome: AdOutcome,
): Promise<void> {
  if (!post) return;
  const platform = String(post.platform ?? "unknown").toLowerCase();
  const postType = String(post.post_type ?? "premium_ppc_ad");
  const key = `ad:${platform}:${postType}`;
  const at = new Date().toISOString();
  const success = outcome !== "dismissed";

  // Weighted feedback signal (optimizer / self-learning grounding reads OptimizationSignal rows).
  await db.create("OptimizationSignal", {
    kind: "ad_outcome", key, outcome, platform, post_type: postType,
    advertiser_id: post.ppc_advertiser_id ?? null, weight: outcomeWeight(outcome),
    note: `PPC ad ${outcome} on ${platform}`, created_at: at,
  }).catch(() => null);

  // Durable per-agent lesson (learningInsights per-agent success trend + learningDistill roll-up).
  await db.create("AgentLearningMemory", {
    agent_name: AD_AGENT, type: "ad_outcome", target: key,
    success, provisional: true,
    improvement_notes: success
      ? `Members posted a ${postType} on ${platform} — this style/placement is landing; favor it.`
      : `A ${postType} on ${platform} was skipped — vary the copy or shift the platform mix.`,
    platform, outcome, recorded_at: at, created_at: at,
  }).catch(() => null);
}

export interface AdInsights {
  platformScore: Record<string, number>;  // platform → net score (posts − skips) from recent ads
  rankedPlatforms: string[];               // best-performing platforms first (for targeting priority)
  topExamples: string[];                   // copy members actually posted (fed to the model as exemplars)
  sampled: number;
}

/** Read recent ad outcomes back into targeting + generation guidance for the next batch. Best-effort;
 *  returns empty guidance on any error so generation always proceeds. */
export async function adLearningInsights(lookbackDays = 30): Promise<AdInsights> {
  const empty: AdInsights = { platformScore: {}, rankedPlatforms: [], topExamples: [], sampled: 0 };
  try {
    const since = new Date(Date.now() - Math.max(1, lookbackDays) * 86400000).toISOString();
    const posts = (await db.filter("SocialMediaPost", {}, "-created_date", 5000).catch(() => [])) as Record<string, unknown>[];
    const recent = posts.filter((p) => {
      const t = String(p.post_type ?? "");
      const when = String(p.created_at ?? p.created_date ?? "");
      return (t === "premium_ppc_ad" || t === "platform_own_ad") && when >= since;
    });
    const score: Record<string, number> = {};
    const examples: string[] = [];
    for (const p of recent) {
      const platform = String(p.platform ?? "unknown").toLowerCase();
      const st = String(p.status ?? "");
      if (st === "posted") {
        score[platform] = (score[platform] ?? 0) + 1;
        if (examples.length < 6 && p.content) examples.push(String(p.content).slice(0, 400));
      } else if (st === "dismissed") {
        score[platform] = (score[platform] ?? 0) - 1;
      }
    }
    const rankedPlatforms = Object.entries(score).sort((a, b) => b[1] - a[1]).map(([p]) => p);
    return { platformScore: score, rankedPlatforms, topExamples: examples, sampled: recent.length };
  } catch {
    return empty;
  }
}

/** Order a set of connections so higher-performing platforms are served first when a per-run cap limits
 *  how many posts get queued — the learned priority, applied to targeting. Unknown platforms keep their
 *  original relative order after the ranked ones. */
export function prioritizeByLearning<T extends { platform?: unknown }>(items: T[], ranked: string[]): T[] {
  if (!ranked.length) return items;
  const rank = new Map(ranked.map((p, i) => [p, i]));
  const idx = (t: T) => rank.has(String(t.platform ?? "").toLowerCase()) ? rank.get(String(t.platform ?? "").toLowerCase())! : ranked.length + 1;
  return items
    .map((t, i) => ({ t, i }))
    .sort((a, b) => (idx(a.t) - idx(b.t)) || (a.i - b.i))
    .map((x) => x.t);
}
