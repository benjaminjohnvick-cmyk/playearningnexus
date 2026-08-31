#!/usr/bin/env node
// ============================================================================
//  deploy-kit/audit.mjs — GamerGain automated code auditor
//
//  Runs a battery of checks with the repo as the source of truth. Two tiers:
//
//   • STRUCTURAL (deterministic, zero false positives) → FAILS the run:
//       - brace/bracket/paren + string balance for every backend .ts file
//       - JSON validity: _manifest.json, entities.json, schedules.json, railway.json
//       - every entity in entities.json has a CREATE TABLE in schema.sql
//       - every scheduled job resolves to a real function
//       - every manifest entry has an entry.ts (and vice-versa)
//
//   • GUARDRAIL LINTS (heuristic, ADVISORY — may have false positives) → WARN:
//       - money writes to balance/points/pending_payouts without atomic updateIf
//       - external cash rails (PayPal/Stripe payouts) with no cash_out kill-switch
//       - social-post creation with no FTC #ad disclosure (withAdDisclosure)
//       - direct LLM API calls that bypass the AI_DAILY_SPEND_CAP_USD meter
//       - jackpot/sweepstakes/prize awards missing the 18+ / jurisdiction gate
//
//  HONEST SCOPE: this FINDS issues. It does NOT auto-rewrite money/logic code —
//  those are surfaced for human/AI review on purpose (that's what keeps a
//  money app safe). Safe mechanical auto-fixes (formatting/lint) live in
//  deploy-kit/audit.sh, which runs deno fmt + eslint --fix, never logic edits.
//
//  Usage:  node deploy-kit/audit.mjs [--strict] [--json]
//    --strict   also exit non-zero on advisory warnings (use in CI once clean)
//    --json     machine-readable output
//  Exit code: 0 = structural checks passed (and, with --strict, no warnings).
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const STRICT = args.has('--strict');
const JSON_OUT = args.has('--json');

const errors = [];   // structural failures
const warns = [];    // advisory guardrail findings
const fail = (file, msg) => errors.push({ file, msg });
const warn = (file, line, msg) => warns.push({ file, line, msg });

const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
const exists = (p) => fs.existsSync(path.join(ROOT, p));
function listDir(p) { try { return fs.readdirSync(path.join(ROOT, p)); } catch { return []; } }
function walkTs(dir, out = []) {
  for (const name of listDir(dir)) {
    const rel = `${dir}/${name}`;
    let st; try { st = fs.statSync(path.join(ROOT, rel)); } catch { continue; }
    if (st.isDirectory()) walkTs(rel, out);
    else if (name.endsWith('.ts')) out.push(rel);
  }
  return out;
}
const lineOf = (content, idx) => content.slice(0, idx).split('\n').length;

