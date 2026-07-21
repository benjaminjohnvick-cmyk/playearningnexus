// End-to-end harness: run a REAL converted function's logic against the LIVE Postgres.
// Transpiles the function's TS to JS, injects a Node implementation of the SDK backed by
// psql, and invokes the handler with a real Request — proving function → SDK → DB → response.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ts from '/opt/node-tools/node_modules/typescript/lib/typescript.js';

const PGBIN = fs.readFileSync('/tmp/pgbin.txt', 'utf8').trim();
const DB = 'nexus';

// --- psql-backed query runner (returns parsed JSON) ---
function psql(sql) {
  const out = execFileSync('su', ['postgres', '-c',
    `${PGBIN}/psql -h /tmp/pgrun -p 5433 -d ${DB} -tAc ${shq(sql)}`], { encoding: 'utf8' });
  return out.trim();
}
function shq(s) { return "'" + s.replace(/'/g, "'\\''") + "'"; }
function lit(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}
const SYS = { _default: new Set(['id','created_date','updated_date','created_by']),
              User: new Set(['id','created_date','updated_date','created_by','email','password_hash','role']) };
const sysCols = (e) => SYS[e] || SYS._default;
const OPS = { $gte: '>=', $lte: '<=', $gt: '>', $lt: '<', $ne: '<>' };

function whereClause(entity, query) {
  const sys = sysCols(entity); const clauses = []; const containment = {};
  for (const [k, v] of Object.entries(query || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [op, ov] of Object.entries(v)) {
        if (OPS[op]) clauses.push(sys.has(k) ? `"${k}" ${OPS[op]} ${lit(ov)}` : `(data->>'${k}') ${OPS[op]} ${lit(String(ov))}`);
      }
    } else if (sys.has(k)) clauses.push(`"${k}" = ${lit(v)}`);
    else containment[k] = v;
  }
  if (Object.keys(containment).length) clauses.push(`data @> ${lit(containment)}`);
  return clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
}
function flatten(row) { const { data, ...cols } = row; return { ...(data || {}), ...cols }; }

const db = {
  filter(entity, query = {}, sort, limit) {
    const inner = `SELECT * FROM "${entity}" ${whereClause(entity, query)} ORDER BY created_date DESC ${limit ? 'LIMIT ' + limit : ''}`;
    const j = psql(`SELECT COALESCE(json_agg(to_jsonb(sub)),'[]') FROM (${inner}) sub`);
    return JSON.parse(j || '[]').map(flatten);
  },
  get(entity, id) { return this.filter(entity, { id }, undefined, 1)[0] || null; },
  update(entity, id, patch) {
    const sys = sysCols(entity); const sets = []; const data = {};
    for (const [k, v] of Object.entries(patch)) { if (sys.has(k)) sets.push(`"${k}" = ${lit(v)}`); else data[k] = v; }
    if (Object.keys(data).length) sets.push(`data = data || ${lit(data)}`);
    sets.push('updated_date = now()');
    const j = psql(`WITH upd AS (UPDATE "${entity}" SET ${sets.join(',')} WHERE id = ${lit(id)} RETURNING *) SELECT to_jsonb(upd) FROM upd`);
    return j ? flatten(JSON.parse(j)) : null;
  },
  create(entity, doc) {
    const sys = sysCols(entity); const cols = {}; const data = {};
    for (const [k, v] of Object.entries(doc)) { if (sys.has(k)) cols[k] = v; else data[k] = v; }
    const names = Object.keys(cols); const colSql = names.map((c) => `"${c}"`).concat('data');
    const valSql = names.map((c) => lit(cols[c])).concat(lit(data));
    const j = psql(`WITH ins AS (INSERT INTO "${entity}" (${colSql.join(',')}) VALUES (${valSql.join(',')}) RETURNING *) SELECT to_jsonb(ins) FROM ins`);
    return flatten(JSON.parse(j));
  },
};

// --- Minimal SDK client (service role + auth stub + integrations stub) ---
function makeEntities() {
  return new Proxy({}, { get(_t, entity) {
    return {
      filter: (q, s, l) => db.filter(entity, q, s, l),
      get: (id) => db.get(entity, id),
      create: (d) => db.create(entity, d),
      update: (id, p) => db.update(entity, id, p),
    };
  }});
}
function createClientFromRequest(_req) {
  const entities = makeEntities();
  const integrations = { Core: {
    // Stub LLM so we don't need a paid key; proves the call path is reached.
    InvokeLLM: async () => '[stubbed LLM output]',
    SendEmail: async () => ({ success: true }),
  } };
  return {
    auth: { me: async () => ({ id: 'harness-admin', role: 'admin', email: 'admin@nexus.local' }) },
    entities, integrations,
    asServiceRole: { entities, integrations, functions: { invoke: async () => ({}) } },
  };
}

// --- Load + transpile a converted function, return its default handler ---
function loadHandler(fnDir) {
  let src = fs.readFileSync(path.join(fnDir, 'entry.ts'), 'utf8');
  src = src.replace(/^\s*import\s.*$/gm, ''); // strip the two SDK imports
  const js = ts.transpileModule(src, { compilerOptions: { module: 'commonjs', target: 'es2022' } }).outputText;
  const module = { exports: {} };
  const __handler = (fn) => fn;
  const Deno = { env: { get: (k) => process.env[k] } };
  const fn = new Function('exports', 'module', 'createClientFromRequest', '__handler', 'Deno', js);
  fn(module.exports, module, createClientFromRequest, __handler, Deno);
  return module.exports.default;
}

// --- Run the scenario ---
const FN = '/tmp/pen_work/backend/functions/abTestAssigner';
const handler = loadHandler(FN);

async function call(body) {
  const req = new Request('http://internal/functions/abTestAssigner', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const res = await handler(req);
  return { status: res.status, data: await res.json() };
}

const before = db.get('SurveyABTest', 'abtest-seed-1');
console.log('BEFORE impressions:', { a: before.variant_a_impressions, b: before.variant_b_impressions });

const assign = await call({ action: 'assign', test_id: 'abtest-seed-1', user_id: 'e2e-user' });
console.log('ASSIGN response:', assign.status, JSON.stringify(assign.data));

const after = db.get('SurveyABTest', 'abtest-seed-1');
console.log('AFTER impressions:', { a: after.variant_a_impressions, b: after.variant_b_impressions });

const convert = await call({ action: 'convert', test_id: 'abtest-seed-1', variant: assign.data.variant });
console.log('CONVERT response:', convert.status, JSON.stringify(convert.data));

// Assertions
const impressionsWentUp = ((after.variant_a_impressions||0) + (after.variant_b_impressions||0))
  === ((before.variant_a_impressions||0) + (before.variant_b_impressions||0) + 1);
const ok = assign.status === 200 && ['a','b'].includes(assign.data.variant) && impressionsWentUp && convert.status === 200;
console.log('\nRESULT:', ok ? 'PASS ✓ (real function ran end-to-end against live Postgres)' : 'FAIL ✗');
process.exit(ok ? 0 : 1);
