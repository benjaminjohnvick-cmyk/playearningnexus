#!/usr/bin/env node
// inventory-drift-check.mjs — flags when PATENT-FEATURE-AND-FUNCTION-DISCLOSURE-BRIEF.md has fallen behind the
// codebase. The brief is the "complete inventory" counsel scans for patent candidates, so anything shipped but
// not named there is a gap. Run it after adding functions/engines/entities/pages (or in CI). Exits non-zero on
// drift so it can gate a build.
//
//   node deploy-kit/inventory-drift-check.mjs
//
// Drift = an item that exists in code but is NOT named anywhere in the brief. It also sanity-checks the section
// count headers against the real totals. Pure read-only; no writes.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRIEF = path.join(ROOT, 'PATENT-FEATURE-AND-FUNCTION-DISCLOSURE-BRIEF.md');
const read = (p) => fs.readFileSync(p, 'utf8');
const C = { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', b: '\x1b[1m', x: '\x1b[0m' };

function main() {
  if (!fs.existsSync(BRIEF)) { console.error('Brief not found:', BRIEF); process.exit(2); }
  const doc = read(BRIEF);

  // Real inventory from the codebase.
  const functions = JSON.parse(read(path.join(ROOT, 'backend/functions/_manifest.json')));
  const entitiesRaw = JSON.parse(read(path.join(ROOT, 'backend/db/entities.json')));
  const entities = Array.isArray(entitiesRaw) ? entitiesRaw.map((e) => e.name || e) : Object.keys(entitiesRaw);
  const engines = fs.readdirSync(path.join(ROOT, 'backend/sdk')).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).map((f) => f.replace('.ts', ''));
  const pages = fs.readdirSync(path.join(ROOT, 'src/pages')).filter((f) => f.endsWith('.jsx')).map((f) => f.replace('.jsx', ''));

  // An item "in the brief" = its exact name appears anywhere in the doc text.
  const missing = (names) => names.filter((n) => !doc.includes(n));
  const groups = [
    { label: 'Functions (backend/functions/_manifest.json)', all: functions, miss: missing(functions) },
    { label: 'Engines (backend/sdk/*.ts)',                    all: engines,   miss: missing(engines) },
    { label: 'Entities (backend/db/entities.json)',           all: entities,  miss: missing(entities) },
    { label: 'Pages (src/pages/*.jsx)',                       all: pages,     miss: missing(pages) },
  ];

  console.log(`${C.b}Inventory drift check — patent disclosure brief vs codebase${C.x}\n`);
  let drift = 0;
  for (const g of groups) {
    if (g.miss.length === 0) {
      console.log(`  ${C.g}✓${C.x} ${g.label}: all ${g.all.length} named in the brief`);
    } else {
      drift += g.miss.length;
      console.log(`  ${C.r}✗${C.x} ${g.label}: ${g.miss.length} of ${g.all.length} NOT in the brief`);
      console.log(`      ${g.miss.join(', ')}`);
    }
  }

  // Sanity-check the section count headers against reality (advisory).
  const headerCheck = [
    { re: /## 2\. Software engines \(SDK modules\) — ([\d,]+)/, real: engines.length, what: 'engines' },
    { re: /## 3\. Complete backend function inventory — ([\d,]+)/, real: functions.length, what: 'functions' },
    { re: /## 4\. User-facing surfaces \(pages\) — ([\d,]+)/, real: pages.length, what: 'pages' },
    { re: /## 5\. Data model — persisted entity types \(([\d,]+)\)/, real: entities.length, what: 'entities' },
  ];
  const headerWarns = [];
  for (const h of headerCheck) {
    const m = doc.match(h.re);
    const stated = m ? Number(m[1].replace(/,/g, '')) : null;
    if (stated !== h.real) headerWarns.push(`${h.what}: header says ${stated ?? '(none)'}, actual ${h.real}`);
  }
  if (headerWarns.length) {
    console.log(`\n  ${C.y}⚠${C.x} Count headers out of sync (advisory): ${headerWarns.join('; ')}`);
  }

  console.log('');
  if (drift === 0) {
    console.log(`${C.g}${C.b}✓ Brief inventory is complete — nothing in code is missing from the brief.${C.x}`);
    process.exit(0);
  } else {
    console.log(`${C.r}${C.b}✗ Brief is behind by ${drift} item(s). Add them to PATENT-FEATURE-AND-FUNCTION-DISCLOSURE-BRIEF.md (§6 delta) and fix the count headers.${C.x}`);
    process.exit(1);
  }
}

main();
