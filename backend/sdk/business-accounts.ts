// business-accounts.ts — the BUSINESS side of the platform (advertisers, sellers, sponsors, brands).
// Businesses are who the revenue layer bills; customers are never billed a markup. A BusinessAccount is
// created on sign-up (A6), can hold a SaaS subscription (A7), sponsored placements (A3/B13), and audience
// panels (B23). Kept deliberately small — CRUD + status helpers; money is recorded via sdk/revenue.ts.

import { db } from "./db.ts";

export interface BusinessAccount extends Record<string, unknown> {
  id: string;
  owner_user_id: string;
  name: string;
  status: string;               // "active" | "pending" | "suspended"
  signup_paid: boolean;
  onboarding_paid: boolean;
  subscription_tier: string | null;   // null | "basic" | "pro" | "enterprise"
  subscription_active: boolean;
  created_at: string;
}

/** The caller's business account (latest), or null. */
export async function getBusinessAccount(ownerUserId: string): Promise<BusinessAccount | null> {
  const rows = await db.filter("BusinessAccount", { owner_user_id: ownerUserId }, "-created_date", 1).catch(() => []) as BusinessAccount[];
  return (rows || [])[0] ?? null;
}

/** Get the caller's business account or create a pending one. Does NOT charge — the function does that. */
export async function ensureBusinessAccount(ownerUserId: string, name: string): Promise<BusinessAccount> {
  const existing = await getBusinessAccount(ownerUserId);
  if (existing) return existing;
  const row = await db.create("BusinessAccount", {
    owner_user_id: ownerUserId,
    name: name || "Business",
    status: "pending",
    signup_paid: false,
    onboarding_paid: false,
    subscription_tier: null,
    subscription_active: false,
    created_at: new Date().toISOString(),
  }, ownerUserId) as BusinessAccount;
  return row;
}

/** Is this business currently entitled to paid features (active subscription OR paid signup)? */
export function businessEntitled(b: BusinessAccount | null | undefined): boolean {
  return !!b && b.status === "active" && (b.subscription_active || b.signup_paid);
}
