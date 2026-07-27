// Per-user AI + survey data profile.
//
// Each user gets a compiled UserAIProfile — a rolling summary of their behavior, spend, engagement,
// survey honesty, and satisfaction — that the personalization layer reads to give custom
// recommendations and AI chatbot conversations aimed at driving engagement and purchases.

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Compile (upsert) a user's AI profile from their real activity. Returns the profile doc. */
export async function compileProfile(base44: any, userId: string): Promise<Record<string, unknown>> {
  const [user] = await base44.asServiceRole.entities.User.filter({ id: userId });
  if (!user) throw new Error("User not found");

  const [orders, earnings, ratings, honesty] = await Promise.all([
    base44.asServiceRole.entities.Order.filter({ user_id: userId }).catch(() => []),
    base44.asServiceRole.entities.DailyEarnings.filter({ user_id: userId }).catch(() => []),
    base44.asServiceRole.entities.SessionRating.filter({ user_id: userId }).catch(() => []),
    base44.asServiceRole.entities.SurveyHonestyAnalysis.filter({ user_id: userId }).catch(() => []),
  ]);

  const spend = orders.reduce((s: number, o: any) => s + (Number(o.amount) || 0), 0);
  const surveys = earnings.reduce((s: number, e: any) => s + (Number(e.total_surveys_completed) || 0), 0);
  const last7 = earnings.filter((e: any) => (e.date || "") >= new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const activeDaysL7 = new Set(last7.map((e: any) => e.date)).size;
  const avgSiteRating = ratings.length ? round2(ratings.reduce((s: number, r: any) => s + (Number(r.site_rating) || 0), 0) / ratings.length) : null;
  const honestyScores = honesty.map((h: any) => Number(h.honesty_score)).filter((n: number) => Number.isFinite(n));
  const avgHonesty = honestyScores.length ? round2(honestyScores.reduce((a: number, b: number) => a + b, 0) / honestyScores.length) : null;

  const totalEarn = Number(user.total_earnings) || 0;
  const engagementScore = Math.min(1, activeDaysL7 / 7);
  const purchaseAffinity = spend > 0 ? Math.min(1, spend / 100) : Math.min(0.5, totalEarn / 200);

  let segment = "new";
  if (spend > 100 || totalEarn > 200) segment = "whale";
  else if (activeDaysL7 >= 4) segment = "active";
  else if (activeDaysL7 === 0 && (Number(user.account_age_days) || 0) > 7) segment = "at_risk";
  else if (surveys > 0 || totalEarn > 0) segment = "engaged";

  const profile = {
    user_id: userId,
    full_name: user.full_name ?? null,
    segment,
    lifetime_spend: round2(spend),
    total_earnings: round2(totalEarn),
    surveys_completed: surveys,
    active_days_last7: activeDaysL7,
    engagement_score: round2(engagementScore),
    purchase_affinity: round2(purchaseAffinity),
    avg_site_rating: avgSiteRating,
    avg_survey_honesty: avgHonesty,
    balance: Number(user.current_balance) || 0,
    summary: `${segment} user · $${round2(totalEarn)} earned · ${surveys} surveys · ${activeDaysL7}/7 active days · $${round2(spend)} spent`,
    updated_at: new Date().toISOString(),
  };

  const existing = await base44.asServiceRole.entities.UserAIProfile.filter({ user_id: userId }).catch(() => []);
  if (existing.length) await base44.asServiceRole.entities.UserAIProfile.update(existing[0].id, profile);
  else await base44.asServiceRole.entities.UserAIProfile.create(profile);
  return profile;
}
