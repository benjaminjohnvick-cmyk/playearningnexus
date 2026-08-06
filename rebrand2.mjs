#!/usr/bin/env node
// Rename "Grandia Granaria" -> "Get Global Goods Gratis (Free)" + slogan swap, safely.
import fs from 'fs'; import path from 'path';
const ROOT = process.cwd();
const TARGETS = ['src', 'index.html', 'public'];
const ALLOW = new Set(['.jsx','.js','.ts','.tsx','.html','.json','.css','.md','.txt','.mjs','.cjs','.svg','.webmanifest']);
const NEW_TEXT='Get Global Goods Gratis (Free)', NEW_COMPACT='GetGlobalGoodsGratis';
function transform(s){
  let o=s;
  o=o.split("Where the World's Goods Gather").join("Where Global Goods Gather");
  o=o.replace(/GrandiaGranaria/g, NEW_COMPACT);           // #tags, filenames, tokens
  o=o.replace(/Grandia%20Granaria/g, 'Get%20Global%20Goods%20Gratis'); // url-encoded
  o=o.replace(/Grandia Granaria/g, NEW_TEXT);             // display text
  return o;
}
let changed=0, scanned=0;
function walk(p){
  const st=fs.statSync(p);
  if(st.isDirectory()){ if(/node_modules|\.git|dist|build/.test(p))return; for(const e of fs.readdirSync(p)) walk(path.join(p,e)); }
  else { if(!ALLOW.has(path.extname(p)))return; scanned++; const s=fs.readFileSync(p,'utf8'); if(!s.includes('Grandia')&&!s.includes("World's Goods"))return; const o=transform(s); if(o!==s){fs.writeFileSync(p,o);changed++;console.log('updated',path.relative(ROOT,p));} }
}
for(const t of TARGETS){ const f=path.join(ROOT,t); if(fs.existsSync(f)) walk(f); }
console.log(`\nscanned ${scanned}, changed ${changed}.`);
