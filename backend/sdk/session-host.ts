// session-host.ts — the pure core of Tier-3 "automatic player hosting" (the multiplayer listen-server model
// applied to live play-to-earn sessions). Two pure, deterministic, unit-testable pieces:
//
//   electHost()             — pick which connected player should HOST a session (best connection/device), or
//                             decide no one is good enough and the server should host. This is the automatic
//                             "a player sets up the server" step.
//   validateSessionOutcome()— the TRUST BOUNDARY. A peer-hosted session is untrusted (the host could cheat), so
//                             the server never accepts the reward a session claims. Instead it RECOMPUTES the
//                             reward from validated inputs, applies caps and plausibility checks, and rejects
//                             anything impossible. This is what makes it safe to host the *session* on a device
//                             while the *money* stays server-authoritative.
//
// The gameplay/session state is disposable (if the host drops, the round ends — nobody loses value). Only the
// validated reward becomes real Site Cash, and only through the server.

export interface PlayerConn {
  id: string;
  hostScore?: number;   // 0..100 — connection quality + device capability (client-reported HINT, not trusted for money)
  isServerCandidate?: boolean;
}

export interface HostElection {
  host_type: "peer" | "server";
  host_player_id: string | null;
  reason: string;
}

/** Elect a session host. Picks the highest hostScore above `minScore`; ties break by id for determinism. If no
 *  player clears the bar (or none connected), the server hosts. Pure. The score is only used to choose a host —
 *  it never affects rewards, so a player lying about their score just risks a worse session, not value. */
export function electHost(players: PlayerConn[], minScore = 55): HostElection {
  const eligible = (players || [])
    .filter((p) => p && typeof p.id === "string" && (Number(p.hostScore) || 0) >= minScore)
    .sort((a, b) => (Number(b.hostScore) || 0) - (Number(a.hostScore) || 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (eligible.length === 0) {
    return { host_type: "server", host_player_id: null, reason: `No player at/above host-quality ${minScore} — server hosts.` };
  }
  return { host_type: "peer", host_player_id: eligible[0].id, reason: `Player ${eligible[0].id} elected host (score ${eligible[0].hostScore}).` };
}

export interface SessionClaim {
  session_id: string;
  player_id: string;
  score: number;        // what the (untrusted) session reports
  duration_s: number;   // how long the session claims to have run
}

export interface SessionRules {
  rewardPerPoint: number;      // server's own reward formula input (NOT taken from the client)
  maxReward: number;           // hard cap per session
  minSeconds: number;          // sessions shorter than this are implausible
  maxScorePerSecond: number;   // score rate above this is impossible → reject
  maxRewardPerDay?: number;    // optional daily cap the caller enforces with prior totals
  priorRewardToday?: number;   // reward already granted today (for the daily cap)
}

export interface SessionValidation {
  ok: boolean;
  accepted_reward: number;     // what the SERVER will actually issue (recomputed + clamped), 0 if rejected
  computed_reward: number;     // reward from the formula before caps
  reasons: string[];           // why rejected / clamped
}

/** Validate an untrusted session outcome and decide the reward the SERVER will issue. Never trusts a
 *  client-supplied reward — recomputes it from score via the server's own formula, then applies plausibility
 *  checks and caps. Pure + deterministic. Anti-replay (one reward per session_id) is enforced by the caller at
 *  the DB layer; this function assumes it's being asked about a fresh session. */
export function validateSessionOutcome(claim: SessionClaim, rules: SessionRules): SessionValidation {
  const reasons: string[] = [];
  const score = Math.max(0, Number(claim?.score) || 0);
  const duration = Math.max(0, Number(claim?.duration_s) || 0);

  let plausible = true;
  if (!claim?.session_id || !claim?.player_id) { plausible = false; reasons.push("missing session_id/player_id"); }
  if (duration < rules.minSeconds) { plausible = false; reasons.push(`duration ${duration}s < min ${rules.minSeconds}s (too short to be real)`); }
  if (duration > 0 && score / duration > rules.maxScorePerSecond) {
    plausible = false; reasons.push(`score rate ${(score / duration).toFixed(2)}/s > max ${rules.maxScorePerSecond}/s (impossible)`);
  }

  const computed_reward = Math.max(0, score * Math.max(0, rules.rewardPerPoint));
  if (!plausible) return { ok: false, accepted_reward: 0, computed_reward, reasons };

  let accepted = Math.min(computed_reward, Math.max(0, rules.maxReward));
  if (accepted < computed_reward) reasons.push(`clamped to per-session cap ${rules.maxReward}`);

  if (rules.maxRewardPerDay != null) {
    const remaining = Math.max(0, rules.maxRewardPerDay - Math.max(0, rules.priorRewardToday || 0));
    if (accepted > remaining) { reasons.push(`clamped to daily cap (remaining ${remaining})`); accepted = remaining; }
  }

  return { ok: accepted > 0, accepted_reward: accepted, computed_reward, reasons };
}
