// Admin settings layer — makes prices, rates, thresholds, and toggles adjustable from the admin
// panel WITHOUT a deploy. Mirrors the compliance feature-flag pattern (feature-flags.ts): a DB
// override wins over the environment variable, which wins over a built-in default.
//
//   Resolution order (first match wins):
//     1. DB override  (GlobalSettings entity, keyed by `key`)   ← admins edit these in the panel
//     2. Environment variable  (def.env, defaults to the key name)
//     3. Built-in default (REGISTRY below)
//
// Consumers read a setting at REQUEST TIME with getNumber/getBool/getString so a panel change
// takes effect immediately (subject to a short cache). Flags (card_charging, cash_out, …) stay in
// feature-flags.ts / complianceFlags — this module is for numeric/string/select values.
import { db } from "./db.ts";

export type SettingType = "number" | "boolean" | "string" | "select";

export interface SettingDef {
  key: string;              // canonical key — matches the env var name where one exists
  label: string;
  category: string;
  type: SettingType;
  default: string;          // stored/compared as a string; coerced by type on read
  env?: string;             // env var name (defaults to `key`)
  unit?: string;            // "$", "%", "days", "cents", "×"
  options?: string[];       // for type: "select"
  help?: string;
  sensitive?: boolean;      // legal/financial — panel requires an extra confirm + audit
  min?: number;             // for type: "number" — reject saves below this (enforced in coerce)
  max?: number;             // for type: "number" — reject saves above this
}

