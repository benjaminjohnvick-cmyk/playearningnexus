import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

/**
 * AUTO REFERRAL CONTEST — DAILY, END TO END
 *
 * Runs every day and manages the whole weekly rotating-platform referral contest
 * with legal/ethical guardrails baked in:
 *   1. Lifecycle: conclude the finished week + open the next (rotated) platform.
 *   2. Compliant auto-posting: ONLY for users who have explicitly connected the
 *      account (OAuth), enabled auto_posting, and accepted the agreement, and only
 *      within platform rate limits. Every post carries an FTC #ad disclosure.
 *      Everyone else just gets an optional reminder — never a forced/silent post.
 *   3. Fairness: sweep-credit any rewards pending longer than the grace period so
 *      earned money is never forfeited.
 *   4. Audit: log the run.
 */
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const RATE_LIMIT_HOURS = 12;   // matches autoSocialPostingAndTracking
const GRACE_DAYS = 30;

export default __handler(async (req) => {
  const started = Date.now();
  const actions: string[] = [];
  const errors: string[] = [];
  let autoPosted = 0;
  let reminded = 0;

  try {
    const base44 = createClientFromRequest(req);

    const call = async (fn: string, payload: any = {}) => {
      try { const r = await base44.asServiceRole.functions.invoke(fn, payload); actions.push(`invoked ${fn}`); return r; }
      catch (e) { errors.push(`${fn}: ${e?.message || 'failed'}`); return null; }
    };

    // ---- 1. Lifecycle: conclude finished week, ensure a fresh campaign is open ----
    await call('concludeWeeklyReferralCampaign', {});
    let actives = await base44.asServiceRole.entities.WeeklyReferralCampaign.filter({ status: 'active' }, '-created_date', 1);
    if (actives.length === 0) {
      await call('generateWeeklyReferralCampaign', {});
      actives = await base44.asServiceRole.entities.WeeklyReferralCampaign.filter({ status: 'active' }, '-created_date', 1);
    }
    const campaign = actives[0];
    if (!campaign) {
      return Response.json({ success: false, reason: 'No active campaign could be established', errors });
    }
    const platform = campaign.platform;
    const disclosure = campaign.disclosure_text || '#ad';

    // ---- 2. Compliant auto-posting for OPTED-IN, CONNECTED users only ----
    let connections: any[] = [];
    try {
      connections = await base44.asServiceRole.entities.SocialMediaConnection.filter({
        is_active: true, auto_posting_enabled: true, platform,
      });
    } catch { /* entity optional */ }

    const now = Date.now();
    for (const conn of connections) {
      try {
        // Consent gate: require an accepted user agreement (ULA) to auto-post.
        const nodes = await base44.asServiceRole.entities.MLMNode.filter({ user_id: conn.user_id, accepted_ula: true });
        if (nodes.length === 0) continue;

        // Rate limit.
        const last = conn.last_post_at ? new Date(conn.last_post_at).getTime() : 0;
        if (last && (now - last) / (1000 * 60 * 60) < RATE_LIMIT_HOURS) continue;

        // Skip if we already logged a contest post for this user this week.
        const already = await base44.asServiceRole.entities.ReferralPostEntry.filter({ campaign_id: campaign.id, user_id: conn.user_id });
        if (already.length > 0) continue;

        // Post through the existing compliant affiliate-posting path, with disclosure.
        await call('generateAndPostAffiliateAds', { user_id: conn.user_id, platform, disclosure, require_disclosure: true, source: 'weekly_referral_contest' });

        // Record the contest entry (reward pending until next survey / grace sweep).
        const usr = await base44.asServiceRole.entities.User.filter({ id: conn.user_id }).then((u: any) => u[0]).catch(() => null);
        const isBusiness = usr && (usr.account_type === 'business' || usr.is_business === true || usr.role === 'business_client' || !!usr.business_client_id);
        await base44.asServiceRole.entities.ReferralPostEntry.create({
          campaign_id: campaign.id, user_id: conn.user_id, user_name: usr?.full_name || '',
          week_of: campaign.week_of, platform, track: isBusiness ? 'business_referral' : 'user_referral',
          post_url: '', referral_code: usr?.referral_code || '', was_doubled: false,
          reward_amount: campaign.reward_per_post || 0.1, reward_pending: true, reward_credited: false,
          conversions: 0, commission_earned: 0,
        });
        autoPosted++;
      } catch (e) { errors.push(`autopost ${conn.user_id}: ${e?.message || 'failed'}`); }
    }

    // ---- 2b. Optional reminder for users who are NOT opted into auto-posting ----
    // (Bounded; never posts on their behalf — participation stays voluntary.)
    try {
      const optedInIds = new Set(connections.map((c) => c.user_id));
      const recent = await base44.asServiceRole.entities.User.list('-updated_date', 200);
      for (const u of recent) {
        if (optedInIds.has(u.id)) continue;
        const has = await base44.asServiceRole.entities.ReferralPostEntry.filter({ campaign_id: campaign.id, user_id: u.id });
        if (has.length > 0) continue;
        await base44.asServiceRole.entities.Notification.create({
          user_id: u.id,
          title: `This week's referral challenge (${platform})`,
          message: `Post your referral on ${platform} with #ad to earn $0.10 + commission. Optional — post yourself or connect your account to automate it.`,
          notification_type: 'weekly_referral_reminder',
          related_entity_id: campaign.id,
        });
        reminded++;
        if (reminded >= 200) break;
      }
    } catch { /* optional */ }

    // ---- 3. Fairness sweep: auto-credit long-pending rewards ----
    const swept = await call('creditPendingReferralPostRewards', { grace_days: GRACE_DAYS });

    // ---- 4. Audit log ----
    try {
      await base44.asServiceRole.entities.EcosystemRunLog.create({
        run_at: new Date().toISOString(), trigger: 'scheduled',
        status: errors.length === 0 ? 'completed' : 'partial',
        data_snapshot: JSON.stringify({ platform, connections: connections.length, auto_posted: autoPosted, reminded }),
        insights: `Daily referral contest: ${autoPosted} compliant auto-posts, ${reminded} reminders, ${swept?.credited_count || 0} rewards swept-credited.`,
        actions, errors, duration_ms: Date.now() - started,
      });
    } catch { /* optional */ }

    return Response.json({
      success: true, platform, auto_posted: autoPosted, reminded,
      rewards_swept: swept?.credited_count || 0, errors, duration_ms: Date.now() - started,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Daily referral automation failed', errors }, { status: 500 });
  }
});
