// Phase 2 function sweep: run a batch of REAL functions through the SDK against live Postgres.
// Records whether each executed (returned a Response) and its status. Business-logic errors from
// missing seed data are expected and still prove the function ran end-to-end.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path';
import ts from '/opt/node-tools/node_modules/typescript/lib/typescript.js';

const PGBIN = fs.readFileSync('/tmp/pgbin.txt', 'utf8').trim();
function psql(sql){ return execFileSync('su',['postgres','-c',`${PGBIN}/psql -h /tmp/pgrun -p 5433 -d nexus -tAc ${shq(sql)}`],{encoding:'utf8'}).trim(); }
function shq(s){ return "'"+s.replace(/'/g,"'\\''")+"'"; }
function lit(v){ if(v===null||v===undefined)return'NULL'; if(typeof v==='number'||typeof v==='boolean')return String(v); if(typeof v==='object')return `'${JSON.stringify(v).replace(/'/g,"''")}'::jsonb`; return `'${String(v).replace(/'/g,"''")}'`; }
const SYS={_default:new Set(['id','created_date','updated_date','created_by']),User:new Set(['id','created_date','updated_date','created_by','email','password_hash','role'])};
const sc=(e)=>SYS[e]||SYS._default; const OPS={$gte:'>=',$lte:'<=',$gt:'>',$lt:'<',$ne:'<>'};
function where(entity,q){ const sys=sc(entity),cl=[],cont={}; for(const[k,v]of Object.entries(q||{})){ if(v&&typeof v==='object'&&!Array.isArray(v)){for(const[op,ov]of Object.entries(v)){if(OPS[op])cl.push(sys.has(k)?`"${k}" ${OPS[op]} ${lit(ov)}`:`(data->>'${k}') ${OPS[op]} ${lit(String(ov))}`);}}else if(sys.has(k))cl.push(`"${k}" = ${lit(v)}`);else cont[k]=v;} if(Object.keys(cont).length)cl.push(`data @> ${lit(cont)}`); return cl.length?'WHERE '+cl.join(' AND '):''; }
const flat=(r)=>{const{data,...c}=r;return{...(data||{}),...c};};
const db={
  filter(e,q={},s,l){const inner=`SELECT * FROM "${e}" ${where(e,q)} ORDER BY created_date DESC ${l?'LIMIT '+l:''}`;return JSON.parse(psql(`SELECT COALESCE(json_agg(to_jsonb(x)),'[]') FROM (${inner}) x`)||'[]').map(flat);},
  get(e,id){return this.filter(e,{id},undefined,1)[0]||null;},
  update(e,id,p){const sys=sc(e),sets=[],data={};for(const[k,v]of Object.entries(p)){if(sys.has(k))sets.push(`"${k}" = ${lit(v)}`);else data[k]=v;}if(Object.keys(data).length)sets.push(`data = data || ${lit(data)}`);sets.push('updated_date = now()');const j=psql(`WITH u AS (UPDATE "${e}" SET ${sets.join(',')} WHERE id = ${lit(id)} RETURNING *) SELECT to_jsonb(u) FROM u`);return j?flat(JSON.parse(j)):null;},
  create(e,doc){const sys=sc(e),cols={},data={};for(const[k,v]of Object.entries(doc)){if(sys.has(k))cols[k]=v;else data[k]=v;}const n=Object.keys(cols),cS=n.map(c=>`"${c}"`).concat('data'),vS=n.map(c=>lit(cols[c])).concat(lit(data));const j=psql(`WITH i AS (INSERT INTO "${e}" (${cS.join(',')}) VALUES (${vS.join(',')}) RETURNING *) SELECT to_jsonb(i) FROM i`);return flat(JSON.parse(j));},
  list(e,s,l){return this.filter(e,{},s,l);},
  delete(e,id){psql(`DELETE FROM "${e}" WHERE id=${lit(id)}`);return{id,deleted:true};},
  bulkCreate(e,docs){return docs.map(d=>this.create(e,d));},
};
function mkEnt(){return new Proxy({},{get(_t,e){return{filter:(q,s,l)=>db.filter(e,q,s,l),get:(id)=>db.get(e,id),create:(d)=>db.create(e,d),update:(id,p)=>db.update(e,id,p),list:(s,l)=>db.list(e,s,l),delete:(id)=>db.delete(e,id),bulkCreate:(d)=>db.bulkCreate(e,d)};}});}
function client(){const entities=mkEnt();const integrations={Core:{InvokeLLM:async()=>'{"ok":true}',SendEmail:async()=>({success:true}),GenerateImage:async()=>({url:''})}};return{auth:{me:async()=>({id:'00000000-0000-0000-0000-000000000001',role:'admin',email:'admin@nexus.local'})},entities,integrations,asServiceRole:{entities,integrations,functions:{invoke:async()=>({success:true})}}};}
function load(dir){let src=fs.readFileSync(path.join(dir,'entry.ts'),'utf8').replace(/^\s*import\s.*$/gm,'');const js=ts.transpileModule(src,{compilerOptions:{module:'commonjs',target:'es2022'}}).outputText;const m={exports:{}};const Deno={env:{get:(k)=>process.env[k]},serve:()=>{}};new Function('exports','module','createClientFromRequest','__handler','Deno',js)(m.exports,m,client,(fn)=>fn,Deno);return m.exports.default;}

const BASE='/tmp/pen_work/backend/functions';
const cases=[
  ['abTestAssigner',{action:'assign',test_id:'abtest-seed-1',user_id:'u1'}],
  ['abTestAssigner',{action:'optimize'}],
  ['generateWeeklyReferralCampaign',{}],
  ['creditPendingReferralPostRewards',{}],
  ['concludeWeeklyReferralCampaign',{}],
  ['processWeeklyJackpot',{}],
  ['autonomousEcosystemEngine',{}],
  ['generateAIDailyGoal',{}],
  ['autoReferralContestDaily',{}],
  ['generateWeeklyFeatureVoteSurvey',{}],
  ['concludeWeeklyFeatureVote',{}],
  ['autoWeeklyReportsEngine',{}],
];
let ran=0, failed=0;
for(const [name,payload] of cases){
  try{
    const h=load(path.join(BASE,name));
    const req=new Request('http://internal/f',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const res=await h(req);
    const body=await res.text();
    ran++;
    console.log(`  ✓ ${name.padEnd(34)} → HTTP ${res.status}  ${body.slice(0,90)}`);
  }catch(e){ failed++; console.log(`  ✗ ${name.padEnd(34)} → THREW: ${String(e.message).slice(0,80)}`); }
}
console.log(`\nPhase 2 sweep: ${ran}/${cases.length} functions executed against live Postgres, ${failed} failed to run`);
process.exit(failed?1:0);