// ---------------------------------------------------------------------------------------------
// THE REGISTRY — every admin-adjustable value. Grounded in backend/.env.example and the SDK
// config. Keys that already have an env var use the SAME name so DB→env→default all line up.
// (Compliance kill-switches live in feature-flags.ts and are edited via complianceFlags.)
// ---------------------------------------------------------------------------------------------
export const REGISTRY: SettingDef[] = [
  // 1. Economy & payouts
  { key: "STORE_MARKUP", label: "Store markup (regular users)", category: "Economy & Payouts", type: "number", default: "0", unit: "×", help: "Fraction added to catalog price for regular users. Set to 0 — NO markup for any user. Revenue comes from the business side (advertisers, spreads, breakage), never a customer markup.", sensitive: true, min: 0, max: 1 },
  { key: "POINT_VALUE_CENTS", label: "Point value", category: "Economy & Payouts", type: "number", default: "1", unit: "cents", help: "Cents per point for catalog pricing (like Swagbucks).", min: 0 },
  { key: "POINTS_CASHABLE", label: "Points cashable", category: "Economy & Payouts", type: "boolean", default: "0", help: "OFF = closed-loop, catalog-only (preserves money-transmitter protection). Leave OFF unless your lawyer clears it.", sensitive: true },
  { key: "MIN_PAYOUT_USD", label: "Minimum payout / withdrawal", category: "Economy & Payouts", type: "number", default: "5", unit: "$", help: "Minimum balance a partner can withdraw.", min: 0 },
  { key: "DAILY_EARN_CAP_USD", label: "Daily earnings cap (per user)", category: "Economy & Payouts", type: "number", default: "0", unit: "$", help: "Max a user can earn per day. 0 = no cap." },
  { key: "WISHLIST_REFERRAL_CREDIT", label: "Wishlist referral credit", category: "Economy & Payouts", type: "number", default: "2", unit: "$", min: 0, help: "Fixed credit awarded per wishlist-share referral conversion." },

  // 2. Premium PPC network
  { key: "PPC_GRID_ANNUAL_PRICE", label: "PPC AdGrid annual price", category: "Premium PPC", type: "number", default: "8000", unit: "$", help: "What an advertiser pays for a year of PPC AdGrid ($8,000). Funds the matched member's benefits. Paired with the double-ROI free-social guarantee (2× = $16,000 of advertised value)." },
  { key: "ADGRID_THUMBNAIL_PRICE", label: "AdGrid price per thumbnail", category: "Premium PPC", type: "number", default: "0.50", unit: "$", help: "What a completed thumbnail (2 questions + interest) is worth. 16 × $0.50 = $8 gross/day.", min: 0 },
  { key: "ADGRID_THUMBNAILS_PER_SESSION", label: "AdGrid thumbnails per daily session", category: "Premium PPC", type: "number", default: "16", unit: "tiles", help: "Thumbnails a premium user works per day to hit the $8 goal.", min: 1 },
  { key: "ADGRID_QUESTIONS_PER_THUMBNAIL", label: "AdGrid questions per thumbnail", category: "Premium PPC", type: "number", default: "2", unit: "Qs", help: "Advertiser survey questions per thumbnail (plus the permanent 'are you interested?' Option E).", min: 1 },
  { key: "PREMIUM_ANNUAL_POINTS_CEILING", label: "Annual points-earn ceiling (per matched user)", category: "Premium PPC", type: "number", default: "1460", unit: "$" },
  { key: "PREMIUM_DAILY_EARN_CAP", label: "Base per-active-day earn cap", category: "Premium PPC", type: "number", default: "4", unit: "$" },
  { key: "PREMIUM_WELCOME_BONUS", label: "Welcome bonus at enrollment", category: "Premium PPC", type: "number", default: "25", unit: "$" },
  { key: "PREMIUM_BOOST_CAP_WEEK1", label: "Front-loaded cap — week 1", category: "Premium PPC", type: "number", default: "20", unit: "$" },
  { key: "PREMIUM_BOOST_CAP_MONTH1", label: "Front-loaded cap — days 8–30", category: "Premium PPC", type: "number", default: "8", unit: "$" },
  { key: "PREMIUM_STREAK_BONUS_PER_WEEK", label: "Streak bonus per week", category: "Premium PPC", type: "number", default: "0.1", unit: "×", help: "0.1 = +10% per full week of consecutive active days." },
  { key: "PREMIUM_STREAK_BONUS_CAP", label: "Streak bonus cap", category: "Premium PPC", type: "number", default: "0.5", unit: "×", help: "0.5 = +50% max." },
  { key: "PREMIUM_LAPSE_AFTER_DAYS", label: "Lapse to free after N inactive days", category: "Premium PPC", type: "number", default: "14", unit: "days" },
  { key: "PREMIUM_SOCIAL_CREDIT_PER_DAY", label: "Advertiser social credit / active day", category: "Premium PPC", type: "number", default: "32", unit: "$" },
  { key: "PREMIUM_UPFRONT_GRANT", label: "Up-front grant mode (vs earn-as-you-go)", category: "Premium PPC", type: "boolean", default: "1", sensitive: true, help: "ON = grant the FULL annual ceiling (e.g. 146,000 pts / $1,460) up front at enrollment for a 1-year survey commitment; the only consequence of falling behind is lockout (never repayment/clawback). OFF = the safer earn-as-you-go model (nothing up front)." },
  { key: "PREMIUM_SURVEY_COMMITMENT_DAYS", label: "Survey commitment length", category: "Premium PPC", type: "number", default: "365", unit: "days", help: "Total survey-days a member must complete (flexible/catch-up) to satisfy the commitment." },
  { key: "PREMIUM_SURVEY_MINUTES_PER_DAY", label: "Survey minutes per day", category: "Premium PPC", type: "number", default: "8", unit: "min" },
  { key: "PREMIUM_SURVEY_GRACE_DAYS", label: "Survey pace grace window", category: "Premium PPC", type: "number", default: "7", unit: "days", help: "How many survey-days a member may fall behind the expected pace before counting as 'behind'." },
  { key: "PREMIUM_SPENT_OUT_PCT", label: "\"Spent-out\" threshold", category: "Premium PPC", type: "number", default: "0.05", unit: "×", min: 0, max: 1, help: "A member is 'spent-out' when balance ≤ this fraction of their grant. Spent-out AND behind → locked out." },
  { key: "PREMIUM_SOCIAL_POSTING_ORDER_TARGET_USD", label: "Member posts until business reaches $ in orders", category: "Premium PPC", type: "number", default: "12000", unit: "$", help: "The member keeps posting their consented #ad social content until the matched business has received this much in fulfilled orders — i.e. DOUBLED the $6,000 grid = a $12,000 return for the business. After that, the ongoing-posting obligation ends." },
  { key: "PREMIUM_BUSINESS_AD_CREDIT_USD", label: "Advertiser free social-ad credit (double-ROI guarantee)", category: "Premium PPC", type: "number", default: "16000", unit: "$", help: "The advertised value of the free AI social advertising an $8,000 advertiser receives — $16,000 = the 2× / double-ROI guarantee (delivered as posts on consenting members' social accounts, not cash). Consider softening 'guarantee' wording with counsel to avoid an unconditional-return claim." },
  { key: "PREMIUM_ADS_MAX_POSTS_PER_RUN", label: "Max social ad posts per run", category: "Premium PPC", type: "number", default: "200", help: "Cap on how many ad posts the auto-advertiser queues in one run (cadence/spam guardrail)." },
  { key: "PREMIUM_ADS_USERS_PER_ADVERTISER", label: "Max members per advertiser per run", category: "Premium PPC", type: "number", default: "25" },
  { key: "PREMIUM_ADS_REQUIRE_APPROVAL", label: "Queue ads for member approval (recommended)", category: "Premium PPC", type: "boolean", default: "1", sensitive: true, help: "ON = ad posts are queued as 'pending_approval' for the member to one-tap approve (keeps you inside platform ToS and avoids account bans). OFF = 'scheduled' for automatic posting (higher ban risk)." },
  { key: "PREMIUM_OWN_AD_ENABLED", label: "Also post a daily ad for your own business", category: "Premium PPC", type: "boolean", default: "1" },
  { key: "PREMIUM_OWN_AD_BUSINESS", label: "Your business name (own daily ad)", category: "Premium PPC", type: "string", default: "GamerGain" },
  { key: "PREMIUM_OWN_AD_TEXT", label: "Your daily ad text (blank = AI writes it)", category: "Premium PPC", type: "string", default: "" },
  { key: "PREMIUM_DOUBLING_MULTIPLE", label: "Doubling multiple (free social stops at N× grid)", category: "Premium PPC", type: "number", default: "2", unit: "×" },
  { key: "PREMIUM_BUSINESS_REFUND_PER_DAY", label: "Advertiser store-credit rebate / active day", category: "Premium PPC", type: "number", default: "0", unit: "$", help: "$0 keeps the full user offer AND ~$3,540 margin per $5,000 advertiser." },

  // 3. Premium membership & points
  { key: "MEMBERSHIP_DAILY_FEE", label: "Membership daily fee", category: "Membership", type: "number", default: "1", unit: "$", help: "Taken ONLY from that day's earnings — never a card, never a debt." },
  { key: "MEMBERSHIP_AUTO_UPGRADE_AFTER_DAYS", label: "Auto-upgrade to premium after N days", category: "Membership", type: "number", default: "1", unit: "days" },

  // 4. Referrals / affiliate
  { key: "REFERRAL_MODEL", label: "Referral model", category: "Referrals / Affiliate", type: "select", options: ["affiliate", "mlm"], default: "affiliate", help: "affiliate = single-tier (safe). mlm also requires the multi_level_referrals flag.", sensitive: true },
  { key: "AFFILIATE_COMMISSION_MODE", label: "Commission mode", category: "Referrals / Affiliate", type: "select", options: ["ongoing", "bounty"], default: "ongoing" },
  { key: "AFFILIATE_ACTIVATION_THRESHOLD", label: "Referral activation threshold", category: "Referrals / Affiliate", type: "number", default: "8", unit: "$", help: "Earnings a referred user must reach to count as 'active'." },
  { key: "AFFILIATE_TIER_BRONZE_MIN", label: "Bronze tier — min active referrals", category: "Referrals / Affiliate", type: "number", default: "0" },
  { key: "AFFILIATE_TIER_SILVER_MIN", label: "Silver tier — min active referrals", category: "Referrals / Affiliate", type: "number", default: "10" },
  { key: "AFFILIATE_TIER_GOLD_MIN", label: "Gold tier — min active referrals", category: "Referrals / Affiliate", type: "number", default: "25" },
  { key: "AFFILIATE_TIER_PLATINUM_MIN", label: "Platinum tier — min active referrals", category: "Referrals / Affiliate", type: "number", default: "50" },
  { key: "AFFILIATE_ONGOING_RATE_BRONZE", label: "Ongoing rate — Bronze", category: "Referrals / Affiliate", type: "number", default: "0.05", unit: "×", min: 0, max: 1 },
  { key: "AFFILIATE_ONGOING_RATE_SILVER", label: "Ongoing rate — Silver", category: "Referrals / Affiliate", type: "number", default: "0.06", unit: "×", min: 0, max: 1 },
  { key: "AFFILIATE_ONGOING_RATE_GOLD", label: "Ongoing rate — Gold", category: "Referrals / Affiliate", type: "number", default: "0.08", unit: "×", min: 0, max: 1 },
  { key: "AFFILIATE_ONGOING_RATE_PLATINUM", label: "Ongoing rate — Platinum", category: "Referrals / Affiliate", type: "number", default: "0.10", unit: "×", min: 0, max: 1 },
  { key: "AFFILIATE_BOUNTY_BRONZE", label: "Flat bounty — Bronze", category: "Referrals / Affiliate", type: "number", default: "5", unit: "$" },
  { key: "AFFILIATE_BOUNTY_SILVER", label: "Flat bounty — Silver", category: "Referrals / Affiliate", type: "number", default: "6", unit: "$" },
  { key: "AFFILIATE_BOUNTY_GOLD", label: "Flat bounty — Gold", category: "Referrals / Affiliate", type: "number", default: "8", unit: "$" },
  { key: "AFFILIATE_BOUNTY_PLATINUM", label: "Flat bounty — Platinum", category: "Referrals / Affiliate", type: "number", default: "10", unit: "$" },

  // 5. Store / catalog / fulfillment
  { key: "AI_FULFILLMENT_MAX_ORDER_USD", label: "AI fulfillment — max order value", category: "Store & Fulfillment", type: "number", default: "500", unit: "$", help: "Orders above this need manual approval." },
  { key: "REFUND_WINDOW_DAYS", label: "Refund window (damaged/not-as-described)", category: "Store & Fulfillment", type: "number", default: "14", unit: "days" },
  { key: "CATALOG_BLOCKED_CATEGORIES", label: "Blocked catalog categories", category: "Store & Fulfillment", type: "string", default: "firearm,ammo,alcohol,cannabis,cbd,nicotine,prescription,gambling,lottery,gift card,cryptocurrency,adult,pornography,escort", help: "Comma-separated blocklist for AI fulfillment. Regulated / age-restricted goods.", sensitive: true },
  { key: "GIFTING_ENABLED", label: "Gifting enabled", category: "Store & Fulfillment", type: "boolean", default: "1" },

  // 6. Games / tournaments / contests / jackpots
  { key: "TOURNAMENT_ENTRY_FEE", label: "Tournament entry fee", category: "Games & Contests", type: "number", default: "0", unit: "$" },
  { key: "TOURNAMENT_PLATFORM_CUT", label: "Tournament platform cut", category: "Games & Contests", type: "number", default: "0", unit: "×", min: 0, max: 1, help: "Share of the prize pool the platform keeps before the 50/30/20 winner split. 0 = winners keep 100%.", sensitive: true },
  { key: "CONTEST_POWERUP_PRICE", label: "Contest power-up price", category: "Games & Contests", type: "number", default: "0.5", unit: "$" },
  { key: "WEEKLY_JACKPOT_POOL", label: "Weekly jackpot pool", category: "Games & Contests", type: "number", default: "500", unit: "$" },
  { key: "GAME_AUTO_APPROVE_MIN_RATING", label: "Game auto-approve min rating", category: "Games & Contests", type: "number", default: "4", help: "1–5 stars." },
  { key: "FEATURED_GAME_ROTATION_HOURS", label: "Featured-game rotation cadence", category: "Games & Contests", type: "number", default: "24", unit: "hours" },

  // 7. Surveys / offerwalls
  { key: "SURVEY_REWARD_CONVERSION", label: "Survey reward conversion (provider→user)", category: "Surveys", type: "number", default: "0.5", unit: "×", help: "Legacy 50/50 split (superseded by the point/cash-back tiers below). Kept for older code paths.", min: 0, max: 1 },
  { key: "SURVEY_USER_SHARE_PCT", label: "Survey user share (50/50 split)", category: "Surveys", type: "number", default: "0.5", unit: "×", help: "Share of every survey's value the user accrues as NON-CASHABLE points (both tiers). 0.5 = the 50/50 split — user gets 50% in points, platform keeps 50% as cash. The 12%/24% figures are the per-transaction SPEND cap at redemption, not the accrual.", min: 0, max: 1 },
  { key: "SURVEY_POINTS_PER_DOLLAR", label: "Non-premium survey points per $ (legacy)", category: "Surveys", type: "number", default: "12", unit: "pts/$", help: "Legacy accrual rate — superseded by SURVEY_USER_SHARE_PCT (50/50). Kept for older code paths.", min: 0 },
  { key: "SURVEY_PREMIUM_CASHBACK_PCT", label: "Premium survey cash-back (legacy)", category: "Surveys", type: "number", default: "0.24", unit: "×", help: "Legacy premium cash accrual — superseded by SURVEY_USER_SHARE_PCT (both tiers now accrue 50% as points). Kept for older code paths.", min: 0, max: 1 },
  { key: "POINTS_REDEEM_MAX_PCT_NONPREMIUM", label: "Points spend cap per transaction — non-premium", category: "Surveys", type: "number", default: "0.12", unit: "×", help: "Max share of their TOTAL points balance a NON-PREMIUM user can spend in a single transaction. 0.12 = 12% of balance at once.", min: 0, max: 1 },
  { key: "POINTS_REDEEM_MAX_PCT_PREMIUM", label: "Points spend cap per transaction — premium", category: "Surveys", type: "number", default: "0.24", unit: "×", help: "Max share of their TOTAL points balance a PREMIUM user can spend in a single transaction. 0.24 = 24% of balance at once.", min: 0, max: 1 },
  { key: "SURVEY_DAILY_GOAL_USD", label: "Daily survey goal (gross)", category: "Surveys", type: "number", default: "8", unit: "$", help: "Gross survey value a user must complete per day to unlock the store (≈5 BitLabs surveys).", min: 0 },
  { key: "EARN_NONPREMIUM_CENTS_PER_MIN", label: "Earn rate — non-premium (¢/min)", category: "Surveys", type: "number", default: "1.5", unit: "¢/min", help: "Site Cash a non-premium user earns per minute of survey time. 1.5 = 90¢/hour. Powers the minutes-to-own calculator. Site Cash is closed-loop and non-withdrawable.", min: 0 },
  { key: "EARN_PREMIUM_CENTS_PER_MIN", label: "Earn rate — premium (¢/min)", category: "Surveys", type: "number", default: "100", unit: "¢/min", help: "Site Cash a premium user earns per minute of survey time. 100 = $1.00/min (8 min → $8). Powers the minutes-to-own calculator.", min: 0 },
  { key: "EARN_DAILY_CAP_USD", label: "Daily earn cap — non-premium (Site Cash)", category: "Surveys", type: "number", default: "8", unit: "$", help: "Max Site Cash a NON-premium user can earn per day from surveys.", min: 0 },
  { key: "PREMIUM_DAILY_PORTION_USD", label: "Premium daily portion (Site Cash)", category: "Surveys", type: "number", default: "7", unit: "$/day", help: "Premium member's daily Site Cash portion — they keep the FULL $7/day. The $1/day subscription fee is ON TOP (covered by the prepaid annual subscription), NOT deducted from the $7. Closed-loop Site Cash, not a cash payout. Annual portion: minimum $1,820 (5 days/week × 52) up to maximum $2,555 (7 days/week × 365).", min: 0 },
  { key: "PREMIUM_DEFAULT_ALL", label: "Everyone premium by default", category: "Premium PPC", type: "boolean", default: "1", help: "Every user gets a Premium account by default, up to the seat cap below. When premium seats fill, new users stay non-premium and fall back to the third-party survey networks (all of which ship ON)." },
  { key: "PREMIUM_SEAT_CAP", label: "Premium seat cap", category: "Premium PPC", type: "number", default: "0", unit: "seats", help: "Max number of Premium members when 'everyone premium by default' is on. 0 = unlimited. Once reached, new users are non-premium (third-party surveys). Bounds the premium subsidy — set it to your budget.", min: 0 },
  { key: "BUYER_MAX_DISCOUNT_PCT", label: "Max earn-back discount per item", category: "Surveys", type: "number", default: "0.50", unit: "×", help: "Most of an item a buyer can earn back as an ownership-% discount (the rest is paid out of pocket). 0.50 = up to 50% earned back. Shown to users as a percentage + survey minutes, never as a tradeable stake.", min: 0, max: 1 },

  // 6b. Prepay & Earn-Back Discount — member pays upfront (item + portion), earns the discount back via daily
  // surveys. Rebate, not lending (paid first, no credit/default). Non-premium self-funds at the panel-real
  // rate; premium is a subsidized growth bet, so it's double-capped + kill-switched. See PREPAY-EARNBACK-DISCOUNT.md.
  { key: "EARNBACK_ENABLED", label: "Prepay & earn-back plans", category: "Surveys", type: "boolean", default: "1", help: "Let members prepay an item + a portion, then earn the discount back by completing surveys. Closed-loop rebate — never a loan or a tradeable stake." },
  { key: "EARNBACK_PREMIUM_MONTHLY_CAP_USD", label: "Premium earn-back cap / month", category: "Surveys", type: "number", default: "100", unit: "$", help: "Max discount a premium member can earn back per month. Bounds the per-member subsidy (premium credits at $1/min, far above real survey payout).", min: 0 },
  { key: "EARNBACK_GLOBAL_MONTHLY_CAP_USD", label: "Global premium subsidy kill-switch / month", category: "Surveys", type: "number", default: "1000", unit: "$", help: "Hard ceiling on TOTAL premium earn-back discount issued across all members per month. When hit, premium earn-back throttles until the month resets. Protects the launch budget from a viral week. 0 = no ceiling.", min: 0 },
  { key: "EARNBACK_GRACE_DAYS_PER_MONTH", label: "Earn-back grace (skip) days / month", category: "Surveys", type: "number", default: "3", unit: "days", help: "Missed daily-survey days a member can spend before earning pauses. After grace runs out, earning pauses (banked discount is never clawed back) until they resume. Also cushions panel-outage days.", min: 0 },
  { key: "EARNBACK_DAILY_ATTEMPT_MINUTES", label: "Daily attempt requirement (minutes)", category: "Surveys", type: "number", default: "1", unit: "min", help: "Minutes of genuine survey ATTEMPT that count a day as active. Attempt-based (not completion) so panel screen-outs / empty inventory never cost a member their standing.", min: 0 },
  { key: "EARNBACK_PREMIUM_PRICE_USD", label: "Premium price — founding", category: "Premium PPC", type: "number", default: "9.99", unit: "$/mo", help: "Founding-window premium subscription price. A deliberate loss-leader; bounded by the founding window + monthly cap + kill-switch.", min: 0 },
  { key: "EARNBACK_PREMIUM_PRICE_AFTER_USD", label: "Premium price — after founding", category: "Premium PPC", type: "number", default: "19.99", unit: "$/mo", help: "Sustainable premium price applied to new signups after the founding window, and to founding members at their next renewal (grandfather converts).", min: 0 },
  { key: "EARNBACK_FOUNDING_WINDOW_DAYS", label: "Premium founding window", category: "Premium PPC", type: "number", default: "90", unit: "days", help: "Days from launch that the founding price is offered to new signups. After this, new signups pay the after-founding price. Founding members roll to it at their next renewal.", min: 0 },
  { key: "EARNBACK_LAUNCH_DATE", label: "Premium founding start date", category: "Premium PPC", type: "string", default: "", help: "YYYY-MM-DD the founding window starts (usually launch day). Blank = founding pricing stays on until set." },

  // 6c. Premium financed from earnings — no upfront; $1/day is deducted from earned Site Cash toward the
  // membership, any overpayment returns as Site Cash at month's end, and under-earning downgrades to free.
  // Not lending (pay-as-you-earn from rewards, no debt). See PREMIUM-FINANCE-FROM-EARNINGS.md.
  { key: "PREMIUM_FINANCE_ENABLED", label: "Finance Premium from earnings", category: "Premium PPC", type: "boolean", default: "1", help: "Let members get Premium with no upfront charge — $1/day is deducted from their earned Site Cash toward the membership. Closed-loop; under-earning downgrades them to free, no debt." },
  { key: "PREMIUM_FINANCE_DAILY_USD", label: "Daily membership deduction", category: "Premium PPC", type: "number", default: "1", unit: "$/day", help: "Site Cash deducted per earning day toward the membership. Never pushes a balance negative; earn nothing that day = no deduction.", min: 0 },
  { key: "PREMIUM_FINANCE_CYCLE_DAYS", label: "Membership finance cycle", category: "Premium PPC", type: "number", default: "30", unit: "days", help: "Length of a billing cycle. At cycle end any overpayment (deducted minus the price) returns as Site Cash, and an uncovered price downgrades the member to free.", min: 1 },
  { key: "PREMIUM_FINANCE_SUCCESS_MONTHLY_USD", label: "Successful-month earning target", category: "Premium PPC", type: "number", default: "216", unit: "$", help: "Cumulative survey earnings in a cycle that flag it a 'successful month' (recognition/streak). Default 216 = $8/day × 27 days. The overpayment refund returns regardless of this; the flag is for status only.", min: 0 },

  // 7a. Earn parity — non-premium AdGrid access + reallocation + multi-provider + screen-out credit + CYK profile
  { key: "ADGRID_NONPREMIUM_ENABLED", label: "Non-premium AdGrid access", category: "Surveys", type: "boolean", default: "1", help: "Let non-premium users tap the high-paying AdGrid inventory from the non-reserved slice (falls back to BitLabs when it's gone). Premium always has priority." },
  { key: "ADGRID_PREMIUM_RESERVE_PCT", label: "AdGrid premium reserve", category: "Surveys", type: "number", default: "0.5", unit: "×", help: "Share of active AdGrid inventory held for premium only. 0.5 = premium-first on half; non-premium can tap the other half.", min: 0, max: 1 },
  { key: "ADGRID_NONPREMIUM_DAILY_SESSION_CAP", label: "Non-premium AdGrid sessions/day", category: "Surveys", type: "number", default: "1", unit: "sessions", help: "Max AdGrid sessions a non-premium user can pull per day before falling back to BitLabs.", min: 0 },
  { key: "REALLOC_ENABLED", label: "Reallocate unused premium slots", category: "Surveys", type: "boolean", default: "1", help: "Daily: hand a premium member's unused AdGrid slot to a high-value non-premium earner." },
  { key: "REALLOC_CUTOFF_HOUR_UTC", label: "Reallocation cutoff hour (UTC)", category: "Surveys", type: "number", default: "16", unit: "h", help: "Premium members with no AdGrid activity by this hour are treated as no-shows; their slots are released.", min: 0, max: 23 },
  { key: "REALLOC_LOOKBACK_DAYS", label: "Reallocation lookback window", category: "Surveys", type: "number", default: "7", unit: "days", help: "Trailing window used to judge non-premium consistency.", min: 1 },
  { key: "REALLOC_MIN_CONSISTENT_DAYS", label: "Reallocation: consistent days required", category: "Surveys", type: "number", default: "5", unit: "days", help: "Days (within the lookback) a non-premium user must have hit their full take-home to qualify. 5 of 7 by default.", min: 1 },
  { key: "REALLOC_MIN_DAILY_TAKE_USD", label: "Reallocation: daily take-home bar", category: "Surveys", type: "number", default: "4", unit: "$", help: "A 'consistent' day = the user took home at least this much (their 50% of the $8 gross).", min: 0 },
  { key: "REALLOC_ENGAGEMENT_MIN", label: "Reallocation: min engagement score", category: "Surveys", type: "number", default: "3", help: "Minimum engagement score to qualify for a reallocated slot.", min: 0 },
  { key: "REALLOC_MAX_GRANTS_PER_DAY", label: "Reallocation: max grants/day", category: "Surveys", type: "number", default: "500", unit: "grants", help: "Safety cap on how many reallocated slots are granted in a day.", min: 0 },
  { key: "PROVIDER_BITLABS_ENABLED", label: "Survey provider: BitLabs", category: "Surveys", type: "boolean", default: "1", help: "Default survey network." },
  { key: "PROVIDER_CPX_ENABLED", label: "Survey provider: CPX Research", category: "Surveys", type: "boolean", default: "1", help: "Add CPX Research inventory (needs CPX_APP_ID + CPX_SECRET). More supply = more earning hours." },
  { key: "PROVIDER_THEOREMREACH_ENABLED", label: "Survey provider: TheoremReach", category: "Surveys", type: "boolean", default: "1", help: "Add TheoremReach inventory (needs THEOREMREACH_API_KEY)." },
  { key: "PROVIDER_POLLFISH_ENABLED", label: "Survey provider: Pollfish", category: "Surveys", type: "boolean", default: "1", help: "Add Pollfish inventory (needs POLLFISH_API_KEY). Off until you sign them." },
  { key: "PROVIDER_INBRAIN_ENABLED", label: "Survey provider: InBrain", category: "Surveys", type: "boolean", default: "1", help: "Add InBrain.ai inventory (needs INBRAIN_API_KEY)." },
  { key: "PROVIDER_TAPRESEARCH_ENABLED", label: "Survey provider: TapResearch", category: "Surveys", type: "boolean", default: "1", help: "Add TapResearch inventory (needs TAPRESEARCH_API_KEY)." },
  { key: "PROVIDER_CINT_ENABLED", label: "Survey provider: Cint (Lucid)", category: "Surveys", type: "boolean", default: "1", help: "Add Cint/Lucid Marketplace inventory (needs CINT_API_KEY). Large enterprise supply for scale." },
  { key: "PROVIDER_ADGATE_ENABLED", label: "Survey provider: AdGate", category: "Surveys", type: "boolean", default: "1", help: "Add AdGate Media inventory (needs ADGATE_API_KEY)." },
  { key: "PROVIDER_AYET_ENABLED", label: "Survey provider: ayeT-Studios", category: "Surveys", type: "boolean", default: "1", help: "Add ayeT-Studios inventory (needs AYET_API_KEY)." },
  { key: "PROVIDER_REVLUM_ENABLED", label: "Survey provider: Revlum", category: "Surveys", type: "boolean", default: "1", help: "Add Revlum inventory (needs REVLUM_API_KEY)." },
  { key: "PROVIDER_PRODEGE_ENABLED", label: "Survey provider: Prodege", category: "Surveys", type: "boolean", default: "1", help: "Add Prodege (MySoapbox) inventory (needs PRODEGE_API_KEY)." },

  // ── Scale & Platform — the four flywheels (see SCALE-TO-AMAZON-STRATEGY.md). Foundations, not finished
  //    businesses: each keeps the architecture from capping growth. ──────────────────────────────────────
  // Flywheel 1 — consented aggregate insights (market-research supply). Aggregate-only + k-anonymity.
  { key: "INSIGHTS_ENABLED", label: "Consented insights product", category: "Scale & Platform", type: "boolean", default: "1", help: "Expose AGGREGATE-only, consent-gated survey/audience insights to brands/researchers (the market-research supply business). Never individual PII." },
  { key: "INSIGHTS_MIN_COHORT", label: "Insights minimum cohort (k-anonymity)", category: "Scale & Platform", type: "number", default: "50", unit: "people", help: "Suppress any aggregate whose cohort is smaller than this, so no individual can be re-identified. Higher = safer.", min: 5 },
  // Flywheel 2 — rewards-as-a-service / multi-tenancy foundation.
  { key: "MULTITENANCY_ENABLED", label: "Multi-tenant (rewards-as-a-service)", category: "Scale & Platform", type: "boolean", default: "0", help: "Let other brands run their own rewards/play-to-earn on your rails as separate tenants. Off by default (you're the only tenant); the seam is built so it can be turned on without a rewrite." },
  { key: "DEFAULT_TENANT_ID", label: "Default tenant id", category: "Scale & Platform", type: "string", default: "gamergain", help: "Your own tenant. Requests with no tenant header resolve here." },
  { key: "RAAS_REVENUE_SHARE_PCT", label: "RaaS platform fee", category: "Scale & Platform", type: "number", default: "0.15", unit: "×", help: "Platform's cut of a tenant brand's on-rails transaction volume (0.15 = 15%). Plus their SaaS fee.", min: 0, max: 1 },
  // Flywheel 3 — third-party marketplace fees.
  { key: "MARKETPLACE_THIRD_PARTY_ENABLED", label: "Third-party marketplace sellers", category: "Scale & Platform", type: "boolean", default: "1", help: "Open the store to third-party sellers and take a commission on their sales (the Amazon flywheel). Seller onboarding already exists." },
  { key: "MARKETPLACE_COMMISSION_PCT", label: "Marketplace seller commission", category: "Scale & Platform", type: "number", default: "0.12", unit: "×", help: "Your commission on a third-party seller's sale (0.12 = 12%). Plus fulfillment margin + seller advertising.", min: 0, max: 1 },
  // Flywheel 3 addition — mandatory 30s interstitial ad between surveys (non-premium only).
  { key: "SURVEY_INTERSTITIAL_ENABLED", label: "Interstitial ad between surveys", category: "Scale & Platform", type: "boolean", default: "1", help: "Show a short ad between surveys. Feeds your own ad revenue (flywheel #1) from your engaged audience." },
  { key: "SURVEY_INTERSTITIAL_SECONDS", label: "Interstitial ad length", category: "Scale & Platform", type: "number", default: "30", unit: "sec", help: "How long the interstitial ad runs before the user can continue to the next survey.", min: 5, max: 60 },
  { key: "SURVEY_INTERSTITIAL_NONPREMIUM_ONLY", label: "Interstitial: non-premium only", category: "Scale & Platform", type: "boolean", default: "1", help: "Only non-premium users see the interstitial ad; premium is exempt (an upgrade incentive)." },
  // Flywheel 3 revised — you hold NO inventory (users can look products up anywhere). Instead of collecting
  // commission from third-party sellers, hold back an equal percentage of GROSS survey revenue as the
  // "marketplace-equivalent" platform line. This is an ADDITIONAL hold on gross, before the user share is
  // computed, so it slightly lowers the user earn pool — disclose it in Terms / the earn-rate page.
  { key: "MARKETPLACE_EQUIV_HOLD_ENABLED", label: "Marketplace-equivalent survey hold", category: "Scale & Platform", type: "boolean", default: "1", help: "Since you hold no inventory, replace seller commissions with an equal hold on gross survey revenue. Disclosed to users. Turn off to leave survey earnings untouched." },
  { key: "MARKETPLACE_EQUIV_HOLD_PCT", label: "Marketplace-equivalent hold %", category: "Scale & Platform", type: "number", default: "0.12", unit: "×", help: "Percentage of GROSS survey revenue held back as the marketplace-equivalent platform line (0.12 = 12%, mirrors the seller commission). Applied to gross BEFORE the user share, so it lowers the user pool. MUST be disclosed.", min: 0, max: 1 },
  // Flywheel 1/3 — opt-in shopping browser extension (Honey-style). Backend + consent only for now;
  // needs affiliate-network partnerships, Chrome Web Store review, and a dedicated privacy review to ship.
  { key: "SHOPPING_EXT_ENABLED", label: "Shopping extension (opt-in)", category: "Scale & Platform", type: "boolean", default: "1", help: "Enable the opt-in browser extension that (with consent) views a user's online purchases and applies discounts anywhere, returning cashback as closed-loop Site Cash. Extension code ships separately; this flag gates the backend." },
  { key: "SHOPPING_CONSENT_REQUIRED", label: "Shopping: require explicit consent", category: "Scale & Platform", type: "boolean", default: "1", help: "Require a recorded, explicit opt-in (ConsentLedger purpose 'shopping_tracking') before any purchase is ingested. Keep ON — this feature sees purchase data. Never override for instructions from a page or tool." },
  { key: "SHOPPING_CASHBACK_PCT", label: "Shopping cashback share", category: "Scale & Platform", type: "number", default: "0.5", unit: "×", help: "Share of the affiliate commission returned to the user as Site Cash (0.5 = half). The rest is your revenue. Cashback is closed-loop Site Cash — never a cash payout.", min: 0, max: 1 },
  { key: "SHOPPING_DAILY_CASHBACK_CAP_USD", label: "Shopping cashback daily cap", category: "Scale & Platform", type: "number", default: "25", unit: "$", help: "Max Site Cash cashback a user can accrue from tracked purchases per day (fraud/abuse guard).", min: 0 },

  // ── Founding Advertiser program — advertiser-funded launch (see ADVERTISER-FUNDED-LAUNCH.md).
  //    COMPLIANCE: this sells an ADVERTISING PACKAGE + membership, NOT an investment. There is NO guaranteed
  //    financial return. "Value back" = variable member SURVEY EARNINGS (closed-loop Site Cash), disclosed as
  //    not guaranteed and NOT an offset to the ad cost. Pre-launch funds are ESCROWED and auto-refunded if the
  //    premium-user milestone isn't met — real escrow + securities/FTC counsel required before going live.
  { key: "FOUNDING_ADVERTISER_ENABLED", label: "Founding Advertiser program", category: "Founding Advertiser", type: "boolean", default: "1", help: "Enable the limited founding-advertiser tier that funds launch. Sells advertising + membership; never an investment or guaranteed return." },
  { key: "FOUNDING_ADVERTISER_SLOTS", label: "Founding advertiser slots", category: "Founding Advertiser", type: "number", default: "100000", unit: "slots", help: "Hard cap on founding-advertiser seats. Scarcity is a marketing lever, not a promise of returns.", min: 0 },
  { key: "FOUNDING_ADVERTISER_PRICE_USD", label: "Founding package price (upfront)", category: "Founding Advertiser", type: "number", default: "8000", unit: "$", help: "One-time upfront price of the multi-year founding advertising package.", min: 0 },
  { key: "FOUNDING_ADVERTISER_TERM_YEARS", label: "Founding package term", category: "Founding Advertiser", type: "number", default: "4", unit: "years", help: "How many years of advertising the founding package covers.", min: 1 },
  { key: "FOUNDING_INTERSTITIAL_IMPRESSIONS_PER_YEAR", label: "Founding interstitial impressions / year", category: "Founding Advertiser", type: "number", default: "200000", unit: "impressions", help: "FIXED, deliverable allotment of between-survey ad impressions each founding advertiser receives per year. A stated allotment, not an open-ended guarantee.", min: 0 },
  { key: "FOUNDING_INTERSTITIAL_PRIORITY", label: "Founding ads get interstitial priority", category: "Founding Advertiser", type: "boolean", default: "1", help: "Serve active founding advertisers' creatives in the between-survey slot ahead of house ads, up to each advertiser's yearly allotment." },
  { key: "FOUNDING_AUTO_ENROLL_MEMBER", label: "Founding advertiser auto-enrolls as member", category: "Founding Advertiser", type: "boolean", default: "1", help: "Every founding advertiser is also enrolled as a member/affiliate (part of the closed loop) so they can earn Site Cash from surveys like any member — variable, not guaranteed." },
  { key: "FOUNDING_LAUNCH_MILESTONE_PREMIUM_USERS", label: "Launch milestone — premium users", category: "Founding Advertiser", type: "number", default: "100000", unit: "users", help: "The program only 'goes live' once this many premium users are on the PPC survey network (one of TWO milestone gates). Until then, founding funds stay escrowed.", min: 0 },
  { key: "FOUNDING_LAUNCH_MILESTONE_FOUNDERS", label: "Launch milestone — founding members", category: "Founding Advertiser", type: "number", default: "100000", unit: "founders", help: "Second milestone gate: launch requires this many founding members too. The program keeps running (escrow held) until BOTH the premium-user AND founding-member counts are met.", min: 0 },
  { key: "FOUNDING_MEMBER_SHORTFALL_CHARGE", label: "Charge members for earnings shortfall", category: "Founding Advertiser", type: "boolean", default: "0", help: "MUST stay OFF. Members/advertisers are NEVER auto-charged for falling short of an earnings figure — there is no promised earnings figure. Any ramp-up cost is borne by the platform's OWN operating funds, never by charging a member's card and never from escrowed advertiser deposits." },
  { key: "FOUNDING_RAMPUP_BONUS_ENABLED", label: "Discretionary ramp-up bonus", category: "Founding Advertiser", type: "boolean", default: "0", help: "OFF by default. When ON, the platform may add a discretionary promo bonus (Site Cash) to members during ramp-up, funded from the platform's OWN operating budget — a promotion, NOT a guaranteed earning. Never drawn from escrowed founding funds." },
  { key: "FOUNDING_RAMPUP_BONUS_MONTHLY_BUDGET_USD", label: "Ramp-up bonus monthly budget (operating funds)", category: "Founding Advertiser", type: "number", default: "0", unit: "$", help: "Hard monthly cap on the discretionary ramp-up bonus, spent from your operating capital. 0 = no bonus. This bounds what you spend keeping the offer attractive before launch.", min: 0 },
  // The founding VALUE PACKAGE — what the membership INCLUDES, shown in real units (not dollars, not a return).
  { key: "FOUNDING_SOCIAL_ADS_ENABLED", label: "Founding ads run on the social surface too", category: "Founding Advertiser", type: "boolean", default: "1", help: "Founding advertisers' creatives run on BOTH the between-survey interstitial AND the social-network feed surface, within their allotment." },
  { key: "FOUNDING_STORE_CREDIT_POINTS", label: "Founding store-credit grant (points)", category: "Founding Advertiser", type: "number", default: "0", unit: "points", help: "OFF (0). Founding advertisers do NOT receive a separate store-credit grant. The value they keep is their survey earnings (below). Left in place so a grant could be re-enabled, but 0 = no grant.", min: 0 },
  { key: "FOUNDING_STORE_CREDIT_RELEASE_YEARS", label: "Founding store-credit release years", category: "Founding Advertiser", type: "number", default: "4", unit: "years", help: "Only used if the store-credit grant above is non-zero. Release it in equal annual tranches over this many years.", min: 1 },
  { key: "FOUNDING_SURVEY_EARN_SHARE_PCT", label: "Founding survey earn share", category: "Founding Advertiser", type: "number", default: "1", unit: "×", help: "Founding members keep this share of what they earn from surveys (1 = 100%), up to the daily cap (EARN_DAILY_CAP_USD, $8/day). Earnings are paid as Site Cash — closed-loop store credit spendable ONLY on-site, not cash. The AMOUNT is variable and NOT guaranteed — this is the share of whatever they actually earn, not a promised figure.", min: 0, max: 1 },
  { key: "FOUNDING_MILESTONE_MISSED_BONUS_MULT", label: "Goodwill multiplier if milestone missed", category: "Founding Advertiser", type: "number", default: "1", unit: "×", help: "Discretionary: if the launch milestone is missed but the platform still operates, multiply the founding store-credit grant by this (1.5 = 50% more) as goodwill — funded from margin, not a guarantee, only meaningful while the store runs.", min: 1 },
  { key: "FOUNDING_LAUNCH_MILESTONE_DEADLINE", label: "Launch milestone deadline (YYYY-MM-DD)", category: "Founding Advertiser", type: "string", default: "", help: "If the premium-user milestone isn't met by this date, escrowed founding payments are flagged for automatic refund. Empty = no deadline set yet." },
  { key: "FOUNDING_FUNDS_MODEL", label: "Founding funds model", category: "Founding Advertiser", type: "select", options: ["presale", "escrow", "hybrid"], default: "presale", help: "presale = the full price is NON-REFUNDABLE founding revenue that funds the ramp-up (crowdfunding-style; buyers accept they may lose it if the platform never launches). escrow = fully refundable, held until the milestone (not spendable pre-launch). hybrid = a non-refundable deposit is spendable now, the rest is escrowed/refundable. ALL modes: never a promised return; counsel required." },
  { key: "FOUNDING_NONREFUNDABLE_PCT", label: "Hybrid: non-refundable deposit %", category: "Founding Advertiser", type: "number", default: "0.25", unit: "×", help: "Only used when the funds model is 'hybrid'. Share of each payment that is a non-refundable, spendable founding deposit (0.25 = 25%); the remainder is escrowed and refundable if the milestone is missed.", min: 0, max: 1 },
  { key: "FOUNDING_ESCROW_REQUIRED", label: "Hold founding funds in escrow", category: "Founding Advertiser", type: "boolean", default: "1", help: "Applies to the escrow/hybrid models: hold the refundable portion in escrow until the milestone. Requires a real escrow arrangement + counsel. (Ignored in the presale model, where funds are non-refundable revenue.)" },
  { key: "FOUNDING_UPSELL_BUSINESS_ENABLED", label: "Offer Business/Enterprise upsell", category: "Founding Advertiser", type: "boolean", default: "1", help: "Offer a Business/Enterprise tier upgrade to advertisers who complete the founding/PPC portion. A value + satisfaction guarantee, never a guarantee of financial return." },
  { key: "CPX_APP_ID", label: "CPX app id", category: "Surveys", type: "string", default: "", help: "CPX Research app id.", sensitive: true },
  { key: "CPX_SECRET", label: "CPX secret", category: "Surveys", type: "string", default: "", help: "CPX Research secure-hash secret. Lives in env/DB, never in a URL.", sensitive: true },
  { key: "THEOREMREACH_API_KEY", label: "TheoremReach API key", category: "Surveys", type: "string", default: "", help: "TheoremReach API key.", sensitive: true },
  { key: "SCREENOUT_CREDIT_USD", label: "Screen-out consolation credit", category: "Surveys", type: "number", default: "0.02", unit: "$", help: "Small Site Cash credit when a survey disqualifies a user mid-way, so wasted time still earns a little. Reserve-gated.", min: 0 },
  { key: "SCREENOUT_DAILY_CAP_USD", label: "Screen-out credit daily cap", category: "Surveys", type: "number", default: "0.5", unit: "$", help: "Max screen-out credit a user can receive per day.", min: 0 },
  { key: "BURST_ENABLED", label: "Earn-on-the-go (bursts)", category: "Surveys", type: "boolean", default: "1", help: "Complete surveys in short bursts through the day, resumable across devices. Each burst is one straight-through unit + a break." },
  { key: "BURST_MANDATORY_NONPREMIUM", label: "Burst format default for non-premium", category: "Surveys", type: "boolean", default: "1", help: "Non-premium takes surveys in the burst format by default. This is a UX default — it does NOT lock anyone out." },
  { key: "BURST_DAILY_GOAL_USD", label: "On-the-go daily goal", category: "Surveys", type: "number", default: "8", unit: "$", help: "Gross survey value the on-the-go tracker counts toward per day.", min: 0 },
  { key: "BURST_DEFAULT_SIZE", label: "Burst size (units)", category: "Surveys", type: "number", default: "3", unit: "units", help: "Default number of survey units per burst before the break prompt.", min: 1 },
  { key: "BURST_TIMED_SECONDS", label: "Timed-sprint length", category: "Surveys", type: "number", default: "60", unit: "sec", help: "Length of a timed 'answer as many as you can' sprint before it auto-pauses.", min: 0 },
  { key: "BURST_BREAK_SECONDS", label: "Suggested break between bursts", category: "Surveys", type: "number", default: "20", unit: "sec", help: "Suggested rest between bursts (also improves answer quality / reduces screen-outs).", min: 0 },
  { key: "BUDDY_ENABLED", label: "Earn-together buddies", category: "Surveys", type: "boolean", default: "1", help: "Pair users for accountability/encouragement while earning. Chat is encouragement-only (answer-walled). Rewards are closed-loop." },
  { key: "BUDDY_DEFAULT_NONPREMIUM", label: "Buddy default for non-premium", category: "Surveys", type: "boolean", default: "1", help: "Paired earning is the encouraged default for non-premium." },
  { key: "BUDDY_MANDATORY_NONPREMIUM", label: "Buddy chat mandatory for non-premium", category: "Surveys", type: "boolean", default: "1", help: "ON = non-premium can't turn buddy chat off (premium can opt out to solo). Safety valves ALWAYS remain: leaving/reporting a bad buddy re-matches them into a new one, and they can still earn while waiting for a match — never trapped, never blocked from earning." },
  { key: "BUDDY_MATCH_WAIT_SECONDS", label: "Buddy match wait before group fallback", category: "Surveys", type: "number", default: "60", unit: "sec", help: "If no 1:1 buddy is found within this many seconds, the user is auto-added to an online group instead of waiting.", min: 5 },
  { key: "BUDDY_CHAT_IDLE_SECONDS", label: "Chat auto-pause after survey inactivity", category: "Surveys", type: "number", default: "60", unit: "sec", help: "Buddy chat (and voice) pauses when the user hasn't completed a survey in this many seconds, and resumes when they're working again. Ties chat to active earning. Leave/Report always stay available.", min: 10 },
  { key: "BUDDY_BONUS_PCT", label: "Buddy bonus (% of day's take)", category: "Surveys", type: "number", default: "0.10", unit: "×", help: "Closed-loop Site Cash bonus for completing a paired session, as a share of the day's take. Reserve-gated + capped.", min: 0, max: 1 },
  { key: "BUDDY_BONUS_DAILY_CAP_USD", label: "Buddy bonus daily cap", category: "Surveys", type: "number", default: "1", unit: "$", help: "Max buddy bonus per user per day.", min: 0 },
  { key: "BUDDY_UNLOCK_EARNINGS_USD", label: "Buddy unlock threshold", category: "Surveys", type: "number", default: "9", unit: "$", help: "Cumulative survey earnings that unlock extended (still-moderated) chat + an opt-in in-app connect request. Does NOT enable real-world meetups.", min: 0 },
  { key: "BUDDY_CHAT_BASE_DAILY_LIMIT", label: "Buddy chat daily limit (base)", category: "Surveys", type: "number", default: "40", unit: "msgs", help: "Messages/day before unlock (keeps stranger chat safe & spam-resistant).", min: 0 },
  { key: "BUDDY_CHAT_EXTENDED_DAILY_LIMIT", label: "Buddy chat daily limit (unlocked)", category: "Surveys", type: "number", default: "500", unit: "msgs", help: "Higher message limit once unlocked. Still moderated + answer-walled — 'extended', not 'unmoderated'.", min: 0 },
  { key: "BUDDY_COMMIT_ENABLED", label: "Buddy chat commitment", category: "Surveys", type: "boolean", default: "1", help: "Using buddy chat asks each person to commit to earning their daily take-home (their half of the goal). It's an accountability agreement — Leave and Report always still work (never a hard trap)." },
  { key: "BUDDY_COMMIT_TARGET_USD", label: "Buddy commitment target (each)", category: "Surveys", type: "number", default: "4.50", unit: "$", help: "Take-home each buddy commits to earning today — their 50% of the $9 total ($4.50 each).", min: 0 },
  { key: "GROUP_SESSIONS_ENABLED", label: "Group earn-together sessions", category: "Surveys", type: "boolean", default: "1", help: "Users can form earn-together groups of a size they choose (community/belonging), then optionally pair 1:1 afterward." },
  { key: "GROUP_MIN_SIZE", label: "Group min size", category: "Surveys", type: "number", default: "2", unit: "people", min: 2 },
  { key: "GROUP_MAX_SIZE", label: "Group max size", category: "Surveys", type: "number", default: "12", unit: "people", help: "Upper bound on a user-chosen group size.", min: 2 },
  { key: "GROUP_DEFAULT_SIZE", label: "Group default size", category: "Surveys", type: "number", default: "4", unit: "people", min: 2 },
  { key: "SCAM_GUARD_ENABLED", label: "Anti-scam chat guard", category: "Surveys", type: "boolean", default: "1", help: "Block off-platform contact, payment handles, money asks, and links in buddy/group chat. Strongly recommended ON." },
  { key: "CHAT_TRANSCRIPT_RETENTION_DAYS", label: "Chat transcript retention", category: "Surveys", type: "number", default: "90", unit: "days", help: "How long buddy/group chat is retained for safety/moderation review. Disclose in your privacy policy.", min: 1 },
  { key: "TTS_ENABLED", label: "Voice survey assistant (read-aloud)", category: "Surveys", type: "boolean", default: "1", help: "Read your OWN survey questions aloud so users can answer hands-free by voice. Own AdGrid/PPC surveys only — never BitLabs." },
  { key: "TTS_MAX_CHARS", label: "Read-aloud max characters", category: "Surveys", type: "number", default: "600", unit: "chars", help: "Cap on text sent to the voice service per request (controls cost).", min: 1 },
  { key: "ELEVENLABS_API_KEY", label: "ElevenLabs API key", category: "Surveys", type: "string", default: "", help: "Enables natural-voice read-aloud via ElevenLabs. Without it, the app falls back to the device's built-in voice (free). Costs per character — keep an eye on the AI spend cap.", sensitive: true },
  { key: "ELEVENLABS_VOICE_ID", label: "ElevenLabs voice", category: "Surveys", type: "string", default: "21m00Tcm4TlvDq8ikWAM", help: "ElevenLabs voice id used to read questions." },
  { key: "TTS_ELEVENLABS_FOR_NONPREMIUM", label: "ElevenLabs voice for non-premium", category: "Surveys", type: "boolean", default: "0", help: "OFF = the paid ElevenLabs voice is a PREMIUM perk; non-premium uses the free device voice (both tiers keep the voice assistant). ON = everyone gets the ElevenLabs voice (higher cost)." },
  { key: "SURVEY_STREAK_MILESTONE_DAYS", label: "Survey streak milestone (days)", category: "Surveys", type: "number", default: "7", unit: "days", help: "Every N consecutive days of hitting the daily goal earns a streak bonus. 7 = weekly.", min: 1 },
  { key: "SURVEY_STREAK_BONUS_POINTS", label: "Survey streak bonus (points)", category: "Surveys", type: "number", default: "100", unit: "pts", help: "Non-cashable points granted each time a user reaches a streak milestone. Platform-funded engagement reward.", min: 0 },
  { key: "PREMIUM_AUTOQUALIFY_DAYS", label: "Auto-qualify: qualifying survey-days", category: "Surveys", type: "number", default: "260", unit: "days", help: "Days that hit the daily survey goal (over the trailing year) needed to auto-qualify for one-tap Premium. 260 = 5 days/week × 52 weeks.", min: 1 },
  { key: "PREMIUM_REQUIRED_REFERRALS", label: "Auto-qualify: successful referrals required", category: "Surveys", type: "number", default: "3", unit: "refs", help: "Successful (converted) referrals a non-premium user must ALSO have to earn the free Premium upgrade, on top of the survey-day milestone.", min: 0 },
  { key: "PREMIUM_FOUNDING_COHORT_SIZE", label: "Premium founding cohort (free seats)", category: "Surveys", type: "number", default: "1000", unit: "seats", help: "The first N members can opt into Premium FREE immediately (before earning it) — seeds the premium tier from launch. 0 = no founding cohort (earned path only).", min: 0 },
  { key: "PREMIUM_AUTOQUALIFY_WINDOW_DAYS", label: "Auto-qualify: lookback window", category: "Surveys", type: "number", default: "365", unit: "days", help: "Trailing window over which qualifying survey-days are counted for auto-qualification.", min: 1 },
  { key: "SURVEY_CREATION_PRICE", label: "Survey creation price (business/creators)", category: "Surveys", type: "number", default: "0", unit: "$" },
  { key: "SURVEY_FRAUD_SPEEDER_SECONDS", label: "Fraud: min completion time", category: "Surveys", type: "number", default: "20", unit: "sec", help: "Completions faster than this are flagged." },
  { key: "VERIFIED_SURVEY_MIN_VALIDITY", label: "Verified survey: min AI validity", category: "Surveys", type: "number", default: "50", unit: "/100", help: "A voice/video response scored below this by the AI 'valid response' check is flagged & held (no payout) for review. Unscored (AI off) responses fall back to the normal quality/fraud gates.", min: 0, max: 100 },
  { key: "VERIFIED_SURVEY_MAX_AUDIO_MB", label: "Verified survey: max recording size", category: "Surveys", type: "number", default: "25", unit: "MB", min: 1, help: "Upper bound on a fallback (Whisper) audio upload. The raw recording is transcribed in memory and never stored." },
  { key: "AUTOFILL_MATCH_MIN_CONFIDENCE", label: "Voice/text autofill: min rules confidence", category: "Surveys", type: "number", default: "0.5", unit: "0-1", help: "Answers the FREE rules matcher resolves at/above this confidence skip the AI entirely. Only lower-confidence questions fall back to the cheap-tier model. Higher = more AI (more accurate, costlier); lower = more free matches.", min: 0, max: 1 },
  { key: "WHISPER_MODEL", label: "Transcription model", category: "Surveys", type: "string", default: "whisper-1", help: "OpenAI transcription model for voice survey answers." },

  // 7b. Revenue (business-side monetization — NEVER a customer markup)
  { key: "ADGRID_FUNDS_ALL_DISCOUNTS", label: "AdGrid funds all discounts (drop customer markup)", category: "Revenue", type: "boolean", default: "0", help: "ON = the advertiser/loyalty revenue pool funds the price discount for EVERY user (not just premium), so customers pay wholesale + discount and the markup is retired. Scale by signing more advertisers." },
  { key: "MARKETPLACE_MARGIN_SOURCE", label: "Marketplace margin source", category: "Revenue", type: "string", default: "cashback", help: "How the platform takes its marketplace margin: 'cashback' = seller keeps 100% AND gets cash-back points (perk funded by breakage + advertiser pool); 'seller' = commission taken from the seller; 'off' = seller keeps 100%, nothing added." },
  { key: "SELLER_CASHBACK_POINTS_PCT", label: "Seller cash-back points", category: "Revenue", type: "number", default: "0.10", unit: "×", help: "In 'cashback' mode, the % of the sale a seller gets back in non-cashable points (they still keep 100% of the sale). Funded by breakage + the advertiser pool — never the buyer.", min: 0, max: 1 },
  { key: "SELLER_CASHBACK_REQUIRES_ACTIVATION", label: "Seller cash-back requires user activation", category: "Revenue", type: "boolean", default: "true", help: "Hold the seller's 10% cash-back as LOCKED points until the seller signs up to use the site as a USER (one-click seller onboarding, agreeing to seller + user for a year). Keeps the perk inside the closed loop." },
  { key: "SELLER_USER_COMMITMENT_MONTHS", label: "Seller+user commitment term", category: "Revenue", type: "number", default: "12", unit: "months", help: "Length of the seller+user commitment captured at one-click activation. 12 = one year.", min: 1 },
  { key: "CURATOR_REWARD_POINTS_PCT", label: "Curator reward (catalog resale)", category: "Revenue", type: "number", default: "0.10", unit: "×", help: "When a user resells a platform-catalog product from their storefront (fulfilled by the AI), the % back in non-cashable points they earn on a real sale. Platform keeps the wholesale spread; buyer pays no markup. Locked until member activation, like seller cash-back.", min: 0, max: 1 },
  { key: "EXPECTED_REDEMPTION_RATE", label: "Growth: expected point redemption rate", category: "Growth", type: "number", default: "0.6", unit: "×", help: "Fraction of outstanding points you expect to be redeemed (used before there's enough real redemption history). Drives the cash RESERVE the growth engine holds so you never spend money you owe to points.", min: 0, max: 1 },
  { key: "GROWTH_RESERVE_SAFETY_PCT", label: "Growth: reserve safety buffer", category: "Growth", type: "number", default: "0.15", unit: "×", help: "Extra cushion added on top of the redemption reserve (0.15 = +15%). Higher = safer, less free to reinvest.", min: 0, max: 2 },
  { key: "GROWTH_REINVEST_PCT", label: "Growth: reinvest share of free surplus", category: "Growth", type: "number", default: "0.7", unit: "×", help: "Share of the FREE surplus (cash above the reserve) reinvested into marketing; the rest is booked as profit. Only applies while the growth loop is ON.", min: 0, max: 1 },
  { key: "GROWTH_LOOP_ACTIVE", label: "Growth: loop active (reinvest)", category: "Growth", type: "boolean", default: "true", help: "ON = reinvest free surplus into growth. OFF = 'break the loop' — take 100% of free surplus as profit, reinvest nothing." },
  { key: "GROWTH_LTV_YEARS", label: "Growth: LTV horizon (years)", category: "Growth", type: "number", default: "3", unit: "yrs", help: "Years of per-user contribution margin used for the simple LTV figure and payback check.", min: 0 },
  { key: "GROWTH_MAX_USERS_TARGET", label: "Growth: max-users target", category: "Growth", type: "number", default: "0", unit: "users", help: "Stop reinvesting (break the loop) once total users reach this number; free surplus then flows to profit. 0 = no cap.", min: 0 },
  { key: "PAYMENTS_PROVIDER", label: "Payments provider", category: "Growth", type: "string", default: "paypal", help: "Where incoming/outgoing funds route. 'paypal' = your PayPal business account. (Live capture/payout runs under your connected PayPal credentials; the app only records the flows.)" },
  { key: "PAYPAL_BUSINESS_EMAIL", label: "PayPal business email", category: "Growth", type: "string", default: "", help: "Your PayPal business account email. Used to label money flows; the actual PayPal API keys live in env/secrets, never here.", sensitive: true },
  { key: "PAYPAL_MERCHANT_ID", label: "PayPal merchant ID", category: "Growth", type: "string", default: "", help: "Your PayPal merchant/payer ID (optional label).", sensitive: true },
  { key: "BUYING_DESK_ENABLED", label: "Buying desk (manual fallback)", category: "Sourcing", type: "boolean", default: "true", help: "When on, orders with no sanctioned auto-channel queue for a team member to place by hand (batch-approved). Off = fall back to affiliate hand-off instead." },
  { key: "PRODUCT_FEED_CACHE_TTL_S", label: "Product-feed search cache (seconds)", category: "Sourcing", type: "number", default: "3600", unit: "s", help: "Cost lever: how long to cache a product-feed search so repeated queries don't re-bill the feed API. 3600 = 1 hour. 0 = no caching.", min: 0 },
  { key: "REFERRAL_SIGNUP_BONUS_POINTS", label: "Referral: activation bonus (points)", category: "Referrals", type: "number", default: "300", unit: "pts", help: "One-time bonus (in non-cashable points) paid to the referrer when their referred user completes a first fraud-screened survey. Platform-funded. Paid once per referral.", min: 0 },
  { key: "REFERRAL_OVERRIDE_PCT", label: "Referral: ongoing override", category: "Referrals", type: "number", default: "0.10", unit: "×", help: "The referrer earns this % in points on the SURVEY points their DIRECT referrals earn, for as long as those referrals stay active. Single-level only. Minted on top (platform-funded) — the referred user keeps 100% of their own points.", min: 0, max: 1 },
  { key: "REFERRAL_OVERRIDE_ENABLED", label: "Referral: override enabled", category: "Referrals", type: "boolean", default: "true", help: "Turn the ongoing 10% single-level override on/off." },
  { key: "REFERRAL_BONUS_REQUIRE_KYC", label: "Referral: require identity KYC for bonus", category: "Referrals", type: "boolean", default: "false", help: "Also require the referred user to be identity-verified (kyc_status/identity_verified) before paying the activation bonus. Leave off until identity KYC populates a user field; the first-survey + fraud screen already gates it." },
  { key: "CATALOG_WHOLESALE_FRACTION", label: "Catalog wholesale fraction (spread margin)", category: "Revenue", type: "number", default: "0.90", unit: "×", help: "For platform-catalog items with no explicit wholesale cost: assumed wholesale = this × face value. The remainder is the sourcing spread the platform keeps at points redemption (0.90 → ~10% margin).", min: 0, max: 1 },
  { key: "MARKETPLACE_SELLER_COMMISSION_PCT", label: "Marketplace commission (charged to SELLER, 'seller' mode)", category: "Revenue", type: "number", default: "0.10", unit: "×", help: "Only used when MARKETPLACE_MARGIN_SOURCE='seller'. Commission taken from the SELLER's proceeds — never added to the buyer's price.", min: 0, max: 1 },
  { key: "SPONSORED_PLACEMENT_PRICE_USD", label: "Sponsored placement / ad slot price", category: "Revenue", type: "number", default: "0", unit: "$", help: "What a business pays to feature/boost a listing or run an ad slot (per placement period). 0 = not sold yet.", min: 0 },
  { key: "BUSINESS_SIGNUP_FEE_USD", label: "Business sign-up fee", category: "Revenue", type: "number", default: "0", unit: "$", help: "One-time fee for a business/seller/advertiser to join. 0 = free to join.", min: 0 },
  { key: "BUSINESS_ONBOARDING_FEE_USD", label: "Business onboarding fee", category: "Revenue", type: "number", default: "0", unit: "$", help: "Optional one-time onboarding/setup fee on top of sign-up.", min: 0 },
  { key: "BUSINESS_SAAS_BASIC_USD", label: "B2B SaaS — Basic (monthly)", category: "Revenue", type: "number", default: "49", unit: "$/mo", min: 0 },
  { key: "BUSINESS_SAAS_PRO_USD", label: "B2B SaaS — Pro (monthly)", category: "Revenue", type: "number", default: "299", unit: "$/mo", min: 0 },
  { key: "BUSINESS_SAAS_ENTERPRISE_USD", label: "B2B SaaS — Enterprise (monthly)", category: "Revenue", type: "number", default: "999", unit: "$/mo", min: 0 },
  { key: "LEAD_REFERRAL_FEE_USD", label: "Lead/referral fee (flat)", category: "Revenue", type: "number", default: "0", unit: "$", help: "Flat fee a business pays when the platform sends them a customer/lead.", min: 0 },
  { key: "LEAD_REFERRAL_FEE_PCT", label: "Lead/referral fee (% of order)", category: "Revenue", type: "number", default: "0", unit: "×", help: "Success fee as a fraction of the referred order value.", min: 0, max: 1 },
  { key: "PROCESSING_REBATE_PCT", label: "Payment-processing rebate share", category: "Revenue", type: "number", default: "0", unit: "×", help: "Volume/interchange rebate share you keep from your processor (recorded as revenue; set once your processor deal is in place).", min: 0, max: 1 },
  { key: "DEV_CREATOR_PLATFORM_CUT_PCT", label: "Developer/creator marketplace cut", category: "Revenue", type: "number", default: "0.20", unit: "×", help: "Platform commission on developer/creator earnings (business side), never charged to players.", min: 0, max: 1 },
  { key: "BNPL_MERCHANT_FEE_PCT", label: "BNPL (Affirm) merchant fee to platform", category: "Revenue", type: "number", default: "0", unit: "×", help: "Merchant fee the financing partner pays the platform per financed order (recorded as revenue).", min: 0, max: 1 },
  { key: "AUDIENCE_PANEL_PRICE_USD", label: "Audience panel / segment survey price", category: "Revenue", type: "number", default: "0", unit: "$", help: "Price a business pays to run a survey/campaign against a targeted audience segment.", min: 0 },
  { key: "BREAKAGE_RECOGNITION_PCT", label: "Breakage recognition rate (reporting only)", category: "Revenue", type: "number", default: "0.15", unit: "×", help: "Fraction of OUTSTANDING closed-loop points assumed never redeemed, for the revenue REPORT only (not a cash booking).", min: 0, max: 1 },

  // 8. Gamification
  { key: "XP_PER_LEVEL", label: "XP per level (slope)", category: "Gamification", type: "number", default: "100", min: 1, help: "Level N needs XP_PER_LEVEL × N. Higher = slower leveling (awardUserXP)." },
  { key: "STREAK_DAILY_REWARD", label: "Daily streak reward", category: "Gamification", type: "number", default: "0", unit: "$", min: 0, help: "Paid daily to users with an active streak (autoDailyStreakEngine). 0 = off. Earn-cap aware.", sensitive: true },
  { key: "LEADERBOARD_RESET_DAYS", label: "Leaderboard reset cadence", category: "Gamification", type: "number", default: "7", unit: "days", min: 0, help: "Weekly board resets every N days (all-time kept; winners archived). 0 = disabled (leaderboardReset)." },

  // 9. AI & agents
  { key: "AI_GLOBAL_HUMAN_GATE", label: "Require human approval before a change goes global", category: "AI & Agents", type: "boolean", default: "0", sensitive: true, help: "OFF (default) = the AI conducts its own review and auto-promotes changes that pass individual-user statistical approval. ON (optional) = a change instead waits for the daily peak-time human review before going site-wide." },
  { key: "CHANGE_GLOBAL_MIN_APPROVAL", label: "Min user approval to go global", category: "AI & Agents", type: "number", default: "0.7", unit: "×", min: 0.5, max: 1, help: "Share of individual users who must answer YES before a change is eligible to go site-wide (also requires statistical confidence)." },
  { key: "CHANGE_GLOBAL_MIN_SAMPLE", label: "Min user votes to go global", category: "AI & Agents", type: "number", default: "20", min: 1, help: "Minimum number of individual yes/no votes before a change can be promoted." },
  { key: "PEAK_REVIEW_HOUR_UTC", label: "Daily human review hour (UTC)", category: "AI & Agents", type: "number", default: "18", min: 0, max: 23, help: "The one-per-day, peak-usage hour when a human reviews and promotes eligible changes to global." },
  { key: "PEAK_REVIEW_WINDOW_HOURS", label: "Human review window length", category: "AI & Agents", type: "number", default: "1", unit: "hours", min: 1, max: 6, help: "How long the daily global-review window stays open (default 1 hour)." },
  { key: "OVERHEAD_PAUSED_EXPERIMENTS", label: "Overhead monitor paused experiments (internal marker)", category: "AI & Agents", type: "boolean", default: "0", sensitive: true, help: "Set by the overhead monitor when IT pauses live experiments for AI-spend, so it (and only it) can auto-resume them when spend recovers — without overriding an admin's manual kill switch." },
  { key: "LLM_PROVIDER", label: "LLM provider", category: "AI & Agents", type: "select", options: ["groq", "openai", "anthropic", "self"], default: "groq", help: "groq = Llama on Groq's free tier (no GPU); needs GROQ_API_KEY, falls back to OpenAI until it's set. self = your own OpenAI-compatible server. Managed = openai/anthropic." },
  { key: "GROQ_MODEL_SMALL", label: "Groq model — cheap tier", category: "AI & Agents", type: "string", default: "llama-3.1-8b-instant", help: "Groq model for the default/cheap tier (most calls). Free-tier friendly." },
  { key: "GROQ_MODEL_LARGE", label: "Groq model — reasoning tier", category: "AI & Agents", type: "string", default: "llama-3.3-70b-versatile", help: "Groq model for calls that pass model:\"gpt_5\" (real reasoning). Competitive with GPT-4o-class on text tasks." },
  { key: "LLM_MODEL_DEFAULT", label: "OpenAI default model", category: "AI & Agents", type: "string", default: "gpt-4o-mini" },
  { key: "LLM_MODEL_LARGE", label: "OpenAI large model", category: "AI & Agents", type: "string", default: "gpt-4o" },
  { key: "CLAUDE_MODEL_DEFAULT", label: "Claude default model", category: "AI & Agents", type: "string", default: "claude-3-5-sonnet-latest" },
  { key: "AGENT_MODEL", label: "Agent model", category: "AI & Agents", type: "string", default: "gpt-4o" },
  { key: "AGENT_MAX_STEPS", label: "Agent max steps", category: "AI & Agents", type: "number", default: "6" },
  { key: "LLM_CONCURRENCY", label: "LLM concurrency", category: "AI & Agents", type: "number", default: "4" },
  { key: "IMAGE_PROVIDER", label: "Image provider", category: "AI & Agents", type: "select", options: ["cloudflare", "openai", "stability", "aws_bedrock", "aws_sagemaker", "self"], default: "cloudflare", help: "cloudflare = Cloudflare Workers AI (FLUX-1-schnell, free tier, no GPU); needs CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN, falls back to aws_bedrock until set. aws_bedrock = serverless GPU (Titan ~$0.01/image). self = your own SDXL/FLUX server." },
  { key: "IMAGE_MODEL", label: "Image model (Bedrock/OpenAI/Stability)", category: "AI & Agents", type: "string", default: "amazon.titan-image-generator-v1", help: "Model for the aws_bedrock / stability / openai providers. (Cloudflare uses CF_IMAGE_MODEL instead.)" },
  { key: "CF_IMAGE_MODEL", label: "Cloudflare image model", category: "AI & Agents", type: "string", default: "@cf/black-forest-labs/flux-1-schnell", help: "Workers AI model. flux-1-schnell = fast, commercially licensed (Apache-2.0), free tier. Alternatives: @cf/stabilityai/stable-diffusion-xl-base-1.0, @cf/bytedance/stable-diffusion-xl-lightning." },
  { key: "CF_IMAGE_STEPS", label: "Cloudflare FLUX steps", category: "AI & Agents", type: "number", default: "4", help: "Diffusion steps for FLUX-schnell (1–8). 4 is the sweet spot for speed/quality.", min: 1, max: 8 },

  // Self-hosted / open-model backends — flip a capability to your own server, no code change. Managed stays
  // the default; `self` falls back to managed on error. See SELF-HOSTED-PROVIDERS.md.
  { key: "PROVIDER_STT", label: "Speech-to-text provider", category: "AI & Agents", type: "select", options: ["groq", "managed", "self"], default: "groq", help: "groq = Whisper on Groq's free tier (no GPU); needs GROQ_API_KEY, falls back to OpenAI Whisper until set. managed = OpenAI Whisper. self = your faster-whisper server." },
  { key: "GROQ_STT_MODEL", label: "Groq STT model", category: "AI & Agents", type: "string", default: "whisper-large-v3-turbo", help: "Whisper model on Groq. whisper-large-v3-turbo = fastest/cheapest; whisper-large-v3 = top accuracy." },
  { key: "PROVIDER_TTS", label: "Text-to-speech provider", category: "AI & Agents", type: "select", options: ["managed", "openai", "polly", "self"], default: "managed", help: "managed = ElevenLabs (natural, pricier) else device voice. openai = tts-1 (~10× cheaper). polly = Amazon Polly (free tier 5M chars/mo first year, then ~$4/1M, reuses AWS creds). self = your XTTS/Piper server. (Groq has no TTS.)" },
  { key: "TTS_OPENAI_MODEL", label: "OpenAI TTS model", category: "AI & Agents", type: "string", default: "tts-1", help: "Used when PROVIDER_TTS=openai. tts-1 = cheap/fast; tts-1-hd = higher quality." },
  { key: "POLLY_VOICE", label: "Amazon Polly voice", category: "AI & Agents", type: "string", default: "Joanna", help: "Polly VoiceId when PROVIDER_TTS=polly (e.g. Joanna, Matthew, Danielle, Ruth)." },
  { key: "POLLY_ENGINE", label: "Amazon Polly engine", category: "AI & Agents", type: "select", options: ["neural", "standard"], default: "neural", help: "neural = best quality (~$16/1M). standard = cheapest (~$4/1M, 5M/mo free first year)." },
  { key: "TTS_CACHE_ENABLED", label: "Cache synthesized speech", category: "AI & Agents", type: "boolean", default: "1", help: "Cache audio by (provider, voice, text) so repeated prompts — survey questions, canned cheers — synthesize ONCE. Biggest TTS cost cut. Most effective with REDIS_URL set (shared cache)." },
  { key: "TTS_CACHE_TTL_DAYS", label: "Speech cache lifetime", category: "AI & Agents", type: "number", default: "30", unit: "days", help: "How long cached audio lives. Repeated prompts within this window cost nothing to re-voice.", min: 1 },
  { key: "IOS_LAUNCH", label: "Launching native iOS too", category: "AI & Agents", type: "boolean", default: "0", help: "Set on if you're shipping a native iOS build at launch. Adds Apple's $99/yr to the setup wizard's cost estimate (web + Android need no Apple fee)." },
  { key: "TTS_OPENAI_VOICE", label: "OpenAI TTS voice", category: "AI & Agents", type: "string", default: "alloy", help: "alloy, echo, fable, onyx, nova, or shimmer." },
  { key: "SELF_LLM_URL", label: "Self LLM endpoint", category: "AI & Agents", type: "string", default: "", help: "OpenAI-compatible /chat/completions URL (vLLM/Ollama/TGI). Used when LLM_PROVIDER=self." },
  { key: "SELF_LLM_MODEL", label: "Self LLM model", category: "AI & Agents", type: "string", default: "llama-3.1-8b-instruct", help: "Model name your self-hosted LLM server serves." },
  { key: "SELF_LLM_KEY", label: "Self LLM bearer (optional)", category: "AI & Agents", type: "string", default: "", help: "Optional bearer token if your self LLM server requires auth." },
  { key: "SELF_STT_URL", label: "Self STT endpoint", category: "AI & Agents", type: "string", default: "", help: "OpenAI-compatible /audio/transcriptions URL (faster-whisper). Used when PROVIDER_STT=self." },
  { key: "SELF_STT_MODEL", label: "Self STT model", category: "AI & Agents", type: "string", default: "Systran/faster-whisper-base", help: "Whisper model your STT server serves." },
  { key: "SELF_STT_KEY", label: "Self STT bearer (optional)", category: "AI & Agents", type: "string", default: "" },
  { key: "SELF_TTS_URL", label: "Self TTS endpoint", category: "AI & Agents", type: "string", default: "", help: "Your TTS server URL (XTTS/Piper). Returns audio bytes or JSON {audio_base64}. Used when PROVIDER_TTS=self." },
  { key: "SELF_TTS_VOICE", label: "Self TTS voice", category: "AI & Agents", type: "string", default: "", help: "Voice id/name your TTS server expects." },
  { key: "SELF_TTS_MIME", label: "Self TTS audio type", category: "AI & Agents", type: "string", default: "audio/mpeg" },
  { key: "SELF_TTS_KEY", label: "Self TTS bearer (optional)", category: "AI & Agents", type: "string", default: "" },
  { key: "SELF_IMAGE_URL", label: "Self image endpoint", category: "AI & Agents", type: "string", default: "", help: "Your SDXL/FLUX HTTP server (A1111/ComfyUI/OpenAI-images-compatible). Used when IMAGE_PROVIDER=self." },
  { key: "SELF_IMAGE_KEY", label: "Self image bearer (optional)", category: "AI & Agents", type: "string", default: "" },

  // Self-host advisor — watches REAL hosted spend per capability and recommends flipping to your own GPU
  // once it'd be cheaper than the hosted bills. Surfaced in the admin panel (ProviderAdvisor).
  { key: "GPU_MONTHLY_COST_USD", label: "Self-hosted GPU monthly cost (break-even)", category: "AI & Agents", type: "number", default: "400", unit: "$/mo", help: "Reference monthly cost of a self-hosted GPU (rented or amortized). The advisor recommends switching a capability to self-hosting once its projected monthly hosted spend beats this.", min: 0 },
  { key: "SELFHOST_RECOMMEND_MARGIN", label: "Self-host recommend margin", category: "AI & Agents", type: "number", default: "1.2", unit: "×", help: "Recommend self-hosting once projected monthly spend ≥ GPU cost × this. 1.2 = wait until it's 20% past break-even (avoids flip-flopping).", min: 1 },
  { key: "IMAGE_COST_USD", label: "Per-image cost estimate", category: "AI & Agents", type: "number", default: "0.01", unit: "$", help: "Approx cost per generated image, used only to meter the image capability for the self-host advisor.", min: 0 },
  { key: "CATALOG_IMAGES_ENABLED", label: "Generate catalog product images", category: "AI & Agents", type: "boolean", default: "1", help: "Kill switch. OFF = catalog listings launch text-only (no image generation, $0)." },
  { key: "CATALOG_IMAGES_MAX_PER_RUN", label: "Max catalog images per seed run", category: "AI & Agents", type: "number", default: "100", min: 0, help: "Budget guard — a single catalog seed run won't generate more images than this, so cost is paced across scheduled runs." },
  { key: "CATALOG_SUBCATEGORY_IMAGES", label: "Generate subcategory tile images", category: "AI & Agents", type: "boolean", default: "0", help: "Budget posture OFF = only the ~40 top-level department tiles get images (keeps total ≈ $10–15 one-time). ON = also generate ~905 subcategory tiles." },
  { key: "SERVICE_SUBCATEGORY_IMAGES", label: "Generate service subcategory tiles", category: "AI & Agents", type: "boolean", default: "0", help: "OFF = only the top-level Services department tiles get GPU images (cheap, one-time). ON = also generate every service subsection tile." },
  { key: "CATALOG_IMAGE_SIZE", label: "Catalog image size", category: "AI & Agents", type: "string", default: "1024x1024" },
  { key: "CATALOG_IMAGE_STYLE", label: "Catalog image style prompt", category: "AI & Agents", type: "string", default: "clean studio product photograph on a plain white background, centered, soft even lighting, e-commerce style, high detail, no text, no logos, no watermark" },
  { key: "CATALOG_COUNTRIES", label: "Marketplace catalog countries", category: "Marketplace", type: "string", default: "US", help: "Comma-separated ISO country codes to auto-populate the marketplace for. Add a code when you launch a new country and the scheduled seeder fills its catalog." },
  { key: "CATALOG_CATEGORY_SOURCE", label: "Catalog category source", category: "Marketplace", type: "select", options: ["taxonomy", "settings"], default: "taxonomy", help: "taxonomy = span the full hierarchical taxonomy's 900+ subcategories (recommended). settings = use the flat CATALOG_CATEGORIES list instead." },
  // Welcome rewards (promotional discount credit — non-cashable, breakage-funded). Applied to PLATFORM
  // catalog + store items only, so the cost is platform margin, never a subsidy to third-party sellers.
  { key: "WELCOME_REWARDS_TOTAL", label: "Welcome rewards pool ($)", category: "Marketplace", type: "number", default: "1460", min: 0, help: "Face value of the non-cashable welcome-rewards discount credit granted at signup. Cost is bounded by the per-order cap + expiry + breakage." },
  { key: "WELCOME_REWARDS_MAX_PCT", label: "Welcome rewards max per order", category: "Marketplace", type: "number", default: "0.20", unit: "×", min: 0, max: 1, help: "Max share of any one order the welcome credit can cover (0.20 = 20%)." },
  { key: "WELCOME_REWARDS_EXPIRY_DAYS", label: "Welcome rewards expiry (days)", category: "Marketplace", type: "number", default: "365", min: 0, help: "Unused welcome credit expires this many days after signup." },
  { key: "ADVERTISED_VALUE_TOTAL", label: "Advertised first-year value ($)", category: "Marketplace", type: "number", default: "2000", min: 0, help: "The substantiated 'up to $X in value' figure shown site-wide, DERIVED from the full value stack (welcome rewards $1,460 + premium AI ~$120 + Daily Boost ~$180 + cash-back ~$100 + contest entries ~$60 + referral/streak ~$80). Keep it truthful with 'up to' + disclosure — see WELCOME-REWARDS-AND-VALUE-STACK.md." },
  { key: "DAILY_BOOST_THRESHOLD_USD", label: "Daily Boost earn threshold ($)", category: "Marketplace", type: "number", default: "4", min: 0, help: "Earn this much in offers in a day to unlock the Daily Boost free-app-time window." },
  { key: "DAILY_BOOST_MINUTES", label: "Daily Boost free-app minutes", category: "Marketplace", type: "number", default: "5", min: 0, help: "Minutes of free app use (no in-app-purchase charges) granted per day once the earn threshold is met." },
  { key: "DAILY_BOOST_CREDIT_USD", label: "Daily Boost credit cap ($)", category: "Marketplace", type: "number", default: "1", min: 0, help: "Max in-app-purchase value covered during the free window. Keep BELOW your average offer payout so it stays funded by advertiser revenue (net-neutral)." },
  { key: "CATALOG_LISTINGS_PER_COUNTRY", label: "Catalog listings per country", category: "Marketplace", type: "number", default: "440", min: 0, max: 20000, help: "Target number of original platform listings to keep active per country. The seeder tops up toward this (spread across all catalog categories). Images are generated once per template, then reused per country." },
  { key: "CATALOG_CATEGORIES", label: "Catalog categories (Amazon-scale)", category: "Marketplace", type: "string", default: "Electronics,Headphones,Cell Phones & Accessories,Cameras & Photo,Camera Lenses,Wearable Technology,Smartwatches,Smart Home,Smart Home Lighting,Smart Security,Home Audio,Portable Audio,Speakers,Televisions,Home Theater,Projectors,GPS & Navigation,Car Electronics,Computers & Tablets,Laptops,Desktops,Tablets,Computer Accessories,Monitors,Keyboards & Mice,Networking,Routers,Data Storage,External Drives,Printers & Ink,Computer Components,Graphics Cards,PC Gaming,Video Game Consoles,Video Games,Gaming Accessories,VR Headsets,Drones,eBook Readers,Office Electronics,Batteries & Chargers,Power & Surge Protection,Home & Kitchen,Kitchen & Dining,Cookware,Bakeware,Kitchen Appliances,Small Kitchen Appliances,Coffee & Espresso,Blenders & Juicers,Air Fryers,Cutlery,Dinnerware,Drinkware,Food Storage,Kitchen Storage & Organization,Bedding,Comforters & Sets,Sheets & Pillowcases,Pillows,Bath,Towels,Shower Curtains,Furniture,Living Room Furniture,Bedroom Furniture,Mattresses,Office Furniture,Kitchen & Dining Furniture,Outdoor Furniture,Home Décor,Wall Art,Clocks,Candles & Holders,Lighting,Lamps,Ceiling Lighting,Rugs,Curtains & Drapes,Vacuum & Floor Care,Robot Vacuums,Heating & Cooling,Fans,Air Purifiers,Humidifiers,Home Appliances,Irons & Steamers,Sewing Machines,Cleaning Supplies,Laundry,Tools & Home Improvement,Power Tools,Hand Tools,Tool Storage,Hardware,Fasteners,Electrical,Light Bulbs,Plumbing,Painting Supplies,Building Materials,Kitchen & Bath Fixtures,Safety & Security,Smart Locks,Welding,Measuring & Layout,Generators & Portable Power,Patio Lawn & Garden,Gardening & Lawn Care,Planters,Outdoor Power Tools,Lawn Mowers,Grills & Outdoor Cooking,Patio Furniture,Outdoor Décor,Pools & Spas,Pest Control,Snow Removal,Plants Seeds & Bulbs,Beauty & Personal Care,Skin Care,Makeup,Hair Care,Hair Tools,Fragrance,Nail Care,Bath & Body,Men's Grooming,Shaving & Hair Removal,Oral Care,Personal Care Appliances,Health & Household,Vitamins & Supplements,Sports Nutrition,Health Care,Household Supplies,Sexual Wellness,Medical Supplies,Mobility & Daily Living Aids,Wellness & Relaxation,Massage & Relaxation,Vision Care,First Aid,Grocery & Gourmet Food,Snack Foods,Beverages,Coffee Tea & Cocoa,Breakfast Foods,Pantry Staples,Candy & Chocolate,Condiments & Sauces,Organic & Specialty Foods,Baby,Diapering,Baby Feeding,Strollers,Car Seats,Nursery,Baby Toys,Baby Clothing,Baby Safety,Toys & Games,Action Figures,Building Toys,Dolls & Accessories,Games & Puzzles,Board Games,Learning & Educational Toys,Arts & Crafts for Kids,Outdoor Play,Stuffed Animals & Plush,RC Vehicles,Collectible Toys,Party Supplies,Women's Clothing,Men's Clothing,Girls' Clothing,Boys' Clothing,Women's Shoes,Men's Shoes,Kids' Shoes,Women's Accessories,Men's Accessories,Handbags & Wallets,Watches,Fine Jewelry,Fashion Jewelry,Sunglasses & Eyewear,Luggage & Travel Gear,Backpacks,Activewear,Lingerie & Sleepwear,Coats & Jackets,Sports & Outdoors,Exercise & Fitness,Strength Training,Cardio Equipment,Yoga,Cycling,Camping & Hiking,Fishing,Hunting,Team Sports,Water Sports,Winter Sports,Golf,Outdoor Recreation,Athletic Clothing,Automotive,Car Care,Car Parts,Interior Accessories,Exterior Accessories,Tires & Wheels,Automotive Tools & Equipment,Motorcycle & Powersports,Oils & Fluids,RV Parts & Accessories,Pet Supplies,Dog Supplies,Cat Supplies,Fish & Aquatics,Bird Supplies,Small Animal Supplies,Reptile Supplies,Pet Food,Pet Health,Office Products,Office Supplies,Writing & Correction,Paper Products,School Supplies,Filing & Organization,Calendars & Planners,Books,eBooks,Audiobooks,Textbooks,Magazines,Movies & TV,Music CDs & Vinyl,Musical Instruments,Guitars,Keyboards & Pianos,Drums & Percussion,Recording Equipment,DJ Equipment,Band & Orchestra,Amplifiers & Effects,Industrial & Scientific,Lab & Scientific Products,Janitorial & Sanitation,Material Handling,Industrial Power Tools,Occupational Safety,Test & Measurement,3D Printing,Arts Crafts & Sewing,Painting & Drawing,Knitting & Crochet,Beading & Jewelry Making,Scrapbooking,Fabric,Craft Supplies,Handmade Jewelry,Handmade Home Décor,Handmade Artwork,Collectibles & Fine Art,Coins & Currency,Stamps,Sports Memorabilia,Trading Cards,Antiques,Major Appliances,Refrigerators,Washers & Dryers,Dishwashers,Ranges & Ovens,Microwaves,Freezers,Software,Business & Office Software,Security Software,Education Software", help: "Comma-separated departments + subcategories the catalog spans, sized to match a large retailer's breadth. The seeder distributes listings across all of them; each is an original AI product concept." },
  { key: "AI_DAILY_SPEND_CAP_USD", label: "AI daily spend cap", category: "AI & Agents", type: "number", default: "0", unit: "$", help: "0 = no cap. Global guardrail — LLM calls are refused once estimated spend today crosses this.", min: 0 },
  { key: "AI_COST_PER_1K_TOKENS", label: "AI cost estimate ($/1k tokens)", category: "AI & Agents", type: "number", default: "0.01", unit: "$", help: "Blended input+output rate used to estimate spend against the daily cap.", min: 0 },
  { key: "OPTIMIZER_REQUIRE_EXPERIMENT", label: "Test AI changes with customers first", category: "AI & Agents", type: "boolean", default: "1", help: "ON = every AI-proposed change is A/B mockup-tested with a customer survey before it can go live." },

  // 9b. Know-Your-Customer survey (mandatory first survey → personalization)
  { key: "KYC_REWARD_USD", label: "KYC survey reward ($, non-cashable)", category: "AI & Agents", type: "number", default: "5", unit: "$", min: 0, help: "Non-cashable promotional value granted once when a new user completes the mandatory Know-Your-Customer first survey. Added to the welcome-rewards pool (per-order cap + expiry apply), so it's real value at $0 cash cost via breakage. Counted inside the 'up to $X value' stack." },
  { key: "KYC_SURVEY_REQUIRED", label: "KYC survey mandatory for new users", category: "AI & Agents", type: "boolean", default: "1", help: "ON = the KYC survey is the required first survey after first login and gates the app until completed. Also flagged by the kyc_survey compliance flag." },

  // 9c. Site telemetry + self-learning capture (statistically-backed, budget-capped)
  { key: "TELEMETRY_ENABLED", label: "Capture interaction telemetry", category: "AI & Agents", type: "boolean", default: "1", help: "Lightweight event capture (clicks, views, scroll depth, funnels) — default-on and ~free. Feeds the statistical layer + self-learning. Honors the site_telemetry flag and each user's behavioral opt-out; PII is masked." },
  { key: "TELEMETRY_MAX_EVENTS_PER_BATCH", label: "Max telemetry events per request", category: "AI & Agents", type: "number", default: "60", min: 1, max: 500, help: "Server bound on how many interaction events one ingest call accepts, so a client can't inflate storage." },
  { key: "TELEMETRY_RETENTION_DAYS", label: "Telemetry retention (days)", category: "AI & Agents", type: "number", default: "180", min: 1, help: "Raw interaction events older than this are pruned; the derived statistical aggregates are kept." },
  { key: "SESSION_CAPTURE_SAMPLE_PCT", label: "Session-screenshot sample rate", category: "AI & Agents", type: "number", default: "0.02", unit: "×", min: 0, max: 1, help: "Rotating fraction of sessions eligible for screenshot/session-replay capture (0.02 = 2%). A representative sample is what makes the design signal statistically valid — you do not need every session. Only active when the session_screenshots flag is ON." },
  { key: "SESSION_CAPTURE_MAX_SHOTS_PER_SESSION", label: "Max screenshots per sampled session", category: "AI & Agents", type: "number", default: "6", min: 1, max: 60, help: "Upper bound on frames captured for a sampled session — keeps storage tiny." },
  { key: "SESSION_CAPTURE_DAILY_BUDGET_USD", label: "Session-capture AI analysis daily budget ($)", category: "AI & Agents", type: "number", default: "0", unit: "$", min: 0, help: "Sub-cap for the batched AI analysis of captured sessions. 0 = fall back to the global AI_DAILY_SPEND_CAP_USD. The batch analyzer stops once this (or the global cap) is reached — the hard ceiling that keeps capture cheap." },
  { key: "SESSION_CAPTURE_BATCH_SIZE", label: "Session-capture analysis batch size", category: "AI & Agents", type: "number", default: "20", min: 1, max: 200, help: "How many sampled sessions the scheduled analyzer reviews per run, paced under the budget." },
  { key: "SELF_LEARNING_MIN_SAMPLE", label: "Self-learning minimum sample size", category: "AI & Agents", type: "number", default: "30", min: 1, help: "A statistic must be backed by at least this many data points before it becomes an actionable signal or a proposed change. Enforces 'small, iterative, statistically-correlated' changes." },

  // 9d. Live experimentation (24h test → promote-if-better, bandit, circuit breaker, canary)
  { key: "OPTIMIZER_LIVE_TEST", label: "Live-test AI changes on real traffic", category: "AI & Agents", type: "boolean", default: "1", help: "ON = a non-sensitive AI-proposed change is deployed as a LIVE A/B holdout on a small, growing slice of traffic and only promoted if the live data shows a statistically significant uptick with no guardrail regression. Promotion is a config flip (no downtime); revert is one flip. Money/compliance changes never enter this — they stay human-gated. Also honors the live_experiments flag." },
  { key: "LIVE_TEST_WINDOW_HOURS", label: "Live-test window (hours)", category: "AI & Agents", type: "number", default: "24", min: 1, help: "How long a live experiment runs before it must decide. A clear significant winner/loser can stop early; ambiguous tests expire to control at the window." },
  { key: "LIVE_TEST_START_SHARE", label: "Live-test starting traffic share", category: "AI & Agents", type: "number", default: "0.1", unit: "×", min: 0.01, max: 1, help: "Fraction of eligible users first exposed to the variant. The bandit grows this toward the canary cap while the variant wins, or shrinks it while it loses." },

  // 9e. Personalized (segment) learning + graduation to site-wide
  { key: "OPTIMIZER_SEGMENT_TESTING", label: "Test changes per user-segment first", category: "AI & Agents", type: "boolean", default: "1", help: "ON = a non-sensitive change is tested on the most active user SEGMENT first (personalized, applied per-user at login). A strong segment winner then graduates to a site-wide test. OFF = test site-wide directly. Aggregate significance across the segment's users is always required, so it stays statistically valid." },
  { key: "GRADUATION_LIFT_PCT", label: "Segment→site-wide graduation lift", category: "AI & Agents", type: "number", default: "15", unit: "%", min: 0, help: "A segment winner whose live lift is at least this large is nominated for a site-wide 24h validation experiment (graduationScan). If that passes, it flips globally across web, PWA, and native — no downtime." },
  { key: "SEGMENT_MIN_SAMPLE", label: "Segment minimum sample size", category: "AI & Agents", type: "number", default: "50", min: 1, help: "Minimum users/events in a segment before a per-segment result is trusted. Guards against 'positive for one user' noise." },
  { key: "LIVE_EXPERIMENTS_PAUSED", label: "Pause all live experiments (kill switch)", category: "AI & Agents", type: "boolean", default: "0", sensitive: true, help: "Emergency brake. ON = instantly halt all live-experiment assignment, exposure, ticking, and creation (already-promoted and segment-kept changes stay in place). Same effect as the experiments_paused flag. Turn OFF to resume." },

  // 9f. Self-learning overhead governor (keeps the measurement system from ever becoming the cost)
  { key: "TELEMETRY_SAMPLE_PCT", label: "Telemetry capture sample rate", category: "AI & Agents", type: "number", default: "1", unit: "×", min: 0, max: 1, help: "Fraction of sessions whose interaction telemetry is stored (1 = all). The overhead monitor lowers this automatically if event volume gets large, so cost stays bounded. Session-consistent (a session is fully in or out)." },
  { key: "OVERHEAD_MAX_EVENTS_PER_DAY", label: "Telemetry volume ceiling / day", category: "AI & Agents", type: "number", default: "0", min: 0, help: "If more than this many interaction-event batches are stored in a day, the overhead monitor lowers TELEMETRY_SAMPLE_PCT and SESSION_CAPTURE_SAMPLE_PCT to throttle. 0 = no ceiling (don't auto-throttle volume)." },
  { key: "OVERHEAD_AI_SPEND_PAUSE_PCT", label: "Pause experiments at AI-spend fraction", category: "AI & Agents", type: "number", default: "0.9", unit: "×", min: 0, max: 1, help: "If today's AI spend reaches this fraction of AI_DAILY_SPEND_CAP_USD, the overhead monitor pauses live experiments for the day so the learning system never crowds out user-facing AI. 0/1 with no cap set = disabled." },

  // 13. Points Boost (closed-loop "your points grow while you hold them" — non-cashable, breakage-funded)
  // Rate knobs are AI-tunable within these bounds; the USD CAPS below are the real cost governors and are
  // NOT auto-tuned, so the feature can optimize its feel while its cost stays hard-capped at ~$0 marginal.
  { key: "BOOST_BASE_RATE", label: "Boost base rate", category: "Points Boost", type: "number", default: "0.5", unit: "%", min: 0, max: 20, help: "Baseline annualized Boost % everyone gets on their points balance. Non-cashable bonus; cost bounded by the caps below." },
  { key: "BOOST_STREAK_RATE", label: "Boost per streak day", category: "Points Boost", type: "number", default: "0.3", unit: "%", min: 0, max: 5, help: "Extra Boost % per day of active streak." },
  { key: "BOOST_STREAK_CAP", label: "Boost streak cap", category: "Points Boost", type: "number", default: "4", unit: "%", min: 0, max: 20, help: "Max Boost % the streak factor can add." },
  { key: "BOOST_HOLD_RATE_PER_DAY", label: "Boost per day held (tenure)", category: "Points Boost", type: "number", default: "0.02", unit: "%", min: 0, max: 1, help: "Extra Boost % per day of account tenure — rewards holding." },
  { key: "BOOST_HOLD_CAP", label: "Boost tenure cap", category: "Points Boost", type: "number", default: "3", unit: "%", min: 0, max: 20, help: "Max Boost % the tenure factor can add." },
  { key: "BOOST_VAULT_BONUS_PCT", label: "Boost Vault bonus", category: "Points Boost", type: "number", default: "2", unit: "%", min: 0, max: 10, help: "Extra Boost % while the user has vaulted (locked) points." },
  { key: "BOOST_MAX_PCT", label: "Boost maximum %", category: "Points Boost", type: "number", default: "10", unit: "%", min: 0, max: 50, sensitive: true, help: "Hard ceiling on any user's total Boost %. Admin-owned." },
  { key: "BOOST_DAILY_CAP_USD", label: "Boost daily cap ($)", category: "Points Boost", type: "number", default: "0.25", unit: "$", min: 0, sensitive: true, help: "COST GOVERNOR. Max non-cashable value a user can harvest per day. Keep small — this bounds the whole feature's cost. Admin-owned; not auto-tuned." },
  { key: "BOOST_LIFETIME_CAP_USD", label: "Boost lifetime cap ($)", category: "Points Boost", type: "number", default: "50", unit: "$", min: 0, sensitive: true, help: "COST GOVERNOR. Max non-cashable value a user can ever harvest from Boost. Admin-owned; not auto-tuned." },
  { key: "BOOST_AUTO_CREDIT", label: "Auto-harvest Boost daily", category: "Points Boost", type: "boolean", default: "1", help: "ON = the daily job credits each user's accrued Boost automatically (they don't have to click Harvest)." },

  // 14. Physical Items store (ship / local pickup) + affordability warning
  { key: "PHYSICAL_AFFORDABILITY_LIMIT_USD", label: "Affordability warning threshold ($)", category: "Marketplace", type: "number", default: "1460", unit: "$", min: 0, help: "If a physical-item order total exceeds this, the buyer is warned it's more than they can reasonably earn/pay back in a year (matches the welcome-rewards figure). A warning, not a hard block." },
  { key: "PICKUP_RADIUS_NOTE", label: "Local pickup note", category: "Marketplace", type: "string", default: "Pickup items are listed by nearby sellers and local partners. Arrange pickup at the location shown on the listing.", help: "Shown on the Local Pickup tab." },
  { key: "LAYAWAY_MAX_MONTHLY_USD", label: "Layaway max monthly ($)", category: "Marketplace", type: "number", default: "90", unit: "$", min: 1, help: "A layaway plan is spread over enough months that the required monthly payment never exceeds this (default $90). Buyers pay it down with earned points before the item ships — no credit is extended." },
  { key: "PROMO_FUNDED_BY_MARKUP", label: "Welcome credit funded by markup (margin-positive)", category: "Marketplace", type: "boolean", default: "0", help: "OFF (markup is now 0 for all users) = the welcome discount uses its full per-order cap, funded by breakage + the advertiser pool instead of a markup. ON only makes sense if STORE_MARKUP > 0." },

  // 10. Compliance & legal (numeric/string; the on/off kill-switches live in complianceFlags)
  { key: "TERMS_VERSION", label: "Terms version (bump to force re-consent)", category: "Compliance & Legal", type: "string", default: "2026-07-01", sensitive: true },
  { key: "AD_DISCLOSURE_TAG", label: "FTC ad-disclosure tag", category: "Compliance & Legal", type: "string", default: "#ad" },
  { key: "BUSINESS_MAILING_ADDRESS", label: "CAN-SPAM mailing address", category: "Compliance & Legal", type: "string", default: "" },
  { key: "DMCA_AGENT_EMAIL", label: "DMCA designated-agent email", category: "Compliance & Legal", type: "string", default: "" },
  { key: "TAX_1099_THRESHOLD", label: "1099 reportable threshold", category: "Compliance & Legal", type: "number", default: "600", unit: "$", sensitive: true },
  { key: "TAX_BACKUP_WITHHOLDING_RATE", label: "Backup withholding rate", category: "Compliance & Legal", type: "number", default: "0.24", unit: "×", sensitive: true, min: 0, max: 1 },
  { key: "MIN_AGE", label: "Minimum age", category: "Compliance & Legal", type: "number", default: "18", unit: "years", sensitive: true, min: 18, max: 120, help: "Hard floor of 18 — a money-earning app is 18+ (COPPA / minor-contract). Cannot be set lower." },
  { key: "SWEEPSTAKES_REG_THRESHOLD", label: "Prize size that triggers registration review", category: "Compliance & Legal", type: "number", default: "5000", unit: "$", sensitive: true },
  { key: "HOUSEHOLD_MAX_MEMBERS", label: "Max members per household", category: "Compliance & Legal", type: "number", default: "6", min: 2, max: 12, help: "Adults + teens under one account holder (Amazon Household allows ~2 adults + 4 teens)." },
  { key: "HOUSEHOLD_TEEN_MIN_AGE", label: "Teen account minimum age", category: "Compliance & Legal", type: "number", default: "13", unit: "years", sensitive: true, min: 13, max: 17, help: "Teens are 13–17. Teen enrollment ALSO requires the teen_accounts flag (OFF until counsel sign-off)." },

  // 11. Messaging & marketing
  { key: "EMAIL_FROM", label: "Email 'from' address", category: "Messaging & Marketing", type: "string", default: "no-reply@yourdomain.com" },
  { key: "EMAIL_PROVIDER", label: "Email provider", category: "Messaging & Marketing", type: "select", options: ["ses", "brevo", "sendgrid", "smtp"], default: "ses", env: "EMAIL_PROVIDER", help: "ses = Amazon SES, cheapest at scale (~$0.10/1k), reuses AWS creds. brevo = free tier ~9k/mo (needs BREVO_API_KEY). sendgrid (free tier discontinued). smtp = your own server. Auto-falls back to whichever provider's creds are set." },
  { key: "EMAIL_FREQUENCY_CAP_PER_WEEK", label: "Marketing email cap / user / week", category: "Messaging & Marketing", type: "number", default: "3" },
  { key: "SOCIAL_POST_CADENCE_HOURS", label: "Social auto-post cadence", category: "Messaging & Marketing", type: "number", default: "6", unit: "hours" },

  // 12. Content, UI & ops
  { key: "SITE_NAME", label: "Site name", category: "Content & UI", type: "string", default: "GamerGain" },
  { key: "PRIMARY_COLOR", label: "Primary brand color", category: "Content & UI", type: "string", default: "#dc2626" },
  { key: "GLOBAL_BANNER", label: "Global announcement banner", category: "Content & UI", type: "string", default: "", help: "Shown site-wide when set." },
  { key: "MAINTENANCE_MODE", label: "Maintenance mode", category: "Content & UI", type: "boolean", default: "0", sensitive: true },

  // 17. Developer / creator marketplace
  { key: "DEVELOPER_REVENUE_SHARE", label: "Developer revenue share", category: "Marketplace", type: "number", default: "0.5", unit: "×", help: "Developer's cut of app revenue. 0.5 = the current 50/50 split.", sensitive: true, min: 0, max: 1 },
  { key: "CREATOR_PLATFORM_FEE", label: "Creator platform fee (tips)", category: "Marketplace", type: "number", default: "0", unit: "×", min: 0, max: 1, help: "Share of each streamer tip the platform keeps. 0 = creator gets 100% (autoCreatorEconomyEngine).", sensitive: true },

  // 18. Loyalty & Rewards program (retail-loyalty reframe). The member DISCOUNT is funded from the
  // platform's cut of the revenue the member generated — NOT from store margin — and is capped at a
  // back-end annual value the user never sees. Money/cap knobs are on the optimizer denylist.
  { key: "LOYALTY_PROGRAM_DISCOUNT_PCT", label: "Member points-back", category: "Loyalty & Rewards", type: "number", default: "0.10", unit: "×", min: 0, max: 1, help: "Points-back for eligible premium members on the base price, funded by the matched advertiser (store markup stays and is kept, so margin is untouched).", sensitive: true },
  { key: "LOYALTY_ANNUAL_VALUE_CAP_USD", label: "Annual points-back cap (back-end, hidden from user)", category: "Loyalty & Rewards", type: "number", default: "1460", unit: "$", min: 0, help: "Most points-back a premium member can receive per program YEAR (resets yearly). Back-end number, never shown to the user.", sensitive: true },
  { key: "LOYALTY_BENEFIT_BUDGET_FRACTION", label: "Benefit budget fraction of pooled revenue", category: "Loyalty & Rewards", type: "number", default: "1", unit: "×", min: 0, max: 1, help: "Safety multiplier on the capacity governor. 1 = reserve the full annual cap per member against pooled revenue (worst-case solvent). Lower = a bigger margin buffer / fewer premium slots.", sensitive: true },
  { key: "LOYALTY_TARGET_PREMIUM_FRACTION", label: "Target premium share of users", category: "Loyalty & Rewards", type: "number", default: "0.05", unit: "×", min: 0, max: 1, help: "Ceiling on premium members as a share of all users (0.05 = 5%). 0 disables the share ceiling (funding-governed only)." },
  { key: "LOYALTY_EXTRA_POOL_USD", label: "Other pooled revenue funding benefits ($/yr)", category: "Loyalty & Rewards", type: "number", default: "0", unit: "$", min: 0, help: "Annualized affiliate + ad + membership revenue that also funds the benefit budget, so capacity isn't advertiser-count-bound.", sensitive: true },
  { key: "LOYALTY_RECONSENT_GRACE_DAYS", label: "Annual re-consent grace (days)", category: "Loyalty & Rewards", type: "number", default: "30", unit: "days", min: 0, help: "Membership is indefinite; once a year the member re-confirms consent. Points-back pauses only if re-consent is overdue by more than this grace window." },
  { key: "LOYALTY_DAILY_SURVEY_REQUIREMENT_USD", label: "Daily PPC-survey requirement", category: "Loyalty & Rewards", type: "number", default: "8", unit: "$", min: 0, help: "Survey work a member must complete each day to be eligible that day." },
  { key: "LOYALTY_DAILY_POOL_ACCRUAL_USD", label: "Daily pool accrual (platform cut)", category: "Loyalty & Rewards", type: "number", default: "4", unit: "$", min: 0, help: "Platform's cut of the day's generated revenue that funds the member's discount pool.", sensitive: true },
  { key: "GROUP_GOAL_DISCOUNT_PCT", label: "Group-goal reward (% of item price)", category: "Loyalty & Rewards", type: "number", default: "0.10", unit: "×", help: "Platform-funded reward each member gets when the group reaches its goal, as a fraction of the target item's price. Granted as non-cashable points. 0.10 = 10%.", min: 0, max: 1 },
  { key: "GROUP_GOAL_REWARD_CAP_USD", label: "Group-goal reward cap (per member)", category: "Loyalty & Rewards", type: "number", default: "100", unit: "$", help: "Hard cap on the per-member platform-funded group-goal reward value.", min: 0 },
  { key: "GROUP_GOAL_MAX_MEMBERS", label: "Group-goal max members", category: "Loyalty & Rewards", type: "number", default: "10", unit: "members", min: 2 },
  { key: "LOYALTY_REQUIRED_DAYS_PER_WEEK", label: "Required active days per week", category: "Loyalty & Rewards", type: "number", default: "5", unit: "days", min: 1, max: 7 },
  { key: "LOYALTY_TERM_DAYS", label: "Program term", category: "Loyalty & Rewards", type: "number", default: "365", unit: "days", min: 1 },
  { key: "LOYALTY_CAPACITY_PER_BUSINESS", label: "Rewarded members per business (1:1)", category: "Loyalty & Rewards", type: "number", default: "1", unit: "×", min: 0, help: "At most this many rewarded members per signed-up advertiser business. 1 = strict 1:1." },
  { key: "LOYALTY_EARN_MULTIPLIER", label: "Active-member earn multiplier", category: "Loyalty & Rewards", type: "number", default: "1.25", unit: "×", min: 1 },
  { key: "LOYALTY_REBATE_PCT", label: "Points rebate on purchases", category: "Loyalty & Rewards", type: "number", default: "0.02", unit: "×", min: 0, max: 1 },
  { key: "LOYALTY_FIRST_ORDER_PERK_USD", label: "First-order perk", category: "Loyalty & Rewards", type: "number", default: "5", unit: "$", min: 0 },
  { key: "LOYALTY_WELCOME_BONUS_USD", label: "Welcome bonus (vested)", category: "Loyalty & Rewards", type: "number", default: "25", unit: "$", min: 0 },
  { key: "LOYALTY_FREE_SHIPPING", label: "Member free shipping", category: "Loyalty & Rewards", type: "boolean", default: "1" },
  // Upfront affiliate grant (premium opt-in): take rewards up front, released as 2× real commission vests.
  { key: "LOYALTY_UPFRONT_ENABLED", label: "Offer the upfront-affiliate option", category: "Loyalty & Rewards", type: "boolean", default: "1", help: "Premium members can opt to take their reward value up front, enrolled as an affiliate; it releases incrementally as they generate real affiliate commission. Vesting, not a loan — no clawback." },
  { key: "LOYALTY_UPFRONT_GRANT_USD", label: "Upfront grant amount", category: "Loyalty & Rewards", type: "number", default: "1460", unit: "$", min: 0, help: "How much reward value is escrowed up front (defaults to the annual cap).", sensitive: true },
  { key: "LOYALTY_UPFRONT_MULTIPLE", label: "Commission multiple to fully release", category: "Loyalty & Rewards", type: "number", default: "2", unit: "×", min: 1, help: "Real affiliate commission the member must generate to release the full grant (2× = double the value, keeping the platform margin-positive).", sensitive: true },
  { key: "LOYALTY_UPFRONT_MILESTONES", label: "Release milestones", category: "Loyalty & Rewards", type: "number", default: "4", unit: "steps", min: 1, help: "Number of incremental release steps toward the 2× target (4 = 25% released at each quarter)." },
];

