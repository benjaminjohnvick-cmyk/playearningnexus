// Auto-migrate: ensure the database schema exists on backend startup.
// The schema (db/schema.sql) is written with CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS,
// so running it on every boot is idempotent and safe. This removes the manual "load the schema" step.
//
// Controlled by AUTO_MIGRATE (default on). Set AUTO_MIGRATE=0 to skip (e.g., if you load it another way).
import { withClient } from "../sdk/db.ts";

export async function autoMigrate(): Promise<void> {
  if ((Deno.env.get("AUTO_MIGRATE") ?? "1") === "0") {
    console.log("[migrate] AUTO_MIGRATE=0 — skipping schema load");
    return;
  }
  if (!Deno.env.get("DATABASE_URL")) {
    console.warn("[migrate] no DATABASE_URL set — skipping (load db/schema.sql manually)");
    return;
  }
  try {
    const sql = await Deno.readTextFile(new URL("../db/schema.sql", import.meta.url));
    await withClient(async (c) => { await c.queryObject(sql); });
    console.log("[migrate] schema ensured (idempotent) ✓");
  } catch (e) {
    // Never crash the server over migration — log and continue so a transient DB hiccup
    // doesn't take the whole service down; the schema is idempotent and retried next boot.
    console.warn("[migrate] schema load skipped/failed:", (e as Error).message);
  }
}
