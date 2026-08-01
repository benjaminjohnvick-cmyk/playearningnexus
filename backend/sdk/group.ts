// group.ts — "earn together" groups of a user-chosen size, plus the opt-in path to 1:1 afterward.
//
// Community-first: people pick a group size and cheer each other on. Only AFTER a shared group session can
// two members opt in (mutually) to a 1:1 — a safer, consent-progressive path than dropping strangers
// straight into private chat. Group chat is answer-walled + scam-guarded, and retained for moderation.

import { snapNumber, snapBool } from "./settings.ts";

export const groupSessionsEnabled = () => snapBool("GROUP_SESSIONS_ENABLED", true);
export const scamGuardEnabled = () => snapBool("SCAM_GUARD_ENABLED", true);
export const chatRetentionDays = () => Math.max(1, Math.round(snapNumber("CHAT_TRANSCRIPT_RETENTION_DAYS", 90)));

export function clampGroupSize(requested: number): number {
  const min = Math.max(2, Math.round(snapNumber("GROUP_MIN_SIZE", 2)));
  const max = Math.max(min, Math.round(snapNumber("GROUP_MAX_SIZE", 12)));
  const def = Math.min(max, Math.max(min, Math.round(snapNumber("GROUP_DEFAULT_SIZE", 4))));
  const n = Math.round(Number(requested) || def);
  return Math.min(max, Math.max(min, n));
}

export function isMember(session: Record<string, unknown>, uid: string): boolean {
  const members = Array.isArray(session?.members) ? session.members as string[] : [];
  return members.map(String).includes(String(uid));
}
