import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";
import { earnHookEnabled, normalizeReminderTime } from "../../sdk/earn-hook.ts";

// earnHookSetPrefs (authenticated) — the user sets their hook preferences: "open straight to earn" (the widget
// one-tap option), and the daily earn reminder opt-in + the time THEY pick. Opting into the reminder is logged
// in the consent ledger (a requested-reminder record). Turning the reminder off is always allowed and logged.
// No auto-anything is set here — this only stores the user's own choices.
//   { open_straight_to_earn?, reminder_opt_in?, reminder_time? } → { ok, prefs } | { error }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!earnHookEnabled()) return Response.json({ error: "This feature isn't available right now." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const uid = String(user.id);
    const patch: Record<string, unknown> = {};

    if (body.open_straight_to_earn !== undefined) patch.earn_hook_open_straight_to_earn = body.open_straight_to_earn === true;
    if (body.continuous_opt_in !== undefined) patch.earn_continuous_opt_in = body.continuous_opt_in === true;

    let reminderChanged = false;
    let reminderOptIn: boolean | undefined;
    if (body.reminder_opt_in !== undefined) {
      reminderOptIn = body.reminder_opt_in === true;
      patch.earn_reminder_opt_in = reminderOptIn;
      reminderChanged = true;
      if (!reminderOptIn) patch.earn_reminder_time = null; // opting out clears the scheduled time
    }
    if (body.reminder_time !== undefined && body.reminder_time !== null) {
      const t = normalizeReminderTime(body.reminder_time);
      if (!t) return Response.json({ error: "Reminder time must be HH:MM (24-hour)." }, { status: 400 });
      patch.earn_reminder_time = t;
      // Setting a time implies opting in to that one reminder.
      if (patch.earn_reminder_opt_in === undefined) { patch.earn_reminder_opt_in = true; reminderOptIn = true; reminderChanged = true; }
    }

    if (Object.keys(patch).length === 0) return Response.json({ error: "Nothing to update." }, { status: 400 });

    await db.update("User", uid, patch).catch(() => null);

    // Log reminder opt-in/out to the consent ledger (a reminder the user requested / withdrew).
    if (reminderChanged) {
      await recordConsent({
        user_id: uid, kind: "earn_reminder_optin", version: "v1", accepted: reminderOptIn === true,
        shown: { time: patch.earn_reminder_time ?? null }, meta: { source: "earn_hook" },
      }).catch(() => null);
    }

    return Response.json({
      ok: true,
      prefs: {
        open_straight_to_earn: patch.earn_hook_open_straight_to_earn ?? (user as Record<string, unknown>).earn_hook_open_straight_to_earn === true,
        reminder_opt_in: patch.earn_reminder_opt_in ?? (user as Record<string, unknown>).earn_reminder_opt_in === true,
        reminder_time: (patch.earn_reminder_time ?? (user as Record<string, unknown>).earn_reminder_time) || null,
        continuous_opt_in: patch.earn_continuous_opt_in ?? (user as Record<string, unknown>).earn_continuous_opt_in === true,
      },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
