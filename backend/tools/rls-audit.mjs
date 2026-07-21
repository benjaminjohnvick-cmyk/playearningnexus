#!/usr/bin/env node
/**
 * Row-Level-Security audit. Classifies each entity as user-scoped (reads must be
 * limited to the owner) vs global (shared/admin data), by inspecting entity property
 * names and how backend functions filter them. Emits db/rls-policy.json which the
 * entity routes enforce for the user-facing client.
 * Usage: node tools/rls-audit.mjs <repo_root> <out.json>
 */
import fs from 'node:fs'; import path from 'node:path';
const [,, ROOT, OUT] = process.argv;
const ENT = path.join(ROOT, 'base44/entities');
const FUN = path.join(ROOT, 'base44/functions');

function strip(s){let o="",inS=false,ch="";for(let i=0;i<s.length;i++){const c=s[i],n=s[i+1];if(inS){o+=c;if(c=="\\"){o+=s[++i]||"";continue}if(c==ch)inS=false;continue}if(c=='"'||c=="'"){inS=true;ch=c;o+=c;continue}if(c=="/"&&n=="/"){while(i<s.length&&s[i]!="\n")i++;o+="\n";continue}if(c=="/"&&n=="*"){i+=2;while(i<s.length&&!(s[i]=="*"&&s[i+1]=="/"))i++;i++;continue}o+=c}return o}

const OWNER_FIELDS = ['user_id','owner_id','owner_user_id','referrer_user_id','recipient_user_id','account_user_id','user_email','created_by'];
// Read all function source once for filter-pattern scanning.
let funcSrc = '';
for (const d of fs.readdirSync(FUN)) { const f = path.join(FUN, d, 'entry.ts'); if (fs.existsSync(f)) funcSrc += '\n' + fs.readFileSync(f,'utf8'); }

const entities = fs.readdirSync(ENT).filter(f=>f.endsWith('.jsonc')||f.endsWith('.json'));
const policy = {}; const summary = { user_scoped: [], global: [] };

for (const file of entities.sort()) {
  let def; try { def = JSON.parse(strip(fs.readFileSync(path.join(ENT,file),'utf8'))); } catch { continue; }
  const name = def.name || file.replace(/\.jsonc?$/,'');
  const props = Object.keys(def.properties || {});
  const ownerField = OWNER_FIELDS.find(f => props.includes(f));
  // Does code filter this entity by an owner field?
  const filteredByUser = new RegExp(`entities\\.${name}\\.filter\\(\\s*\\{[^}]*(user_id|created_by|user_email|referrer_user_id)`,'m').test(funcSrc);
  const isUser = name === 'User';
  const scoped = !!ownerField || filteredByUser;
  if (isUser) {
    policy[name] = { scope: 'self', owner_field: 'id' };
    summary.user_scoped.push(`${name} (self)`);
  } else if (scoped) {
    const of = ownerField || 'user_id';
    policy[name] = { scope: 'owner', owner_field: of };
    summary.user_scoped.push(`${name} (${of})`);
  } else {
    policy[name] = { scope: 'global' };
    summary.global.push(name);
  }
}

fs.writeFileSync(OUT, JSON.stringify(policy, null, 2));
console.log(`RLS policy → ${OUT}`);
console.log(`  user-scoped: ${summary.user_scoped.length}`);
console.log(`  global:      ${summary.global.length}`);
console.log('\n  Sample user-scoped:', summary.user_scoped.slice(0,18).join(', '));
