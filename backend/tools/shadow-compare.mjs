#!/usr/bin/env node
/**
 * Phase 4 — shadow-compare: verify the migrated Postgres matches the Base44 export.
 * Compares per-entity row counts (export/_counts.json vs live Postgres) and flags drift.
 * Optionally samples N rows/entity and checks they exist by id in Postgres.
 *
 * Usage: DATABASE_URL=... node tools/shadow-compare.mjs ./export [--sample 5]
 * Needs `pg`.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const DIR = process.argv[2] || './export';
const sampleIdx = process.argv.indexOf('--sample');
const SAMPLE = sampleIdx > -1 ? Number(process.argv[sampleIdx + 1] || 5) : 0;
const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';

const counts = JSON.parse(fs.readFileSync(path.join(DIR, '_counts.json')));
const { default: pg } = await import('pg');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

let okCount = 0, mismatch = 0, sampleFail = 0;
const rows = [];
for (const [entity, expected] of Object.entries(counts)) {
  let actual = 0;
  try { actual = Number((await client.query(`SELECT count(*)::int AS c FROM ${q(entity)}`)).rows[0].c); }
  catch (e) { rows.push(`  ! ${entity}: table error (${e.message})`); mismatch++; continue; }
  const ok = actual === expected;
  ok ? okCount++ : mismatch++;
  if (!ok) rows.push(`  ✗ ${entity}: export=${expected} postgres=${actual} (Δ${actual - expected})`);

  if (SAMPLE && fs.existsSync(path.join(DIR, `${entity}.jsonl`))) {
    const rl = readline.createInterface({ input: fs.createReadStream(path.join(DIR, `${entity}.jsonl`)), crlfDelay: Infinity });
    let seen = 0;
    for await (const line of rl) {
      if (seen >= SAMPLE) { rl.close(); break; }
      const doc = JSON.parse(line); seen++;
      const r = await client.query(`SELECT 1 FROM ${q(entity)} WHERE id = $1`, [doc.id]);
      if (!r.rowCount) { rows.push(`  ✗ ${entity}: sample id ${doc.id} missing in postgres`); sampleFail++; }
    }
  }
}
await client.end();

console.log(`\nShadow compare — ${DIR}\n`);
console.log(rows.length ? rows.join('\n') : '  (all entities match)');
console.log(`\n${okCount} matched, ${mismatch} count mismatches, ${sampleFail} sample misses\n`);
process.exit(mismatch || sampleFail ? 1 : 0);
