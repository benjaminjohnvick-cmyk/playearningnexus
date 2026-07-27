// Catalog category guardrails for AI order fulfillment (Master Plan #7).
//
// Blocks regulated / age-restricted / licensed-resale goods & services from being auto-sourced and
// fulfilled. blockedOrderReason() returns a human-readable reason if an order should be refused,
// else null. The lists are CONFIG — edit as your lawyer / policy advises.

import { snapList } from "./settings.ts";

const BLOCKED_TERMS = [
  "alcohol", "beer", "wine", "liquor", "vodka", "whiskey", "tobacco", "cigarette", "cigar", "vape",
  "nicotine", "firearm", "gun", "ammo", "ammunition", "weapon", "explosive",
  "cannabis", "marijuana", "weed", "thc", "cbd", "kratom",
  "prescription", "pharmacy", "medication", "steroid", "adderall", "opioid",
  "gift card", "giftcard", "gift-card", "gift certificate", "lottery", "casino", "gambling",
  "sportsbook", "sports bet", "bullion", "gold bar", "cryptocurrency", "bitcoin", "money order",
  "escort", "pornography", "adult toy",
];

const BLOCKED_CATEGORIES = [
  "alcohol", "tobacco", "firearms", "weapons", "cannabis", "drugs", "pharmacy", "gambling",
  "gift_cards", "adult", "financial_instruments",
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
