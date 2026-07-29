import { __handler } from "../../sdk/runtime.ts";
import { createClientFromRequest } from "../../sdk/mod.ts";
import { getNumber, getString } from "../../sdk/settings.ts";
import {
  annualEarnCeiling, gridAnnualPrice, businessAdCreditUsd, socialPostingOrderTarget, usdToPoints,
  upfrontGrantEnabled, surveyMinutesPerDay, surveyCommitmentDays,
} from "../../sdk/premium-ppc.ts";

// premiumPPCOffer (public) — the advertised offer, in REAL DOLLARS, plus the point equivalents and the
// required disclaimer. Advertise the $ figures; disclose that value is delivered as closed-loop points
// (1¢ each) spendable at any store through the site — NOT withdrawable as cash.
export default __handler(async (req) => {
  try {
    // Public: no auth required, but keep the same client shape.
    createClientFromRequest(req);
    const cents = Math.max(1, await getNumber("POINT_VALUE_CENTS", 1));
    const userUsd = annualEarnCeiling();          // $1,460
    const gridUsd = gridAnnualPrice();            // $5,000
    const adCreditUsd = businessAdCreditUsd();    // $10,000
    const doubleUsd = socialPostingOrderTarget(); // $10,000

    const disclaimer =
      `Dollar amounts show value only. Value is delivered as points (1 point = ${cents}¢) — a closed-loop ` +
      `store credit spendable at any store through the site, and is NOT withdrawable as cash. ` +
      `The member advance requires completing ~${surveyMinutesPerDay()} minutes of surveys per day for ` +
      `${surveyCommitmentDays()} days (flexible catch-up); nothing is ever repaid or charged. Advertisers' ` +
      `free advertising continues at no additional cost until they've received $${doubleUsd.toLocaleString()} ` +
      `in orders (double their investment); after that, earnings are points spendable on anything via the site.`;

    const terms_version = await getString("TERMS_VERSION", "2026-07-01");
    return Response.json({
      upfront: upfrontGrantEnabled(),
      terms_version,
      member: {
        headline_usd: userUsd,
        headline_points: usdToPoints(userUsd, cents),
        commitment_days: surveyCommitmentDays(),
        minutes_per_day: surveyMinutesPerDay(),
      },
      business: {
        fee_usd: gridUsd,
        ad_credit_usd: adCreditUsd,
        ad_credit_points: usdToPoints(adCreditUsd, cents),
        free_until_orders_usd: doubleUsd,
        free_until_orders_points: usdToPoints(doubleUsd, cents),
      },
      point_value_cents: cents,
      disclaimer,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