const BY_KEY: Record<string, SettingDef> = Object.fromEntries(REGISTRY.map((d) => [d.key, d]));
export function getDef(key: string): SettingDef | undefined { return BY_KEY[key]; }
export function categories(): string[] { return [...new Set(REGISTRY.map((d) => d.category))]; }

// ---- DB override cache (GlobalSettings rows, keyed by `key`) ----
let _cache: { at: number; map: Record<string, string> } | null = null;
const TTL_MS = 30_000;

async function overrides(): Promise<Record<string, string>> {
  if (_cache && Date.now() - _cache.at < TTL_MS) return _cache.map;
  const map: Record<string, string> = {};
  try {
    const rows = (await db.list("GlobalSettings", "-created_date", 2000)) as Record<string, unknown>[];
    for (const r of rows) {
      const k = String(r.key ?? "");
      if (k && map[k] === undefined && r.value !== undefined && r.value !== null) map[k] = String(r.value);
    }
  } catch { /* table empty / missing → env+defaults only */ }
  _cache = { at: Date.now(), map };
  return map;
}

/** Clear the in-process override cache (call right after an admin update). */
export function invalidateSettingsCache() { _cache = null; }

/** Raw string value with DB → env → default precedence. */
export async function getRaw(key: string): Promise<string> {
  const def = BY_KEY[key];
  const db_ = await overrides();
  if (db_[key] !== undefined) return db_[key];
  const envName = def?.env ?? key;
  const env = (typeof Deno !== "undefined") ? Deno.env.get(envName) : undefined;
  if (env !== undefined && env !== "") return env;
  return def?.default ?? "";
}

