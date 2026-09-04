// Catalog category guardrails for AI order fulfillment (Master Plan #7).
//
// Blocks regulated / age-restricted / licensed-resale goods & services from being auto-sourced and
// fulfilled. blockedOrderReason() returns a human-readable reason if an order should be refused,
// else null. The lists are CONFIG — edit as your lawyer / policy advises.

import { snapList } from "./settings.ts";

const BLOCKED_TERMS = [
  // Alcohol / tobacco / nicotine
  "alcohol", "beer", "wine", "liquor", "vodka", "whiskey", "whisky", "tequila", "rum", "spirits",
  "tobacco", "cigarette", "cigar", "vape", "e-cigarette", "e-cig", "juul", "hookah", "shisha",
  "nicotine", "snus", "chewing tobacco",
  // Weapons / ammo / explosives
  "firearm", "gun", "rifle", "pistol", "handgun", "ammo", "ammunition", "weapon", "explosive",
  "fireworks", "pyrotechnic", "silencer", "suppressor", "tactical knife", "switchblade", "brass knuckles",
  "stun gun", "taser", "pepper spray", "body armor", "ballistic",
  // Drugs / controlled / supplements
  "cannabis", "marijuana", "weed", "thc", "cbd", "delta-8", "delta 8", "delta-9", "kratom", "psilocybin",
  "magic mushroom", "nitrous oxide", "poppers", "research chemical",
  "prescription", "pharmacy", "medication", "steroid", "adderall", "opioid", "oxycodone", "xanax",
  "controlled substance", "vape juice", "nootropic",
  // Financial / gambling / stored value
  "gift card", "giftcard", "gift-card", "gift certificate", "lottery", "raffle", "casino", "gambling",
  "sportsbook", "sports bet", "bullion", "gold bar", "silver bar", "cryptocurrency", "bitcoin", "crypto",
  "money order", "prepaid card", "visa card", "mastercard gift",
  // Adult
  "escort", "pornography", "porn", "adult toy", "sex toy", "aphrodisiac",
  // Hazmat / regulated / prohibited
  "pesticide", "hazardous", "hazmat", "corrosive", "compressed gas", "propane", "butane",
  "lock pick", "lockpick", "skimmer", "spy camera", "gps tracker", "counterfeit", "replica watch",
  "ivory", "endangered", "live animal", "human remains", "laser pointer", "radar detector",
  "prescription glasses", "contact lens",
  // Export-controlled / dual-use
  "night vision", "military grade", "export controlled", "itar", "encryption device",
];

const BLOCKED_CATEGORIES = [
  "alcohol", "tobacco", "firearms", "weapons", "ammunition", "cannabis", "drugs", "pharmacy",
  "supplements", "gambling", "lottery", "gift_cards", "prepaid", "adult", "financial_instruments",
  "hazmat", "hazardous", "pesticides", "surveillance", "export_controlled", "live_animals",
];

export function isBlockedCategory(category?: string | null): boolean {
  if (!category) return false;
  const c = String(category).toLowerCase().trim();
  const extra = snapList("CATALOG_BLOCKED_CATEGORIES").map((s) => s.toLowerCase());
  return [...BLOCKED_CATEGORIES, ...extra].some((b) => c === b || c.includes(b));
}

export function isBlockedItemName(name?: string | null): boolean {
  if (!name) return false;
  const n = String(name).toLowerCase();
  const extra = snapList("CATALOG_BLOCKED_CATEGORIES").map((s) => s.toLowerCase());
  return [...BLOCKED_TERMS, ...extra].some((t) => n.includes(t));
}

/** Returns a reason string if the order is blocked, else null. */
export function blockedOrderReason(item: { name?: string | null; category?: string | null }): string | null {
  if (isBlockedCategory(item.category)) return `category "${item.category}" is restricted`;
  if (isBlockedItemName(item.name)) return `"${item.name}" appears to be a regulated or age-restricted product`;
  return null;
}
