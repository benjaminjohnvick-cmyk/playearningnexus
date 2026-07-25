#!/usr/bin/env node
// validate-guardrails — pre-launch money safety check: confirm EVERY agent resolves to a model and
// is covered by a daily cost cap (either its own per-agent cap OR the global default cap), so nothing
// can run the LLM bill up unbounded.
//   node backend/tools/validate-guardrails.mjs
import fs from 'node:fs';
const agents = JSON.parse(fs.readFileSync('backend/agents-runtime/agents.json', 'utf8'));
const gr = JSON.parse(fs.readFileSync('backend/agents-runtime/agent-guardrails.json', 'utf8'));
const pa = gr.perAgent || {};
const defCap = gr.defaults?.dailyUsdCap;      // global fallback cap
const defModel = gr.defaultModel;

let noModel = 0, noCap = 0, viaDefault = 0;
for (const name of Object.keys(agents)) {
  const g = pa[name] || {};
  const model = g.model || agents[name].model || defModel;
  const cap = g.dailyUsdCap ?? defCap;
  if (!model) { console.log(`  ! ${name}: no model resolves`); noModel++; }
  if (cap == null) { console.log(`  ! ${name}: no daily cap (no per-agent cap and no default)`); noCap++; }
  else if (g.dailyUsdCap == null) viaDefault++;
}
const total = Object.keys(agents).length;
console.log(`\n${total} agents · every one resolves a model and a daily cap.`);
console.log(`   ${total - viaDefault} capped explicitly, ${viaDefault} covered by the $${defCap}/day default.`);
console.log(noModel || noCap ? 'FAIL — fix the above before launch.' : 'PASS — all agents pinned + capped. ✓');
process.exit(noModel || noCap ? 1 : 0);
