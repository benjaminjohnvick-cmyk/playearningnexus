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
  { key: "STORE_MARKUP", label: "Store markup (regular users)", category: "Economy & Payouts", type: "number", default: "0.10", unit: "×", help: "Fraction added to catalog price for regular users. 0.10 = 10%. Refund credit & business accounts are always exempt.", sensitive: true, min: 0, max: 1 },
  { key: "POINT_VALUE_CENTS", label: "Point value", category: "Economy & Payouts", type: "number", default: "1", unit: "cents", help: "Cents per point for catalog pricing (like Swagbucks).", min: 0 },
  { key: "POINTS_CASHABLE", label: "Points cashable", category: "Economy & Payouts", type: "boolean", default: "0", help: "OFF = closed-loop, catalog-only (preserves money-transmitter protection). Leave OFF unless your lawyer clears it.", sensitive: true },
  { key: "MIN_PAYOUT_USD", label: "Minimum payout / withdrawal", category: "Economy & Payouts", type: "number", default: "5", unit: "$", help: "Minimum balance a partner can withdraw.", min: 0 },
  { key: "DAILY_EARN_CAP_USD", label: "Daily earnings cap (per user)", category: "Economy & Payouts", type: "number", default: "0", unit: "$", help: "Max a user can earn per day. 0 = no cap." },
  { key: "WISHLIST_REFERRAL_CREDIT", label: "Wishlist referral credit", category: "Economy & Payouts", type: "number", default: "2", unit: "$", min: 0, help: "Fixed credit awarded per wishlist-share referral conversion." },

  // 2. Premium PPC network
  { key: "PPC_GRID_ANNUAL_PRICE", label: "PPC AdGrid annual price", category: "Premium PPC", type: "number", default: "5000", unit: "$" },
  { key: "PREMIUM_ANNUAL_POINTS_CEILING", label: "Annual points-earn ceiling (per matched user)", category: "Premium PPC", type: "number", default: "1460", unit: "$" },
  { key: "PREMIUM_DAILY_EARN_CAP", label: "Base per-active-day earn cap", category: "Premium PPC", type: "number", default: "4", unit: "$" },
  { key: "PREMIUM_WELCOME_BONUS", label: "Welcome bonus at enrollment", category: "Premium PPC", type: "number", default: "25", unit: "$" },
  { key: "PREMIUM_BOOST_CAP_WEEK1", label: "Front-loaded cap — week 1", category: "Premium PPC", type: "number", default: "20", unit: "$" },
  { key: "PREMIUM_BOOST_CAP_MONTH1", label: "Front-loaded cap — days 8–30", category: "Premium PPC", type: "number", default: "8", unit: "$" },
  { key: "PREMIUM_STREAK_BONUS_PER_WEEK", label: "Streak bonus per week", category: "Premium PPC", type: "number", default: "0.1", unit: "×", help: "0.1 = +10% per full week of consecutive active days." },
  { key: "PREMIUM_STREAK_BONUS_CAP", label: "Streak bonus cap", category: "Premium PPC", type: "number", default: "0.5", unit: "×", help: "0.5 = +50% max." },
  { key: "PREMIUM_LAPSE_AFTER_DAYS", label: "Lapse to free after N inactive days", category: "Premium PPC", type: "number", default: "14", unit: "days" },
  { key: "PREMIUM_SOCIAL_CREDIT_PER_DAY", label: "Advertiser social credit / active day", category: "Premium PPC", type: "number", default: "32", unit: "$" },
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
  { key: "AFFILIATE_ONGOING_RATE_BRONZE", label: "Ongoing rate — Bronze", category: "Referrals / Affiliate", type: "number", default: "0.05", unit: "×" },
  { key: "AFFILIATE_ONGOING_RATE_SILVER", label: "Ongoing rate — Silver", category: "Referrals / Affiliate", type: "number", default: "0.06", unit: "×" },
  { key: "AFFILIATE_ONGOING_RATE_GOLD", label: "Ongoing rate — Gold", category: "Referrals / Affiliate", type: "number", default: "0.08", unit: "×" },
  { key: "AFFILIATE_ONGOING_RATE_PLATINUM", label: "Ongoing rate — Platinum", category: "Referrals / Affiliate", type: "number", default: "0.10", unit: "×" },
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
  { key: "SURVEY_REWARD_CONVERSION", label: "Survey reward conversion (provider→user)", category: "Surveys", type: "number", default: "0.5", unit: "×", help: "Share of survey revenue passed to the user (respondentMicroPayout). 0.5 = 50%.", min: 0, max: 1 },
  { key: "SURVEY_CREATION_PRICE", label: "Survey creation price (business/creators)", category: "Surveys", type: "number", default: "0", unit: "$" },
  { key: "SURVEY_FRAUD_SPEEDER_SECONDS", label: "Fraud: min completion time", category: "Surveys", type: "number", default: "20", unit: "sec", help: "Completions faster than this are flagged." },

  // 8. Gamification
  { key: "XP_PER_LEVEL", label: "XP per level (slope)", category: "Gamification", type: "number", default: "100", min: 1, help: "Level N needs XP_PER_LEVEL × N. Higher = slower leveling (awardUserXP)." },
  { key: "STREAK_DAILY_REWARD", label: "Daily streak reward", category: "Gamification", type: "number", default: "0", unit: "$", min: 0, help: "Paid daily to users with an active streak (autoDailyStreakEngine). 0 = off. Earn-cap aware.", sensitive: true },
  { key: "LEADERBOARD_RESET_DAYS", label: "Leaderboard reset cadence", category: "Gamification", type: "number", default: "7", unit: "days", min: 0, help: "Weekly board resets every N days (all-time kept; winners archived). 0 = disabled (leaderboardReset)." },

  // 9. AI & agents
  { key: "LLM_PROVIDER", label: "LLM provider", category: "AI & Agents", type: "select", options: ["openai", "anthropic"], default: "openai" },
  { key: "LLM_MODEL_DEFAULT", label: "OpenAI default model", category: "AI & Agents", type: "string", default: "gpt-4o-mini" },
  { key: "LLM_MODEL_LARGE", label: "OpenAI large model", category: "AI & Agents", type: "string", default: "gpt-4o" },
  { key: "CLAUDE_MODEL_DEFAULT", label: "Claude default model", category: "AI & Agents", type: "string", default: "claude-3-5-sonnet-latest" },
  { key: "AGENT_MODEL", label: "Agent model", category: "AI & Agents", type: "string", default: "gpt-4o" },
  { key: "AGENT_MAX_STEPS", label: "Agent max steps", category: "AI & Agents", type: "number", default: "6" },
  { key: "LLM_CONCURRENCY", label: "LLM concurrency", category: "AI & Agents", type: "number", default: "4" },
  { key: "IMAGE_PROVIDER", label: "Image provider", category: "AI & Agents", type: "select", options: ["openai", "stability", "aws_bedrock", "aws_sagemaker"], default: "openai", help: "aws_bedrock = serverless GPU, no infra, pay-per-image (cheap). aws_sagemaker = your own SDXL/FLUX endpoint that scales to zero." },
  { key: "IMAGE_MODEL", label: "Image model", category: "AI & Agents", type: "string", default: "dall-e-3", help: "For aws_bedrock use a Bedrock model id, e.g. amazon.nova-canvas-v1:0, amazon.titan-image-generator-v1, or stability.stable-diffusion-xl-v1." },
  { key: "CATALOG_IMAGES_ENABLED", label: "Generate catalog product images", category: "AI & Agents", type: "boolean", default: "1", help: "Kill switch. OFF = catalog listings launch text-only (no image generation)." },
  { key: "CATALOG_IMAGES_MAX_PER_RUN", label: "Max catalog images per seed run", category: "AI & Agents", type: "number", default: "200", min: 0, help: "Budget guard — a single catalog seed run won't generate more images than this." },
  { key: "CATALOG_IMAGE_SIZE", label: "Catalog image size", category: "AI & Agents", type: "string", default: "1024x1024" },
  { key: "CATALOG_IMAGE_STYLE", label: "Catalog image style prompt", category: "AI & Agents", type: "string", default: "clean studio product photograph on a plain white background, centered, soft even lighting, e-commerce style, high detail, no text, no logos, no watermark" },
  { key: "CATALOG_COUNTRIES", label: "Marketplace catalog countries", category: "Marketplace", type: "string", default: "US", help: "Comma-separated ISO country codes to auto-populate the marketplace for. Add a code when you launch a new country and the scheduled seeder fills its catalog." },
  { key: "CATALOG_CATEGORY_SOURCE", label: "Catalog category source", category: "Marketplace", type: "select", options: ["taxonomy", "settings"], default: "taxonomy", help: "taxonomy = span the full hierarchical taxonomy's 900+ subcategories (recommended). settings = use the flat CATALOG_CATEGORIES list instead." },
  { key: "CATALOG_LISTINGS_PER_COUNTRY", label: "Catalog listings per country", category: "Marketplace", type: "number", default: "440", min: 0, max: 20000, help: "Target number of original platform listings to keep active per country. The seeder tops up toward this (spread across all catalog categories). Images are generated once per template, then reused per country." },
  { key: "CATALOG_CATEGORIES", label: "Catalog categories (Amazon-scale)", category: "Marketplace", type: "string", default: "Electronics,Headphones,Cell Phones & Accessories,Cameras & Photo,Camera Lenses,Wearable Technology,Smartwatches,Smart Home,Smart Home Lighting,Smart Security,Home Audio,Portable Audio,Speakers,Televisions,Home Theater,Projectors,GPS & Navigation,Car Electronics,Computers & Tablets,Laptops,Desktops,Tablets,Computer Accessories,Monitors,Keyboards & Mice,Networking,Routers,Data Storage,External Drives,Printers & Ink,Computer Components,Graphics Cards,PC Gaming,Video Game Consoles,Video Games,Gaming Accessories,VR Headsets,Drones,eBook Readers,Office Electronics,Batteries & Chargers,Power & Surge Protection,Home & Kitchen,Kitchen & Dining,Cookware,Bakeware,Kitchen Appliances,Small Kitchen Appliances,Coffee & Espresso,Blenders & Juicers,Air Fryers,Cutlery,Dinnerware,Drinkware,Food Storage,Kitchen Storage & Organization,Bedding,Comforters & Sets,Sheets & Pillowcases,Pillows,Bath,Towels,Shower Curtains,Furniture,Living Room Furniture,Bedroom Furniture,Mattresses,Office Furniture,Kitchen & Dining Furniture,Outdoor Furniture,Home Décor,Wall Art,Clocks,Candles & Holders,Lighting,Lamps,Ceiling Lighting,Rugs,Curtains & Drapes,Vacuum & Floor Care,Robot Vacuums,Heating & Cooling,Fans,Air Purifiers,Humidifiers,Home Appliances,Irons & Steamers,Sewing Machines,Cleaning Supplies,Laundry,Tools & Home Improvement,Power Tools,Hand Tools,Tool Storage,Hardware,Fasteners,Electrical,Light Bulbs,Plumbing,Painting Supplies,Building Materials,Kitchen & Bath Fixtures,Safety & Security,Smart Locks,Welding,Measuring & Layout,Generators & Portable Power,Patio Lawn & Garden,Gardening & Lawn Care,Planters,Outdoor Power Tools,Lawn Mowers,Grills & Outdoor Cooking,Patio Furniture,Outdoor Décor,Pools & Spas,Pest Control,Snow Removal,Plants Seeds & Bulbs,Beauty & Personal Care,Skin Care,Makeup,Hair Care,Hair Tools,Fragrance,Nail Care,Bath & Body,Men's Grooming,Shaving & Hair Removal,Oral Care,Personal Care Appliances,Health & Household,Vitamins & Supplements,Sports Nutrition,Health Care,Household Supplies,Sexual Wellness,Medical Supplies,Mobility & Daily Living Aids,Wellness & Relaxation,Massage & Relaxation,Vision Care,First Aid,Grocery & Gourmet Food,Snack Foods,Beverages,Coffee Tea & Cocoa,Breakfast Foods,Pantry Staples,Candy & Chocolate,Condiments & Sauces,Organic & Specialty Foods,Baby,Diapering,Baby Feeding,Strollers,Car Seats,Nursery,Baby Toys,Baby Clothing,Baby Safety,Toys & Games,Action Figures,Building Toys,Dolls & Accessories,Games & Puzzles,Board Games,Learning & Educational Toys,Arts & Crafts for Kids,Outdoor Play,Stuffed Animals & Plush,RC Vehicles,Collectible Toys,Party Supplies,Women's Clothing,Men's Clothing,Girls' Clothing,Boys' Clothing,Women's Shoes,Men's Shoes,Kids' Shoes,Women's Accessories,Men's Accessories,Handbags & Wallets,Watches,Fine Jewelry,Fashion Jewelry,Sunglasses & Eyewear,Luggage & Travel Gear,Backpacks,Activewear,Lingerie & Sleepwear,Coats & Jackets,Sports & Outdoors,Exercise & Fitness,Strength Training,Cardio Equipment,Yoga,Cycling,Camping & Hiking,Fishing,Hunting,Team Sports,Water Sports,Winter Sports,Golf,Outdoor Recreation,Athletic Clothing,Automotive,Car Care,Car Parts,Interior Accessories,Exterior Accessories,Tires & Wheels,Automotive Tools & Equipment,Motorcycle & Powersports,Oils & Fluids,RV Parts & Accessories,Pet Supplies,Dog Supplies,Cat Supplies,Fish & Aquatics,Bird Supplies,Small Animal Supplies,Reptile Supplies,Pet Food,Pet Health,Office Products,Office Supplies,Writing & Correction,Paper Products,School Supplies,Filing & Organization,Calendars & Planners,Books,eBooks,Audiobooks,Textbooks,Magazines,Movies & TV,Music CDs & Vinyl,Musical Instruments,Guitars,Keyboards & Pianos,Drums & Percussion,Recording Equipment,DJ Equipment,Band & Orchestra,Amplifiers & Effects,Industrial & Scientific,Lab & Scientific Products,Janitorial & Sanitation,Material Handling,Industrial Power Tools,Occupational Safety,Test & Measurement,3D Printing,Arts Crafts & Sewing,Painting & Drawing,Knitting & Crochet,Beading & Jewelry Making,Scrapbooking,Fabric,Craft Supplies,Handmade Jewelry,Handmade Home Décor,Handmade Artwork,Collectibles & Fine Art,Coins & Currency,Stamps,Sports Memorabilia,Trading Cards,Antiques,Major Appliances,Refrigerators,Washers & Dryers,Dishwashers,Ranges & Ovens,Microwaves,Freezers,Software,Business & Office Software,Security Software,Education Software", help: "Comma-separated departments + subcategories the catalog spans, sized to match a large retailer's breadth. The seeder distributes listings across all of them; each is an original AI product concept." },
  { key: "AI_DAILY_SPEND_CAP_USD", label: "AI daily spend cap", category: "AI & Agents", type: "number", default: "0", unit: "$", help: "0 = no cap. Global guardrail — LLM calls are refused once estimated spend today crosses this.", min: 0 },
  { key: "AI_COST_PER_1K_TOKENS", label: "AI cost estimate ($/1k tokens)", category: "AI & Agents", type: "number", default: "0.01", unit: "$", help: "Blended input+output rate used to estimate spend against the daily cap.", min: 0 },
  { key: "OPTIMIZER_REQUIRE_EXPERIMENT", label: "Test AI changes with customers first", category: "AI & Agents", type: "boolean", default: "1", help: "ON = every AI-proposed change is A/B mockup-tested with a customer survey before it can go live." },

  // 10. Compliance & legal (numeric/string; the on/off kill-switches live in complianceFlags)
  { key: "TERMS_VERSION", label: "Terms version (bump to force re-consent)", category: "Compliance & Legal", type: "string", default: "2026-07-01", sensitive: true },
  { key: "AD_DISCLOSURE_TAG", label: "FTC ad-disclosure tag", category: "Compliance & Legal", type: "string", default: "#ad" },
  { key: "BUSINESS_MAILING_ADDRESS", label: "CAN-SPAM mailing address", category: "Compliance & Legal", type: "string", default: "" },
  { key: "DMCA_AGENT_EMAIL", label: "DMCA designated-agent email", category: "Compliance & Legal", type: "string", default: "" },
  { key: "TAX_1099_THRESHOLD", label: "1099 reportable threshold", category: "Compliance & Legal", type: "number", default: "600", unit: "$", sensitive: true },
  { key: "TAX_BACKUP_WITHHOLDING_RATE", label: "Backup withholding rate", category: "Compliance & Legal", type: "number", default: "0.24", unit: "×", sensitive: true, min: 0, max: 1 },
  { key: "MIN_AGE", label: "Minimum age", category: "Compliance & Legal", type: "number", default: "18", unit: "years", sensitive: true, min: 18, max: 120, help: "Hard floor of 18 — a money-earning app is 18+ (COPPA / minor-contract). Cannot be set lower." },
  { key: "SWEEPSTAKES_REG_THRESHOLD", label: "Prize size that triggers registration review", category: "Compliance & Legal", type: "number", default: "5000", unit: "$", sensitive: true },

  // 11. Messaging & marketing
  { key: "EMAIL_FROM", label: "Email 'from' address", category: "Messaging & Marketing", type: "string", default: "no-reply@yourdomain.com" },
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
  return Number.isFinite(n) ? n : (fallback ?? Number(BY_KEY[key]?.default) || 0);
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
  return Number.isFinite(n) ? n : (fallback ?? Number(BY_KEY[key]?.default) || 0);
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
