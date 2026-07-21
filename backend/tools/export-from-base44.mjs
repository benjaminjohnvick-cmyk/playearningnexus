#!/usr/bin/env node
/**
 * Phase 4 — export every Base44 entity's rows to JSONL for import into Postgres.
 * Runs in YOUR environment (where `npm i @base44/sdk` works and you have a token).
 *
 * Usage:
 *   BASE44_APP_ID=... BASE44_TOKEN=... BASE44_BASE_URL=https://your-app.base44.app \
 *     node tools/export-from-base44.mjs ./export
 *
 * Writes ./export/<Entity>.jsonl (one JSON document per line) + ./export/_counts.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@base44/sdk';

const OUT = process.argv[2] || './export';
fs.mkdirSync(OUT, { recursive: true });
const entities = JSON.parse(fs.readFileSync(new URL('../db/entities.json', import.meta.url)));

const base44 = createClient({
  appId: process.env.BASE44_APP_ID,
  token: process.env.BASE44_TOKEN,
  appBaseUrl: process.env.BASE44_BASE_URL,
  requiresAuth: true,
});

const PAGE = Number(process.env.EXPORT_PAGE_SIZE || 500);
const counts = {};

for (const name of entities) {
  const client = base44.asServiceRole?.entities?.[name] || base44.entities[name];
  if (!client) { console.warn(`skip ${name}: no client`); continue; }
  const fh = fs.createWriteStream(path.join(OUT, `${name}.jsonl`));
  let total = 0, page = 0;
  try {
    // Base44 list supports pagination via (sort, limit, offset)-style calls; fall back to list().
    // If your SDK version differs, adjust here.
    while (true) {
      let rows;
      try { rows = await client.list('-created_date', PAGE, page * PAGE); }
      catch { rows = await client.list(); }
      if (!rows || rows.length === 0) break;
      for (const r of rows) { fh.write(JSON.stringify(r) + '\n'); total++; }
      if (rows.length < PAGE) break;
      page++;
      if (page > 100000) break; // safety
    }
  } catch (e) { console.error(`error exporting ${name}: ${e.message}`); }
  fh.end();
  counts[name] = total;
  console.log(`${name}: ${total}`);
}
fs.writeFileSync(path.join(OUT, '_counts.json'), JSON.stringify(counts, null, 2));
console.log(`\nDone. ${Object.keys(counts).length} entities → ${OUT}`);