// ---- STRUCTURAL 1: brace/string balance (string + comment aware) ----------
function balanceCheck(content) {
  let depth = 0, i = 0, inStr = null, prev = '';
  const n = content.length;
  // A "/" begins a regex literal (not division) when the previous significant char is in an
  // expression-start position. Skipping regex literals avoids false "unbalanced/unterminated" from
  // brackets/quotes INSIDE a regex (e.g. /["']/ or /[a-z]{2}/).
  const regexPrev = () => prev === '' || '(,;:=!&|?{[<>+-*%^~'.includes(prev);
  while (i < n) {
    const c = content[i];
    if (inStr) {
      if (c === '\\') { i += 2; continue; }
      if (c === inStr) inStr = null;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; prev = c; i++; continue; }
    if (c === '/' && content[i + 1] === '/') { const j = content.indexOf('\n', i); i = j < 0 ? n : j; continue; }
    if (c === '/' && content[i + 1] === '*') { const j = content.indexOf('*/', i); i = j < 0 ? n : j + 2; continue; }
    if (c === '/' && regexPrev()) {
      // scan a regex literal: honor \escapes and [char classes] (where / is literal), stop at closing /.
      i++; let inClass = false;
      while (i < n) {
        const d = content[i];
        if (d === '\\') { i += 2; continue; }
        if (d === '[') inClass = true;
        else if (d === ']') inClass = false;
        else if (d === '/' && !inClass) { i++; break; }
        else if (d === '\n') break; // not a regex after all — bail without consuming the newline
        i++;
      }
      prev = '/'; continue;
    }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return { depth, inStr };
}

const backendTs = walkTs('backend').filter((f) => !f.includes('/node_modules/'));
for (const f of backendTs) {
  const c = read(path.join(ROOT, f));
  if (c == null) continue;
  const { depth, inStr } = balanceCheck(c);
  if (depth !== 0) fail(f, `unbalanced brackets (depth ${depth})`);
  if (inStr) fail(f, `unterminated string`);
}

// ---- STRUCTURAL 2: JSON validity ------------------------------------------
const jsonFiles = ['backend/functions/_manifest.json', 'backend/db/entities.json', 'backend/scheduler/schedules.json', 'backend/railway.json'];
const parsed = {};
for (const jf of jsonFiles) {
  const c = read(path.join(ROOT, jf));
  if (c == null) { if (jf !== 'backend/railway.json') fail(jf, 'missing'); continue; }
  try { parsed[jf] = JSON.parse(c); } catch (e) { fail(jf, `invalid JSON: ${e.message}`); }
}

// ---- STRUCTURAL 3: entities.json ↔ schema.sql -----------------------------
const schema = read(path.join(ROOT, 'backend/db/schema.sql')) || '';
const ents = parsed['backend/db/entities.json'] || [];
for (const e of ents) {
  const re = new RegExp('CREATE TABLE IF NOT EXISTS\\s+"?' + e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"?', 'i');
  if (!re.test(schema)) fail('backend/db/entities.json', `entity "${e}" has no CREATE TABLE in schema.sql`);
}

// ---- STRUCTURAL 4: scheduler ↔ functions ----------------------------------
const sched = parsed['backend/scheduler/schedules.json'];
if (sched && Array.isArray(sched.jobs)) {
  for (const j of sched.jobs) {
    if (j.function && !exists(`backend/functions/${j.function}/entry.ts`)) fail('backend/scheduler/schedules.json', `job "${j.name || j.function}" → missing function ${j.function}`);
  }
}

// ---- STRUCTURAL 5: manifest ↔ function dirs -------------------------------
const manifest = parsed['backend/functions/_manifest.json'];
if (Array.isArray(manifest)) {
  const dup = manifest.filter((x, i) => manifest.indexOf(x) !== i);
  if (dup.length) fail('backend/functions/_manifest.json', `duplicate entries: ${[...new Set(dup)].join(', ')}`);
  for (const fn of manifest) if (!exists(`backend/functions/${fn}/entry.ts`)) fail('backend/functions/_manifest.json', `"${fn}" has no entry.ts`);
  const onDisk = listDir('backend/functions').filter((d) => exists(`backend/functions/${d}/entry.ts`));
  const set = new Set(manifest);
  for (const d of onDisk) if (!set.has(d)) fail('backend/functions/_manifest.json', `function "${d}" exists but is NOT registered in the manifest (won't load)`);
}

// ---- STRUCTURAL 6: every gated feature flag reaches the Setup Wizard -------
// The wizard's gated panel is derived from gatedBooleanFlags(): boolean settings that default OFF ("0") AND are
// marked `sensitive: true`. Convention: a gated FUNCTION is gated behind a boolean setting whose key ends
// "_ENABLED". So any such flag MUST be `sensitive: true` (→ it auto-appears in the wizard) unless it is on the
// explicit exclusion list below (with a reason). This makes "new gated function shows up in the wizard"
// automatic AND enforced — the build FAILS if someone adds a gated *_ENABLED flag without wiring it in.
//
// To intentionally keep a flag OUT of the wizard, add it here with a reason (e.g. a compliance must-stay-off
// guardrail, an emergency kill switch, or a deprecated flag) — a conscious decision, not a silent omission.
const WIZARD_EXCLUDE = {
  FREE_ADVERTISER_TIER_ENABLED: 'discontinued per owner decision — not an activatable feature',
};
{
  const s = read(path.join(ROOT, 'backend/sdk/settings.ts')) || '';
  const objRe = /\{\s*key:\s*"([^"]+)"([\s\S]*?)\}/g;
  let m;
  while ((m = objRe.exec(s))) {
    const key = m[1], body = m[2];
    if (!key.endsWith('_ENABLED')) continue;
    if (!/type:\s*"boolean"/.test(body)) continue;
    if (!/default:\s*"0"/.test(body)) continue;               // only default-OFF gates
    const sensitive = /sensitive:\s*true/.test(body);
    if (sensitive) continue;                                   // → surfaces in the wizard automatically
    if (WIZARD_EXCLUDE[key]) continue;                         // consciously excluded, with a reason
    fail('backend/sdk/settings.ts',
      `gated flag "${key}" (boolean, default off) is not in the Setup Wizard: mark it \`sensitive: true\` so ` +
      `gatedBooleanFlags() surfaces it, or add it to WIZARD_EXCLUDE in deploy-kit/audit.mjs with a reason.`);
  }
}

// ---- GUARDRAIL LINTS (advisory) -------------------------------------------
const fnFiles = walkTs('backend/functions');
for (const f of fnFiles) {
  const c = read(path.join(ROOT, f));
  if (c == null) continue;

  // (a) money atomicity: writes a balance field via .update( without any updateIf in the file.
  const balWrite = c.match(/\.update\([^)]*(current_balance|pending_payouts|refund_credit_balance|\bpoints\b|pending_earnings)/);
  if (balWrite && !/updateIf/.test(c) && !/auth\.updateMe/.test(balWrite[0])) {
    warn(f, lineOf(c, balWrite.index), `writes a balance field via plain .update() with no atomic updateIf — possible non-atomic money write (double-spend risk). Review.`);
  }

  // (b) external cash DISBURSEMENT rail (payouts/transfers — money OUT) with no cash_out kill-switch.
  //     Payment INTAKE (PaymentIntent/charges — money IN) is intentionally not flagged. Match only a
  //     REAL disbursement CALL — the PayPal payout path or a Stripe payout/transfer .create — not
  //     read-only listing (stripe.payouts.list), reconciliation, or the words "payouts" in prose/email
  //     (the old loose `paypal[^\n]*payouts` matched across escaped \n inside string literals).
  //     The cash_out guard is satisfied either by a direct isEnabled('cash_out') check OR by the
  //     centralized cashDisbursementHold() helper (payout-policy.ts), which enforces BOTH the cash_out
  //     kill-switch AND the CASH_OUT_LEGAL_SIGNOFF legal hold at every money rail — the preferred path.
  const cashRail = c.match(/(\/v1\/payments\/payouts|stripe\.(payouts|transfers)\.create)/);
  const cashGuarded = /isEnabled\(\s*['"]cash_out['"]/.test(c) || /cashDisbursementHold\s*\(/.test(c);
  if (cashRail && !cashGuarded) {
    warn(f, lineOf(c, cashRail.index), `external cash disbursement (payout/transfer) with no cash_out kill-switch (isEnabled('cash_out') or cashDisbursementHold()). Review.`);
  }

  // (c) social post creation without FTC #ad disclosure.
  if (/SocialMediaPost['"]\s*\)\s*\.create|entities\.SocialMediaPost\.create|graph\.facebook\.com|\/feed\b/.test(c) && /\b(ad|sponsored|promot|affiliate|campaign)\b/i.test(c) && !/withAdDisclosure/.test(c)) {
    warn(f, 1, `creates/posts promotional social content without withAdDisclosure() (FTC #ad). Review.`);
  }

  // (e) jackpot/sweepstakes/prize award missing the 18+/jurisdiction gate. Requires an actual
  //     award-field write (not just a mention) to cut false positives.
  const awardsPrize = /\.(update|create)\([^)]*(jackpot_entries|total_jackpot_entries|prize_amount|prize_points)/s.test(c)
    || /distributeTournamentPrizes|awardSocialMediaJackpotEntries/.test(f);
  if (awardsPrize && !/age_verified_18plus/.test(c) && !/featureAllowed\(\s*['"]jackpots['"]/.test(c)) {
    warn(f, 1, `awards jackpot/prize/sweepstakes value without an 18+ or jurisdiction (featureAllowed('jackpots')) gate. Review.`);
  }
}

// (d) direct LLM API call bypassing the spend cap — outside the metered wrapper + agent runtime.
for (const f of backendTs) {
  if (f.includes('sdk/integrations.ts') || f.includes('agents-runtime/')) continue; // integrations.ts IS the metered path
  const c = read(path.join(ROOT, f));
  if (c == null) continue;
  // A direct provider call is fine if it goes through the shared meter (checks AI_DAILY_SPEND_CAP_USD
  // before + records estimated spend after). Skip files that use those meter helpers.
  if (/assertAiSpendUnderCap|recordAiTokenSpend|recordAiUsdSpend|aiSpendCapReached/.test(c)) continue;
  const m = c.match(/(api\.openai\.com|api\.anthropic\.com)/);
  if (m) warn(f, lineOf(c, m.index), `direct LLM API call that bypasses the AI_DAILY_SPEND_CAP_USD meter in InvokeLLM. Route through integrations.ts. Review.`);
}

// ---- REPORT ----------------------------------------------------------------
if (JSON_OUT) {
  console.log(JSON.stringify({ ok: errors.length === 0 && (!STRICT || warns.length === 0), errors, warnings: warns }, null, 2));
} else {
  const C = { red: '\x1b[1;31m', grn: '\x1b[1;32m', yel: '\x1b[1;33m', dim: '\x1b[2m', off: '\x1b[0m' };
  console.log(`\n${C.dim}GamerGain code auditor — ${backendTs.length} backend files, ${fnFiles.length} functions${C.off}\n`);
  console.log('STRUCTURAL (must pass):');
  if (!errors.length) console.log(`  ${C.grn}✓ all structural checks passed${C.off}`);
  else for (const e of errors) console.log(`  ${C.red}✗ ${e.file}: ${e.msg}${C.off}`);
  console.log(`\nGUARDRAIL LINTS (advisory — review; may include false positives): ${warns.length}`);
  for (const w of warns) console.log(`  ${C.yel}! ${w.file}:${w.line} — ${w.msg}${C.off}`);
  console.log('');
  if (errors.length) console.log(`${C.red}✗ AUDIT FAILED — ${errors.length} structural error(s).${C.off}`);
  else if (STRICT && warns.length) console.log(`${C.yel}✗ AUDIT FAILED (--strict) — ${warns.length} advisory warning(s).${C.off}`);
  else console.log(`${C.grn}✓ AUDIT PASSED${warns.length ? ` (with ${warns.length} advisory warning(s) to review)` : ''}.${C.off}`);
}

process.exit(errors.length || (STRICT && warns.length) ? 1 : 0);
