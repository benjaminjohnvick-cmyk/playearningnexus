import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool, getNumber } from "../../sdk/settings.ts";
import { hostingUnlockState, sumDailyEarnings } from "../../sdk/hosting-access.ts";
import { resolveCapabilities } from "../../sdk/session-capabilities.ts";
import { resolveMonetization } from "../../sdk/hosting-monetization.ts";

// sessionHostAssign — the authenticated caller requests to HOST a room (a game, a stream, or screen-mirroring).
// The server verifies THEIR eligibility (it can trust its own earnings data, not a client-reported score) and,
// if eligible, the caller becomes the host; otherwise the server hosts. Records an authoritative GameSession.
// Gated behind SESSION_HOSTING_ENABLED.
//
// Rules wired here:
//  • Earn-to-unlock: when HOSTING_UNLOCK_ENABLED is on, the caller must have earned the daily threshold (default
//    $4, any source incl. buddy chat) to host. The $1/day membership fee comes out of those earnings.
//  • Content type: "game" (scored, reward-eligible), or "stream"/"screen" (no score reward) — the latter require
//    HOSTING_ALLOW_NONGAME AND acknowledgement of the content policy (moderation/age/no-infringement).
//  • Timer: a session can be `timed` so the client shows a side timer for time-based competition.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const roomId = String(body?.room_id || "").slice(0, 128);
    if (!roomId) return Response.json({ error: "room_id required" }, { status: 400 });

    const enabled = snapBool("SESSION_HOSTING_ENABLED", false);
    const contentType = ["game", "stream", "screen"].includes(String(body?.content_type)) ? String(body.content_type) : "game";
    const title = String(body?.title || "").slice(0, 200);
    const timed = body?.timed === true;

    // Non-game hosting (streaming / screen mirroring) needs the content gate ON and a policy acknowledgement.
    if (contentType !== "game") {
      if (!snapBool("HOSTING_ALLOW_NONGAME", false)) {
        return Response.json({ ok: false, reason: "Streaming / screen mirroring is disabled (HOSTING_ALLOW_NONGAME off, pending moderation + counsel)." }, { status: 409 });
      }
      if (body?.content_policy_ack !== true) {
        return Response.json({ ok: false, reason: "content_policy_ack required — the host must accept the content policy (no illegal/infringing content, 18+, subject to moderation and takedown)." }, { status: 428 });
      }
    }

    // Earn-to-unlock check for the authenticated host.
    let unlock = { unlocked: true } as ReturnType<typeof hostingUnlockState> | { unlocked: boolean };
    if (enabled && snapBool("HOSTING_UNLOCK_ENABLED", false)) {
      const today = new Date().toISOString().slice(0, 10);
      const threshold = await getNumber("HOSTING_DAILY_EARN_UNLOCK_USD", 4);
      const fee = await getNumber("MEMBERSHIP_DAILY_FEE", 1);
      const rows = await base44.asServiceRole.entities.DailyEarnings.filter({ user_id: user.id, date: today }).catch(() => []) as Array<Record<string, unknown>>;
      unlock = hostingUnlockState({ earnedTodayUsd: sumDailyEarnings(rows), unlockThresholdUsd: threshold, membershipFeeUsd: fee });
      if (!unlock.unlocked) {
        return Response.json({
          ok: false, unlock_required: true, hosting: unlock,
          reason: `Earn $${(unlock as { remaining_to_unlock_usd: number }).remaining_to_unlock_usd?.toFixed?.(2) ?? ""} more today to unlock hosting (any earning counts, including buddy chat).`,
        }, { status: 402 });
      }
    }

    // Resolve which optional capabilities (record / remote_control / on_demand / clips) are available — the
    // intersection of what the host requested and what the operator has gated on.
    const caps = resolveCapabilities(Array.isArray(body?.capabilities) ? body.capabilities : [], {
      record: snapBool("HOSTING_RECORDING_ENABLED", false),
      remote_control: snapBool("HOSTING_REMOTE_CONTROL_ENABLED", false),
      on_demand: snapBool("HOSTING_ONDEMAND_ENABLED", false),
      clips: snapBool("HOSTING_CLIPS_ENABLED", false),
    });

    // Resolve the monetization mode. INVARIANT: users only ever receive Site Cash; businesses/sellers are paid
    // real money. Each mode is independently gated; a mode whose gate is off (or that needs counsel and isn't
    // approved) is refused here.
    const money = resolveMonetization(String(body?.monetization || "free"), {
      tournamentsSiteCash: snapBool("HOSTING_TOURNAMENTS_ENABLED", false),
      tournamentsRealMoney: snapBool("HOSTING_REAL_MONEY_TOURNAMENTS", false),
      paidAccess: snapBool("HOSTING_PAID_ACCESS_ENABLED", false),
      liveShopping: snapBool("HOSTING_LIVE_SHOPPING_ENABLED", false),
      platformSharePct: await getNumber("HOSTING_REVENUE_PLATFORM_PCT", 50),
    });
    if (!money.allowed) {
      return Response.json({ ok: false, reason: money.reason, monetization: String(body?.monetization || "free") }, { status: 409 });
    }

    const canHost = enabled;   // caller hosts when the feature is on and they passed the gates above
    const hostType: "peer" | "server" = canHost ? "peer" : "server";
    const sessionId = `sess_${roomId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (body.dry_run !== true) {
      await db.create("GameSession", {
        session_id: sessionId, room_id: roomId,
        content_type: contentType, title, timed,
        capabilities: caps.enabled,
        monetization: money.mode, monetization_policy: money.policy,
        host_type: hostType, host_player_id: hostType === "peer" ? String(user.id) : null,
        status: "active", started_by: user.email ?? user.id,
        player_ids: Array.isArray(body?.players) ? body.players.map((p: Record<string, unknown>) => String(p.id ?? "")).filter(Boolean) : [String(user.id)],
        started_at: new Date().toISOString(),
        rewarded: false,
      }, user.email ?? String(user.id)).catch(() => null);
    }

    return Response.json({
      ok: true, enabled, session_id: sessionId,
      content_type: contentType, title, timed,
      capabilities: caps.enabled, capabilities_disabled: caps.disabled,
      monetization: money.mode, monetization_policy: money.policy,
      host_type: hostType, host_player_id: hostType === "peer" ? String(user.id) : null,
      you_are_host: hostType === "peer",
      hosting: unlock,
      note: !enabled
        ? "Session hosting is off — server would host. Enable SESSION_HOSTING_ENABLED to let players host."
        : hostType === "peer"
          ? (contentType === "game"
              ? "You are hosting this game. Rewards still finalize only via sessionRewardValidate (server recomputes + caps)."
              : "You are hosting this " + contentType + ". No score reward on this path; content is subject to moderation.")
          : "Server is hosting this session.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