const asBool = (v: string) => v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";

/** Number setting (DB → env → default), with a caller fallback if the key is unknown. */
export async function getNumber(key: string, fallback?: number): Promise<number> {
  const raw = await getRaw(key);
  const n = Number(raw);
  return Number.isFinite(n) ? n : (fallback ?? (Number(BY_KEY[key]?.default) || 0));
}
export async function getBool(key: string, fallback = false): Promise<boolean> {
  const raw = await getRaw(key);
  return raw === "" ? fallback : asBool(raw);
}
export async function getString(key: string, fallback = ""): Promise<string> {
  const raw = await getRaw(key);
  return raw === "" ? (fallback || BY_KEY[key]?.default || "") : raw;
}
/** Comma-separated list setting → trimmed array. */
export async function getList(key: string): Promise<string[]> {
  return (await getRaw(key)).split(",").map((s) => s.trim()).filter(Boolean);
}

/** Effective values for the admin panel: def + current value + where it came from. */
export async function effectiveSettings(): Promise<Array<SettingDef & { value: string; source: "db" | "env" | "default" }>> {
  const db_ = await overrides();
  return REGISTRY.map((def) => {
    let value = def.default, source: "db" | "env" | "default" = "default";
    const envName = def.env ?? def.key;
    const env = (typeof Deno !== "undefined") ? Deno.env.get(envName) : undefined;
    if (env !== undefined && env !== "") { value = env; source = "env"; }
    if (db_[def.key] !== undefined) { value = db_[def.key]; source = "db"; }
    return { ...def, value, source };
  });
}

