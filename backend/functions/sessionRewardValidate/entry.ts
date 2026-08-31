import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool, snapNumber } from "../../sdk/settings.ts";
import { validateSessionOutcome, type SessionClaim, type SessionRules } from "../../sdk/session-host.ts";

// sessionRewardValidate — the TRUST BOUNDARY for Tier-3 player hosting. A peer-hosted session is untrusted, so
// this NEVER accepts the reward a session claims. It:
//   1. loads the authoritative GameSession we started (so a host can't fabricate a session that never ran),
//   2. atomically claims it (status active -> validating) so a reward can be computed at most ONCE (anti-replay),
//   3. RECOMPUTES the reward from the reported score using the server's own formula + caps + plausibility,
//   4. records the accepted amount on the session for the existing (gated) reward pipeline to credit.
// It does NOT itself move money — crediting stays on the one established, gated reward path. Gated behind
// SESSION_HOSTING_ENABLED. This is what lets the session run on a player's device while value stays server-safe.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!snapBool("SESSION_HOSTING_ENABLED", false)) {
      return Response.json({ error: "Session hosting disabled (SESSION_HOSTING_ENABLED off)." }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const claim: SessionClaim = {
      session_id: String(body?.session_id || ""),
      player_id: String(body?.player_id || user.id),
      score: Number(body?.score) || 0,
      duration_s: Number(body?.duration_s) || 0,
    };
    if (!claim.session_id) return Response.json({ error: "session_id required" }, { status: 400 });

    // 1) Load the session we started.
    const rows = await db.filter("GameSession", { session_id: claim.session_id }, undefined, 1).catch(() => []) as Record<string, unknown>[];
    const session = rows[0];
    if (!session) return Response.json({ error: "Unknown session (not started by the server)." }, { status: 404 });
    if (!Array.isArray(session.player_ids) || !session.player_ids.map(String).includes(claim.player_id)) {
      return Response.json({ error: "Claiming player was not part of this session." }, { status: 403 });
    }

    // 2) Atomically claim it so the reward is computed at most once (anti-replay).
    const claimed = await db.updateIf("GameSession", String(session.id),
      { status: "validating", validated_by: user.email ?? user.id, validated_at: new Date().toISOString() },
      { field: "status", equals: "active" }).catch(() => null);
    if (!claimed) return Response.json({ error: "Session already validated or not active (replay blocked)." }, { status: 409 });

    // 3) Recompute the reward from validated inputs (never from the client's claimed reward).
    const startedAt = Date.parse(String(session.started_at || "")) || Date.now();
    const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
    const priorRewardToday = await db.sum("GameSession", "accepted_reward",
      { player_id_rewarded: claim.player_id, status: "validated", validated_at: { $gte: todayStart.toISOString() } }).catch(() => 0);

    const rules: SessionRules = {
      rewardPerPoint: Math.max(0, snapNumber("SESSION_REWARD_PER_POINT", 0.001)),
      maxReward: Math.max(0, snapNumber("SESSION_MAX_REWARD", 5)),
      minSeconds: Math.max(0, snapNumber("SESSION_MIN_SECONDS", 10)),
      maxScorePerSecond: Math.max(1, snapNumber("SESSION_MAX_SCORE_PER_SEC", 100)),
      maxRewardPerDay: Math.max(0, snapNumber("SESSION_MAX_REWARD_PER_DAY", 25)),
      priorRewardToday: Number(priorRewardToday) || 0,
    };
    // sanity: server also checks the wall-clock elapsed roughly matches the claimed duration (host clock lies).
    const wallElapsed = Math.max(0, (Date.now() - startedAt) / 1000);
    if (claim.duration_s > wallElapsed + 30) {
      await db.update("GameSession", String(session.id), { status: "rejected", reject_reason: "duration exceeds wall-clock" }).catch(() => null);
      return Response.json({ ok: false, accepted_reward: 0, reasons: ["claimed duration exceeds real elapsed time"] });
    }

    const result = validateSessionOutcome(claim, rules);

    // 4) Record the outcome. accepted_reward is what the existing (gated) reward pipeline will credit — this
    //    function does not move value itself.
    await db.update("GameSession", String(session.id), {
      status: result.ok ? "validated" : "rejected",
      player_id_rewarded: claim.player_id,
      score: claim.score, duration_s: claim.duration_s,
      accepted_reward: result.accepted_reward, computed_reward: result.computed_reward,
      reasons: result.reasons, rewarded: false,
    }).catch(() => null);

    return Response.json({
      ok: result.ok,
      accepted_reward: result.accepted_reward,
      computed_reward: result.computed_reward,
      reasons: result.reasons,
      note: result.ok
        ? "Validated. The accepted reward is queued for the server's normal (gated) reward crediting — the host never touched value."
        : "Rejected as implausible — no reward. The session state was on the player's device; nothing of value was at risk.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
