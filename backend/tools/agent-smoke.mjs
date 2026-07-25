#!/usr/bin/env node
// agent-smoke — config integrity check for all agents, so a broken agent definition is caught in one
// command instead of at runtime. FAILS on hard problems (no instructions / no tools array). WARNS on
// tools that are missing an `entity` (valid shape, but the tool targets nothing — worth a review).
// Does NOT call the LLM (no cost).
//   node backend/tools/agent-smoke.mjs
import fs from 'node:fs';
const agents = JSON.parse(fs.readFileSync('backend/agents-runtime/agents.json', 'utf8'));
let ok = 0, hard = 0, entityless = 0, agentsWithWarn = 0;
for (const [name, def] of Object.entries(agents)) {
  const errs = [];
  if (!def.instructions || def.instructions.trim().length < 10) errs.push('missing/short instructions');
  if (!Array.isArray(def.tools)) errs.push('no tools array');
  let warnHere = 0;
  if (Array.isArray(def.tools)) for (const t of def.tools) { if (t && !t.entity && Array.isArray(t.ops)) warnHere++; }
  if (errs.length) { console.log(`  ✗ ${name}: ${errs.join(', ')}`); hard++; }
  else ok++;
  if (warnHere) { entityless += warnHere; agentsWithWarn++; }
}
const total = Object.keys(agents).length;
console.log(`\nAgent config smoke: ${ok}/${total} boot-clean, ${hard} hard issue(s).`);
if (entityless) console.log(`  ⓘ warning: ${entityless} tool entries across ${agentsWithWarn} agents have no "entity" (the runtime skips those; add entities to give the agent those tools). Non-blocking.`);
console.log(hard ? 'FAIL — fix the hard issues before launch.' : 'PASS — all agents boot-clean. ✓');
process.exit(hard ? 1 : 0);
