// seed-demo — populate the database with demo content so testing (and App Store review) has
// real data to look at instantly: sample products, a sample survey, and a few notifications.
// Idempotent: it skips anything already present. The reviewer demo *account* is created/logged-in
// on demand by the /auth/demo-login endpoint (see auth-routes), so no password handling here.
//   deno run --allow-net --allow-env backend/tools/seed-demo.ts
import { db } from "../sdk/db.ts";

async function ensure(entity: string, key: string, val: unknown, doc: Record<string, unknown>) {
  const found = await db.filter(entity, { [key]: val }, undefined, 1).catch(() => []);
  if (found.length) { console.log(`  = ${entity} "${val}" already present`); return; }
  await db.create(entity, doc);
  console.log(`  + ${entity} "${val}" created`);
}

console.log("Seeding demo data…");

// --- Demo store products (for the product-search / order flow) ---
const products = [
  { name: "Demo Wireless Earbuds", price: 49.99, category: "electronics" },
  { name: "Demo Gaming Mouse", price: 29.99, category: "electronics" },
  { name: "Demo Cozy Hoodie", price: 39.99, category: "apparel" },
];
for (const p of products) {
  await ensure("Product", "name", p.name, {
    ...p, in_stock: true, source: "demo",
    product_image_url: "https://placehold.co/400x400?text=Demo",
    description: `${p.name} — demo item seeded for testing/review.`,
  });
}

// --- Demo survey (for the earn loop) ---
await ensure("PPCSurvey", "survey_title", "Demo Quick Survey", {
  survey_title: "Demo Quick Survey", payout: 3, estimated_time: 4, status: "active",
  provider: "demo", questions_count: 5,
});

// --- Demo notifications (so the UI isn't empty during review) ---
await ensure("Notification", "title", "Welcome to GamerGain (demo)", {
  title: "Welcome to GamerGain (demo)", type: "system",
  message: "This is seeded demo content for testing and app review.", is_read: false,
});

console.log("Demo seed complete ✓  (re-run any time — it skips what already exists)");
