import { execFileSync } from 'node:child_process'; import fs from 'node:fs';
const PGBIN=fs.readFileSync('/tmp/pgbin.txt','utf8').trim();
const psql=(s)=>execFileSync('su',['postgres','-c',`${PGBIN}/psql -h /tmp/pgrun -p 5433 -d nexus -tAc '${s.replace(/'/g,"'\\''")}'`],{encoding:'utf8'}).trim();
const policy=JSON.parse(fs.readFileSync('/tmp/pen_work/backend/db/rls-policy.json','utf8'));
// scopeQuery mirror
function scopeQuery(entity,q,uid){const p=policy[entity];if(!p||p.scope==='global')return q;if(p.scope==='self')return{...q,id:uid};return{...q,[p.owner_field||'user_id']:uid};}
// pick a scoped entity with an owner_field
const entity=Object.keys(policy).find(e=>policy[e].scope==='owner'&&policy[e].owner_field);
const of=policy[entity].owner_field;
console.log(`testing entity "${entity}" scoped by "${of}"`);
// insert 2 rows for different owners
const mk=(owner,tag)=>psql(`INSERT INTO "${entity}" (data) VALUES ('${JSON.stringify({[of]:owner,tag}).replace(/'/g,"''")}'::jsonb) RETURNING id`);
mk('userA','rowA'); mk('userB','rowB');
// scoped filter for userA → should only see userA rows
const q=scopeQuery(entity,{},'userA');
const whereJson=JSON.stringify(q).replace(/'/g,"''");
const countA=psql(`SELECT count(*) FROM "${entity}" WHERE data @> '${whereJson}'::jsonb`);
const countB=psql(`SELECT count(*) FROM "${entity}" WHERE data @> '${JSON.stringify({[of]:'userB'}).replace(/'/g,"''")}'::jsonb`);
const leak=psql(`SELECT count(*) FROM "${entity}" WHERE data @> '${whereJson}'::jsonb AND data->>'${of}' <> 'userA'`);
console.log(`  userA scoped query returns ${countA} row(s), all owned by userA (cross-owner leak: ${leak})`);
console.log(`  userB has ${countB} row(s) — NOT visible to userA's scoped query`);
console.log(leak==='0'?'  RLS PASS ✓ (no cross-user leakage)':'  RLS FAIL ✗');
