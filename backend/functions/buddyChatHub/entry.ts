import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { snapBool } from "../../sdk/settings.ts";
import { bookingEnabled } from "../../sdk/buddy-schedule.ts";
import { profileBrowseEnabled } from "../../sdk/buddy-profile.ts";

// buddyChatHub — tells the Buddy Chat client which actions to show in its "＋" menu, so the AI Social Shop and the
// four hosting options live inside Buddy Chat instead of separate screens. Pure gate-reading; the client renders
// the enabled actions. The whole hub is behind BUDDYCHAT_SOCIAL_SHOP_ENABLED; each individual action is also
// governed by its own feature gate (built earlier this session), so an action only appears when BOTH are on.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const hubOn = snapBool("BUDDYCHAT_SOCIAL_SHOP_ENABLED", false);
    if (!hubOn) {
      return Response.json({ ok: true, hub_enabled: false, actions: [], note: "Buddy Chat social hub is off (BUDDYCHAT_SOCIAL_SHOP_ENABLED)." });
    }

    const sessionHosting = snapBool("SESSION_HOSTING_ENABLED", false);
    const actions = [
      { key: "shop", label: "Shop", enabled: true, calls: "socialShopTopTen", desc: "Browse the AI Social Shop (top sellers + catalog) inline." },
      { key: "host_game", label: "Host a game", enabled: sessionHosting && snapBool("HOSTING_TOURNAMENTS_ENABLED", false), calls: "sessionHostAssign", monetization: "tournament_sitecash", desc: "Skill tournament with Site-Cash prizes." },
      { key: "paid_access", label: "Paid content", enabled: sessionHosting && snapBool("HOSTING_PAID_ACCESS_ENABLED", false), calls: "sessionHostAssign", monetization: "access_donation", desc: "Virtual content via Site-Cash donation or a survey." },
      { key: "sell", label: "Sell / Live shopping", enabled: sessionHosting && snapBool("HOSTING_LIVE_SHOPPING_ENABLED", false), calls: "sessionHostAssign", monetization: "live_shopping_5050", desc: "Sell products; buyers pay Site Cash, Facebook-style seller fee." },
      { key: "stream", label: "Stream / Screen", enabled: sessionHosting && snapBool("HOSTING_ALLOW_NONGAME", false), calls: "sessionHostAssign", content_type: "screen", desc: "Live stream or screen-mirror (moderated)." },
      { key: "go_live", label: "Go live (omni-channel)", enabled: sessionHosting && snapBool("HOSTING_SOCIAL_SIMULCAST_ENABLED", false), calls: "sessionSimulcast", desc: "Simulcast to your connected social accounts." },
      { key: "survey_test", label: "Test it first", enabled: snapBool("SURVEY_TEST_FIRST_ENABLED", false), calls: "surveyTestCreate", desc: "Unsure? Run a free validation survey before you sell or host." },
      // Book the next session (available to every tier). "Schedule next chat" reunites you with buddies who pick
      // the same moment; "Schedule with a new buddy" auto-matches a fresh, KYC-compatible partner for tomorrow.
      { key: "schedule_next", label: "Schedule next chat", enabled: bookingEnabled(), calls: "buddyScheduleNext", body_hint: { match_preference: "any" }, desc: "Pick a local time to meet again tomorrow — Buddy Chat auto-opens then, and cross-timezone buddies are lined up on the same moment." },
      { key: "schedule_new", label: "Schedule with a new buddy", enabled: bookingEnabled(), calls: "buddyScheduleNext", body_hint: { with_new_user: true }, desc: "Book tomorrow with a NEW buddy, auto-matched to your interests from your first (KYC) survey." },
      // Browse other members' interest profiles (built from the KYC survey) and pick your own match.
      { key: "browse_buddies", label: "Browse & pick a buddy", enabled: profileBrowseEnabled(), calls: "buddyProfileBrowse", then: "buddyPickMatch", desc: "Browse members by shared interests (first name + interests only) and pick your own buddy — invite now or schedule for tomorrow." },
    ];

    return Response.json({
      ok: true, hub_enabled: true,
      actions: actions.filter((a) => a.enabled),
      all_actions: actions,   // include disabled ones (grayed) so the UI can show what's available to turn on
      note: "Buddy Chat hub — Shop, Host, Go Live, and Test-first live here. Each action respects its own gate.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