function coerce(def: SettingDef, raw: unknown): string {
  const s = String(raw);
  if (def.type === "boolean") return asBool(s) ? "1" : "0";
  if (def.type === "number") {
    const n = Number(s);
    if (!Number.isFinite(n)) throw new Error(`"${def.key}" must be a number`);
    if (def.min !== undefined && n < def.min) throw new Error(`"${def.label}" cannot be below ${def.min}${def.unit ? " " + def.unit : ""}.`);
    if (def.max !== undefined && n > def.max) throw new Error(`"${def.label}" cannot be above ${def.max}${def.unit ? " " + def.unit : ""}.`);
    return String(n);
  }
  if (def.type === "select" && def.options && !def.options.includes(s)) throw new Error(`"${def.key}" must be one of: ${def.options.join(", ")}`);
  return s;
}

/** Write (upsert) a setting override to GlobalSettings, validated against the registry. Returns
 *  the previous and new value (for auditing by the caller). */
export async function setSetting(key: string, value: unknown, updatedBy?: string): Promise<{ key: string; from: string; to: string }> {
  const def = BY_KEY[key];
  if (!def) throw new Error(`Unknown setting: ${key}`);
  const to = coerce(def, value);
  const from = await getRaw(key);
  const rows = (await db.filter("GlobalSettings", { key }, "-created_date", 1)) as Record<string, unknown>[];
  const patch = { key, value: to, category: def.category, label: def.label, description: def.help ?? "", updated_by: updatedBy ?? null, updated_at: new Date().toISOString() };
  if ((rows || []).length) await db.update("GlobalSettings", rows[0].id as string, patch);
  else await db.create("GlobalSettings", patch, updatedBy);
  invalidateSettingsCache();
  return { key, from, to };
}

