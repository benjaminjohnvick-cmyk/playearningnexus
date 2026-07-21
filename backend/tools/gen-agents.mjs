#!/usr/bin/env node
// Convert Base44 agent .jsonc files into a runtime registry (agents-runtime/agents.json).
import fs from 'node:fs'; import path from 'node:path';
const [,, DIR, OUT] = process.argv;
function strip(s){let o="",inS=false,ch="";for(let i=0;i<s.length;i++){const c=s[i],n=s[i+1];if(inS){o+=c;if(c=="\\"){o+=s[++i]||"";continue}if(c==ch)inS=false;continue}if(c=='"'||c=="'"){inS=true;ch=c;o+=c;continue}if(c=="/"&&n=="/"){while(i<s.length&&s[i]!="\n")i++;o+="\n";continue}if(c=="/"&&n=="*"){i+=2;while(i<s.length&&!(s[i]=="*"&&s[i+1]=="/"))i++;i++;continue}o+=c}return o}
const out = {};
let n = 0;
for (const f of fs.readdirSync(DIR).filter(x=>x.endsWith('.jsonc')||x.endsWith('.json'))) {
  let d; try { d = JSON.parse(strip(fs.readFileSync(path.join(DIR,f),'utf8'))); } catch { continue; }
  const name = d.name || f.replace(/\.jsonc?$/,'');
  out[name] = {
    description: d.description || '',
    instructions: d.instructions || '',
    model: d.model || null,
    tools: (d.tool_configs || []).map(t => ({ entity: t.entity_name, ops: t.allowed_operations || ['read'] })),
  };
  n++;
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`Wrote ${n} agents → ${OUT}`);
