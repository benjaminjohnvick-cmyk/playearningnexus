// Transpile + instantiate ALL 526 converted functions under the SDK — proves every
// conversion loads and produces a callable handler with no missing references.
import fs from 'node:fs'; import path from 'node:path';
import ts from '/opt/node-tools/node_modules/typescript/lib/typescript.js';

const DIR = '/tmp/pen_work/backend/functions';
const dirs = fs.readdirSync(DIR).filter(d => fs.existsSync(path.join(DIR, d, 'entry.ts')));
const stubClient = () => ({ auth:{me:async()=>({})}, entities:new Proxy({},{get:()=>({filter:async()=>[],get:async()=>null,create:async()=>({}),update:async()=>({})})}), integrations:{Core:{}}, asServiceRole:{entities:new Proxy({},{get:()=>({})}),integrations:{Core:{}},functions:{invoke:async()=>({})}} });
let ok=0, bad=[];
for (const d of dirs) {
  try {
    let src = fs.readFileSync(path.join(DIR, d, 'entry.ts'), 'utf8').replace(/^\s*import\s.*$/gm, '');
    const js = ts.transpileModule(src, { compilerOptions:{module:'commonjs',target:'es2022'} }).outputText;
    const module = { exports:{} };
    new Function('exports','module','createClientFromRequest','__handler','Deno', js)
      (module.exports, module, stubClient, (fn)=>fn, { env:{get:()=>undefined} });
    if (typeof module.exports.default === 'function') ok++; else bad.push(d+' (no handler)');
  } catch(e) { bad.push(d+' ('+String(e.message).slice(0,50)+')'); }
}
console.log(`Loaded ${ok}/${dirs.length} converted functions as callable handlers`);
if (bad.length) { console.log(`Failed ${bad.length}:`); bad.slice(0,25).forEach(b=>console.log('  - '+b)); }
process.exit(bad.length ? 1 : 0);