// ---- Synchronous snapshot readers (for sync SDK config helpers) ----------------------------------
// SDK modules read config inside sync helper functions. These read the LAST-LOADED override cache
// (populated by any async getter or primeSettings()), then env, then the built-in default — so a
// helper stays synchronous. Values are at most TTL_MS stale; a handler can call `await
// primeSettings()` at the top to refresh within the request. adminSettingsUpdate invalidates the
// cache, so the next prime reloads the change immediately.
export async function primeSettings(): Promise<void> { await overrides(); }
function snapRaw(key: string): string {
  const def = BY_KEY[key];
  const m = _cache?.map;
  if (m && m[key] !== undefined) return m[key];
  const env = (typeof Deno !== "undefined") ? Deno.env.get(def?.env ?? key) : undefined;
  if (env !== undefined && env !== "") return env;
  return def?.default ?? "";
}
export function snapNumber(key: string, fallback?: number): number {
  const n = Number(snapRaw(key));
  return Number.isFinite(n) ? n : (fallback ?? (Number(BY_KEY[key]?.default) || 0));
}
export function snapBool(key: string, fallback = false): boolean {
  const r = snapRaw(key); return r === "" ? fallback : (r === "1" || r.toLowerCase() === "true" || r.toLowerCase() === "yes");
}
export function snapString(key: string, fallback = ""): string {
  const r = snapRaw(key); return r === "" ? (fallback || BY_KEY[key]?.default || "") : r;
}
export function snapList(key: string): string[] {
  return snapRaw(key).split(",").map((s) => s.trim()).filter(Boolean);
}
