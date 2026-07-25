#!/usr/bin/env node
// agent-dedupe-report — find agents that overlap heavily, as candidates to consolidate and shrink
// the test/config surface. REPORT ONLY: it deletes nothing, so no feature can be lost. A developer
// reviews the candidates and merges by hand where it's genuinely safe.
//   node backend/tools/agent-dedupe-report.mjs
import fs from 'node:fs';
const agents = JSON.parse(fs.readFileSync('backend/agents-runtime/agents.json', 'utf8'));
const names = Object.keys(agents);

// 1) Identical instruction openings.
const byInstr = {};
for (const n of names) { const k = (agents[n].instructions || '').trim().slice(0, 140); (byInstr[k] = byInstr[k] || []).push(n); }
console.log('Agents sharing near-identical instructions (merge candidates):');
let dup = 0;
for (const ns of Object.values(byInstr)) if (ns.length > 1) { console.log('  • ' + ns.join(', ')); dup++; }
if (!dup) console.log('  (none)');

// 2) High tool-set overlap (≥90% same entities).
const toolset = (n) => new Set((agents[n].tools || []).map(t => t.entity));
console.log('\nAgent pairs with ≥90% the same tools (possible overlap):');
let ov = 0;
outer: for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
  const a = toolset(names[i]), b = toolset(names[j]); if (!a.size || !b.size) continue;
  const inter = [...a].filter(x => b.has(x)).length, uni = new Set([...a, ...b]).size;
  if (inter / uni >= 0.9) { console.log(`  • ${names[i]}  ≈  ${names[j]}`); if (++ov >= 25) { console.log('  …(more; truncated)'); break outer; } }
}
if (!ov) console.log('  (none)');
console.log('\nReport only — nothing changed. Consolidate manually where it is clearly safe.');
