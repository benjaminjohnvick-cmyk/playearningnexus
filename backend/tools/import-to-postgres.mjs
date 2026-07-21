#!/usr/bin/env node
/**
 * Phase 4 — import exported JSONL into Postgres, mapping each document to system
 * columns + JSONB `data` exactly like the SDK's docToColumns (so reads flatten back).
 *
 * Modes:
 *   node tools/import-to-postgres.mjs ./export           # direct insert (needs `pg` + DATABASE_URL)
 *   node tools/import-to-postgres.mjs ./export --emit-sql # print SQL to stdout (pipe to psql)
 *
 * Preserves id, created_date, created_by, and (for User) email/role/password_hash.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const DIR = process.argv[2] || './export';
const EMIT = process.argv.includes('--emit-sql');
const entities = JSON.parse(fs.readFileSync(new URL('../db/entities.json', import.meta.url)));

const SYS = { _default: ['id', 'created_date', 'updated_date', 'created_by'], User: ['id', 'created_date', 'updated_date', 'created_by', 'email', 'password_hash', 'role'] };
const sysCols = (e) => SYS[e] || SYS._default;
const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
const lit = (v) => v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;

function toRow(entity, doc) {
  const sys = new Set(sysCols(entity));
  const cols = {}; const data = {};
  for (const [k, v] of Object.entries(doc)) {
    // Base44 returns created_date/id at top level; route them to columns.
    if (sys.has(k)) cols[k] = v; else if (!['created_by_id'].includes(k)) data[k] = v;
  }
  return { cols, data };
}

function insertSql(entity, doc) {
  const { cols, data } = toRow(entity, doc);
  const names = Object.keys(cols).filter((c) => cols[c] !== undefined);
  const colList = names.map(q).concat('data');
  const valList = names.map((c) => c === 'created_date' || c === 'updated_date' ? lit(cols[c]) + '::timestamptz' : lit(cols[c]))
    .concat(`'${JSON.stringify(data).replace(/'/g, "''")}'::jsonb`);
  return `INSERT INTO ${q(entity)} (${colList.join(',')}) VALUES (${valList.join(',')}) ON CONFLICT (id) DO NOTHING;`;
}

async function processEntity(entity, sink) {
  const file = path.join(DIR, `${entity}.jsonl`);
  if (!fs.existsSync(file)) return 0;
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  let n = 0;
  for await (const line of rl) { if (!line.trim()) continue; const doc = JSON.parse(line); await sink(insertSql(entity, doc)); n++; }
  return n;
}

if (EMIT) {
  process.stdout.write('BEGIN;\n');
  let total = 0;
  for (const e of entities) { total += await processEntity(e, (sql) => process.stdout.write(sql + '\n')); }
  process.stdout.write('COMMIT;\n');
  process.stderr.write(`Emitted SQL for ${total} rows across ${entities.length} entities\n`);
} else {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  let total = 0;
  for (const e of entities) {
    const n = await processEntity(e, async (sql) => { await client.query(sql); });
    if (n) console.log(`${e}: ${n}`);
    total += n;
  }
  await client.end();
  console.log(`\nImported ${total} rows.`);
}
