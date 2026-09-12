// approvals.ts — delegated, mobile-friendly human-in-the-loop approvals.
//
// WHO can approve: an admin (everything), OR a user explicitly granted approver rights (stored on the User row,
// no new table): user.data.is_approver === true plus user.data.approver_domains — a list of autonomy domain ids
// (e.g. "payout"), domain GROUPS ("money","identity","risk","content","revenue","ops"), or "all". Money /
// identity / legal (permanent-gate) domains are only approvable by someone whose scope explicitly covers them
// (their id, their group, or "all") — so you can hand a teammate "approve content" without handing them payouts.
//
// This is the authorization + notification layer under the mobile Approvals page. It reuses the existing
// DeviceToken registry (registerPushToken) + Notification entity; push delivery is best-effort and only fires
// when a push key is configured (PUSH_FCM_SERVER_KEY) — the in-app notification always lands.
import { db } from "./db.ts";
import { domainById, DOMAINS } from "./autonomy-kernel.ts";
import { snapString, snapBool } from "./settings.ts";

export const approvalsEnabled = () => snapBool("MOBILE_APPROVALS_ENABLED", true);

type U = Record<string, any> | null | undefined;

export function isAdmin(user: U): boolean { return user?.role === "admin"; }

/** Domains (ids) the user is allowed to approve. Admin → all. Approver → per their scope. */
export function approvableDomainIds(user: U): string[] {
  if (isAdmin(user)) return DOMAINS.map((d) => d.id);
  if (!user || user.is_approver !== true) return [];
  const scope: string[] = Array.isArray(user.approver_domains) ? user.approver_domains.map(String) : [];
  if (scope.includes("all")) return DOMAINS.map((d) => d.id);
  const ids = new Set<string>();
  for (const d of DOMAINS) {
    if (scope.includes(d.id) || scope.includes(d.group)) ids.add(d.id);
  }
  return [...ids];
}

/** Can this user approve an item in this domain? */
export function canApproveDomain(user: U, domainId: string): boolean {
  if (isAdmin(user)) return true;
  return approvableDomainIds(user).includes(domainId);
}

export function isApprover(user: U): boolean {
  return isAdmin(user) || (user?.is_approver === true && approvableDomainIds(user).length > 0);
}

/** Best-effort native push to one user's registered devices. In-app Notification is created by the caller
 *  separately and always lands; this only fires when a push key is configured. Never throws. */
export async function sendPushToUser(userId: string, title: string, body: string, data: Record<string, string> = {}): Promise<void> {
  try {
    const key = snapString("PUSH_FCM_SERVER_KEY", "");
    if (!key) return; // push not configured — in-app notification is the delivery until a key is set
    const tokens = await db.filter("DeviceToken", { user_id: userId }, "-created_date", 25).catch(() => []);
    for (const t of tokens || []) {
      const token = String((t as any).token || "");
      if (!token) continue;
      await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: { "Authorization": `key=${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to: token, notification: { title, body }, data: { ...data, kind: "approval" }, priority: "high" }),
      }).catch(() => null);
    }
  } catch { /* best-effort */ }
}

/** The users allowed to approve a given domain (admins + scoped approvers). */
export async function approversForDomain(domainId: string): Promise<Record<string, any>[]> {
  const [admins, approvers] = await Promise.all([
    db.filter("User", { role: "admin" }, "-created_date", 200).catch(() => []),
    db.filter("User", { is_approver: true }, "-created_date", 500).catch(() => []),
  ]);
  const out = new Map<string, Record<string, any>>();
  for (const a of admins || []) out.set(String((a as any).id), a as Record<string, any>);
  for (const a of approvers || []) {
    if (canApproveDomain(a, domainId)) out.set(String((a as any).id), a as Record<string, any>);
  }
  return [...out.values()];
}

/** Notify everyone who can approve this domain that an AI-prepared output is waiting: an in-app Notification
 *  (always) + a native push (when configured). Called when an item enters awaiting_approval. Never throws. */
export async function notifyApprovers(domainId: string, opts: { decision_id?: string; subject_id?: string; reason?: string } = {}): Promise<number> {
  try {
    if (!approvalsEnabled()) return 0;
    const dom = domainById(domainId);
    const label = dom?.label ?? domainId;
    const title = "Approval needed";
    const body = `An AI-prepared output for "${label}" is waiting for your review.${opts.subject_id ? ` (#${opts.subject_id})` : ""}`;
    const people = await approversForDomain(domainId);
    let n = 0;
    for (const p of people) {
      const uid = String((p as any).id);
      await db.create("Notification", {
        user_id: uid, type: "approval_needed", title, message: body, is_read: false,
        link: "DataDrivenCoverage", domain: domainId, decision_id: opts.decision_id ?? null,
      }, "system@getgoodsgratis.local").catch(() => null);
      await sendPushToUser(uid, title, body, { domain: domainId, decision_id: String(opts.decision_id ?? "") });
      n++;
    }
    return n;
  } catch { return 0; }
}
