# PlayEarning Nexus — Gambling→Skill/Merit conversion (round 7) source

> **Archive note (self-hosted era):** This is a Base44-era document. The snippets below still use `npm:@base44/sdk` and `base44/functions/…` / `base44/entities/…` paths. In the current self-hosted app these live under `backend/functions/…`, `backend/db/schema.sql` (tables), and import the local SDK shim instead. The *behavior* — an open, merit/performance-ranked contest with no random draw — is still current.

## `base44/functions/processWeeklyJackpot/entry.ts`

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Weekly OPEN, MERIT-BASED referral reward (formerly a random jackpot).
// Every participant earns in proportion to the VERIFIED, revenue-generating
// referrals they drove — no chance, and no one is excluded. The reward pool is
// self-funding: it is a share of the real revenue those referrals produced, so
// the platform always keeps a margin (adds to the bottom line).
const TOP_BONUS_FRACTION = 0.3;             // 30% of pool rewards the leaders...
const TOP_SPLIT = [0.5, 0.3, 0.2];          // ...split across the top 3.
// Remaining 70% is paid proportionally to every participant's verified contribution.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const periodStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const records = await base44.asServiceRole.entities.ReferralJackpot.filter({
      created_date: { $gte: periodStart }, status: 'active',
    });
    if (!records.length) return Response.json({ message: 'No active participants this period' });

    const settings = await base44.asServiceRole.entities.GlobalSettings.list().catch(() => []);
    const platformContribution = settings[0]?.weekly_jackpot_amount || 0;
    const fundingRate = records[0].pool_funding_rate ?? 0.4;

    // Aggregate participants and their performance points + any entry fees paid.
    const byUser: Record<string, { points: number; email: string; fees: number }> = {};
    for (const r of records) {
      if (!r.user_id) continue;
      if (!byUser[r.user_id]) byUser[r.user_id] = { points: 0, email: r.user_email, fees: 0 };
      byUser[r.user_id].points += r.jackpot_entries_earned || 0;
      byUser[r.user_id].fees += r.entry_fee_paid || 0;
    }

    // For each participant, compute VERIFIED revenue their referrals drove this period.
    // This is both the merit metric and the funding source (quality-gated = anti-fraud).
    const participants = [];
    let totalRevenue = 0;
    let totalFees = 0;
    for (const [userId, d] of Object.entries(byUser)) {
      let revenue = 0;
      let conversions = 0;
      try {
        const refs = await base44.asServiceRole.entities.Referral.filter({ referrer_user_id: userId });
        for (const ref of refs) {
          const converted = ref.status === 'converted' || ref.status === 'completed' || ref.status === 'active';
          if (!converted) continue;
          conversions++;
          revenue += (ref.commission_earned || 0) + (ref.ppc_bitlabs_earnings || 0);
        }
      } catch { /* fall back to points below */ }
      // Merit value: real revenue if we have it, otherwise performance points.
      const value = revenue > 0 ? revenue : d.points;
      participants.push({ userId, email: d.email, points: d.points, revenue, conversions, value });
      totalRevenue += revenue;
      totalFees += d.fees;
    }

    // Rank by merit (deterministic — no randomness).
    participants.sort((a, b) => b.value - a.value);
    const totalValue = participants.reduce((s, p) => s + p.value, 0);
    if (totalValue <= 0) return Response.json({ message: 'No verified performance to reward yet' });

    // Self-funding pool: a share of verified revenue + platform contribution + entry fees.
    // Platform keeps (1 - fundingRate) of the referral revenue as margin.
    const pool = Math.round((totalRevenue * fundingRate + platformContribution + totalFees) * 100) / 100;
    const topBonus = pool * TOP_BONUS_FRACTION;
    const proportionalPool = pool - topBonus;

    // Compute each participant's prize: proportional share for ALL, plus a top-3 bonus.
    const prizes: Record<string, number> = {};
    for (const p of participants) {
      prizes[p.userId] = (proportionalPool * (p.value / totalValue));
    }
    for (let i = 0; i < Math.min(3, participants.length); i++) {
      prizes[participants[i].userId] += topBonus * TOP_SPLIT[i];
    }

    // Pay everyone who earned a positive amount (open opportunity, merit-based).
    const winners = [];
    let paidCount = 0;
    let paidTotal = 0;
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      const prize = Math.round((prizes[p.userId] || 0) * 100) / 100;
      if (prize <= 0) continue;
      let u: any = null;
      try { u = await base44.asServiceRole.entities.User.get(p.userId); } catch { /* ignore */ }
      const email = u?.email || p.email;
      try {
        await base44.asServiceRole.functions.invoke('paypalPayout', {
          recipient_email: email, amount: prize,
          payout_type: 'referral_performance_reward',
          description: `Weekly Referral Performance Reward — rank #${i + 1}, ${p.conversions} verified conversions`,
        });
      } catch { /* may queue; still record */ }
      paidCount++; paidTotal += prize;
      if (i < 10) winners.push({ user_id: p.userId, user_name: u?.full_name || '', rank: i + 1, score: Math.round(p.value * 100) / 100, prize_amount: prize });
      if (i < 3 && email) {
        try {
          await base44.integrations.Core.SendEmail({
            to: email,
            subject: `🏆 You placed #${i + 1} in the Weekly Referral Program — $${prize}`,
            body: `You finished rank #${i + 1} by the verified value of the referrals you drove ($${Math.round(p.revenue * 100) / 100} in tracked revenue, ${p.conversions} conversions) and earned $${prize}. Everyone who drives real referrals earns a share — decided by performance, never luck.`,
          });
        } catch { /* non-fatal */ }
      }
    }

    try {
      await base44.asServiceRole.entities.ReferralJackpot.update(records[0].id, {
        status: 'paid_out', is_skill_based: true, open_to_all: true,
        ranking_metric: 'verified_referral_revenue',
        prize_pool: pool, payout_amount: paidTotal, winners,
        winner_user_id: winners[0]?.user_id, winner_name: winners[0]?.user_name, winner_entries: winners[0]?.score,
        completed_date: new Date().toISOString(), paid_at: new Date().toISOString(),
      });
    } catch { /* non-fatal */ }

    return Response.json({
      success: true, merit_based: true, open_to_all: true,
      prize_pool: pool, verified_revenue: Math.round(totalRevenue * 100) / 100,
      platform_margin_kept: Math.round(totalRevenue * (1 - fundingRate) * 100) / 100,
      participants_paid: paidCount, total_paid: Math.round(paidTotal * 100) / 100,
      top_finishers: winners,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
```

## `base44/functions/enterSkillTournament/entry.ts`

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Pays the entry fee to join the current weekly SKILL tournament. The fee is
// deducted from the user's balance and added to the prize pool. Winners are
// still determined by performance ranking (processWeeklyJackpot) — never chance.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Find the current active tournament to read its entry fee.
    const actives = await base44.asServiceRole.entities.ReferralJackpot.filter({ status: 'active' }, '-created_date', 1);
    const tournament = actives[0];
    const entryFee = tournament?.entry_fee ?? 0;

    // Prevent paying twice.
    const mine = await base44.asServiceRole.entities.ReferralJackpot.filter({ status: 'active', user_id: user.id, is_paid_entry: true });
    if (mine.length > 0) {
      return Response.json({ error: 'You have already entered this tournament', already_entered: true }, { status: 409 });
    }

    // Charge the entry fee from the user's virtual currency balance.
    if (entryFee > 0) {
      const balance = user.virtual_currency || 0;
      if (balance < entryFee) {
        return Response.json({ error: 'Insufficient balance for entry fee', entry_fee: entryFee, balance }, { status: 402 });
      }
      await base44.asServiceRole.entities.User.update(user.id, { virtual_currency: balance - entryFee });
    }

    // Record the paid entry (also counts as a performance point) and grow the pool.
    const now = new Date().toISOString();
    await base44.asServiceRole.entities.ReferralJackpot.create({
      period: tournament?.period || now.slice(0, 7),
      status: 'active',
      is_skill_based: true,
      ranking_metric: 'performance_score',
      user_id: user.id,
      user_email: user.email,
      jackpot_entries_earned: 1,
      entry_fee_paid: entryFee,
      is_paid_entry: true,
    });

    // Keep a running prize pool on the lead tournament record.
    if (tournament?.id) {
      try {
        await base44.asServiceRole.entities.ReferralJackpot.update(tournament.id, {
          prize_pool: (tournament.prize_pool || tournament.jackpot_amount || 0) + entryFee,
        });
      } catch { /* non-fatal */ }
    }

    return Response.json({
      success: true,
      entry_fee: entryFee,
      remaining_balance: entryFee > 0 ? (user.virtual_currency || 0) - entryFee : (user.virtual_currency || 0),
      note: 'You are entered. Winners are ranked by performance — no luck involved.',
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to enter tournament' }, { status: 500 });
  }
});
```

## `base44/entities/ReferralJackpot.jsonc`

```jsonc
{
  "name": "ReferralJackpot",
  "type": "object",
  "description": "Weekly SKILL-BASED referral tournament (formerly a random jackpot). Winners are ranked by performance score, never chance. An optional entry fee funds the prize pool. Entity name retained for backward compatibility across the app.",
  "properties": {
    "period": {
      "type": "string",
      "description": "e.g. 2026-Q1"
    },
    "status": {
      "type": "string",
      "enum": [
        "active",
        "paid_out",
        "completed",
        "cancelled"
      ],
      "default": "active"
    },
    "is_skill_based": {
      "type": "boolean",
      "default": true,
      "description": "Winners are determined by performance ranking, not a random draw"
    },
    "ranking_metric": {
      "type": "string",
      "default": "verified_referral_revenue",
      "description": "Merit metric: participants ranked by the verified, revenue-generating referrals they drive. Open to all; outcome tracks ability, not chance."
    },
    "open_to_all": {
      "type": "boolean",
      "default": true,
      "description": "Every user can participate and earn purely on performance — no entry fee required to earn from your own referrals"
    },
    "pool_funding_rate": {
      "type": "number",
      "default": 0.4,
      "description": "Share of the verified referral-driven revenue paid into the reward pool. The platform keeps the remainder as margin, so the program is always net-positive."
    },
    "distribution_model": {
      "type": "string",
      "default": "proportional_plus_top_bonus",
      "description": "Most of the pool is paid proportionally to each participant's verified contribution (everyone who performs earns); a top-rank bonus rewards the leaders."
    },
    "revenue_driven": {
      "type": "number",
      "default": 0,
      "description": "Verified revenue this participant's referrals generated in the period"
    },
    "verified_conversions": {
      "type": "number",
      "default": 0,
      "description": "Count of this participant's referrals that converted (quality-gated, anti-fraud)"
    },
    "entry_fee": {
      "type": "number",
      "default": 0,
      "description": "Optional fee to enter the skill tournament; entry fees fund the prize pool"
    },
    "prize_pool": {
      "type": "number",
      "default": 0,
      "description": "Total prize pool = platform contribution + collected entry fees"
    },
    "payout_places": {
      "type": "number",
      "default": 3,
      "description": "Number of top-ranked finishers who share the prize pool"
    },
    "jackpot_amount": {
      "type": "number",
      "default": 0,
      "description": "Platform contribution to the prize pool"
    },
    "user_id": {
      "type": "string",
      "description": "Participant this entry record belongs to"
    },
    "user_email": {
      "type": "string"
    },
    "jackpot_entries_earned": {
      "type": "number",
      "default": 0,
      "description": "Performance points earned (referrals/shares) — the skill ranking metric"
    },
    "entry_fee_paid": {
      "type": "number",
      "default": 0
    },
    "is_paid_entry": {
      "type": "boolean",
      "default": false
    },
    "total_entries": {
      "type": "number",
      "default": 0
    },
    "winners": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "user_id": { "type": "string" },
          "user_name": { "type": "string" },
          "rank": { "type": "number" },
          "score": { "type": "number" },
          "prize_amount": { "type": "number" }
        }
      },
      "default": [],
      "description": "Top-ranked finishers and their prizes"
    },
    "winner_user_id": { "type": "string" },
    "winner_name": { "type": "string" },
    "winner_entries": { "type": "number", "default": 0 },
    "payout_amount": { "type": "number", "default": 0 },
    "paid_at": { "type": "string", "format": "date-time" },
    "completed_date": { "type": "string", "format": "date-time" },
    "entry_breakdown": {
      "type": "object",
      "additionalProperties": true,
      "description": "user_id -> performance points"
    }
  },
  "required": [
    "period"
  ]
}
```

_(The React components `JackpotWidget.jsx`, `ReferralMilestoneJackpot.jsx`, and the `ContestEntries.jsx` page that accompany this conversion are preserved in full inside the codebase and in `FULL-CODEBASE.txt`. Their current, self-hosted versions import from `@/api/base44Client` — the local client — rather than the Base44 SDK.)_
