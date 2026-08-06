#!/usr/bin/env node
// Rename to "Get Goods Gratis (Free)" from either "Grandia Granaria" or
// "Get Global Goods Gratis (Free)". Slogan -> "Where Global Goods Gather".
import fs from 'fs'; import path from 'path';
const ROOT = process.cwd();
const TARGETS = ['src','index.html','public'];
const ALLOW = new Set(['.jsx','.js','.ts','.tsx','.html','.json','.css','.md','.txt','.mjs','.cjs','.svg','.webmanifest']);
function transform(s){
  let o=s;
  o=o.split("Where the World's Goods Gather").join("Where Global Goods Gather");
  // compact tokens (hashtags/filenames)
  o=o.replace(/GrandiaGranaria/g,'GetGoodsGratis').replace(/GetGlobalGoodsGratis/g,'GetGoodsGratis');
  // url-encoded
  o=o.replace(/Grandia%20Granaria/g,'Get%20Goods%20Gratis').replace(/Get%20Global%20Goods%20Gratis/g,'Get%20Goods%20Gratis');
  // display (most specific first)
  o=o.replace(/Get Global Goods Gratis \(Free\)/g,'Get Goods Gratis (Free)');
  o=o.replace(/Get Global Goods Gratis/g,'Get Goods Gratis');
  o=o.replace(/Get Global Goods/g,'Get Goods');            // short_name / apple title
  o=o.replace(/Grandia Granaria/g,'Get Goods Gratis (Free)');
  return o;
}
let changed=0,scanned=0;
function walk(p){const st=fs.statSync(p);
  if(st.isDirectory()){if(/node_modules|\.git|dist|build/.test(p))return;for(const e of fs.readdirSync(p))walk(path.join(p,e));}
  else{if(!ALLOW.has(path.extname(p)))return;scanned++;const s=fs.readFileSync(p,'utf8');
    if(!/Grandia|Get Global Goods|World's Goods/.test(s))return;const o=transform(s);
    if(o!==s){fs.writeFileSync(p,o);changed++;console.log('updated',path.relative(ROOT,p));}}}
for(const t of TARGETS){const f=path.join(ROOT,t);if(fs.existsSync(f))walk(f);}
console.log(`\nscanned ${scanned}, changed ${changed}.`);
