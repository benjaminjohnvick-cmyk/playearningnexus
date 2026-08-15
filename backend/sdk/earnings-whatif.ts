// earnings-whatif.ts — the user's OWN "what-if" earnings scenario. The compliant replacement for
// platform-made earnings_projections.
//
// The USER supplies the assumptions (a target, or how many minutes/day and for how long). The scenario is
// computed ONLY from their own actual earning history and the site's own per-minute rate, and every result
// is labeled "your scenario — not a prediction or promise." The platform asserts nothing about what anyone
// will earn; it just does the arithmetic on numbers the user chose. That is the difference between an
// unlawful earnings CLAIM and a lawful user-run calculator. See EARNINGS-WHATIF.md.
import { isEnabled } from "./feature-flags.ts";
import { getNumber, getString } from "./settings.ts";
import { earnHistory } from "./goods-advance.ts";
import { earnRateUsdPerMin, earnDailyCapUsd } from "./earn-rate.ts";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export interface WhatIfConfig { enabled: boolean; windowDays: number; disclaimer: string; }

export async function earningsWhatIfConfig(jurisdiction?: string | null): Promise<WhatIfConfig> {
  return {
    enabled: await isEnabled("earnings_whatif", jurisdiction ?? null),
    windowDays: await getNumber("EARNINGS_WHATIF_WINDOW_DAYS", 90),
    disclaimer: await getString("EARNINGS_WHATIF_DISCLAIMER", "This is your own what-if scenario based on your past activity — not a prediction, promise, or guarantee of future earnings. Results vary."),
  };
}

export interface WhatIfInputs { target_usd?: number; minutes_per_day?: number; days?: number; }

export interface WhatIfResult {
  based_on: {                    // the user's OWN facts the scenario stands on
    your_recent_daily_usd: number;   // their real recent average
    your_active_days: number;
    site_rate_per_min_usd: number;   // the site's per-minute rate for them
    daily_cap_usd: number;
  };
  assumptions: { minutes_per_day: number | null; days: number | null; target_usd: number | null };
  scenario: {
    daily_usd: number;           // the daily figure the scenario uses (their pace, or their chosen minutes)
    days_to_target: number | null;
    total_over_days: number | null;
  };
  disclaimer: string;
  is_claim: false;               // explicit: this is never a platform earnings claim
}

// Pure calculation over the user's own inputs + their own history. No promises, no aggregates from others.
export function computeWhatIf(hist: { avgDailyUsd: number; activeDays: number }, isPremium: boolean, inputs: WhatIfInputs, cfg: WhatIfConfig): WhatIfResult {
  const perMin = earnRateUsdPerMin(isPremium);
  const cap = earnDailyCapUsd(isPremium);
  const minutes = inputs.minutes_per_day != null ? Math.max(0, Number(inputs.minutes_per_day)) : null;
  const days = inputs.days != null ? Math.max(0, Math.round(Number(inputs.days))) : null;
  const target = inputs.target_usd != null ? Math.max(0, Number(inputs.target_usd)) : null;

  // The scenario's daily figure: if the user chose minutes/day, use their chosen effort × the site rate
  // (capped by the daily cap); otherwise use their OWN recent daily average.
  const dailyUsd = minutes != null ? round2(Math.min(cap, minutes * perMin)) : round2(hist.avgDailyUsd);
  const daysToTarget = target != null && dailyUsd > 0 ? Math.ceil(target / dailyUsd) : null;
  const totalOverDays = days != null ? round2(dailyUsd * days) : null;

  return {
    based_on: {
      your_recent_daily_usd: round2(hist.avgDailyUsd),
      your_active_days: hist.activeDays,
      site_rate_per_min_usd: round2(perMin),
      daily_cap_usd: round2(cap),
    },
    assumptions: { minutes_per_day: minutes, days, target_usd: target },
    scenario: { daily_usd: dailyUsd, days_to_target: daysToTarget, total_over_days: totalOverDays },
    disclaimer: cfg.disclaimer,
    is_claim: false,
  };
}

export async function userWhatIf(userId: string, isPremium: boolean, inputs: WhatIfInputs, jurisdiction?: string | null): Promise<WhatIfResult> {
  const cfg = await earningsWhatIfConfig(jurisdiction);
  const hist = await earnHistory(userId, cfg.windowDays);
  return computeWhatIf(hist, isPremium, inputs, cfg);
}
