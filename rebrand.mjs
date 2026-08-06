#!/usr/bin/env node
// Rebrand "GamerGain" -> "Grandia Granaria" across the app UI, safely.
// Protects code identifiers (GamerGainLogo, GamerGainApp), hashtags, download
// filenames, and URL-encoded share text. Case-sensitive: lowercase domains
// like gamergain.com are left untouched (change DNS separately).
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const TARGETS = ['src', 'index.html', 'public']; // scope to app UI only
const EXT = new Set(['.jsx', '.js', '.ts', '.tsx', '.html', '.json', '.css', '.md?no']); // md excluded by default
const ALLOW_EXT = new Set(['.jsx', '.js', '.ts', '.tsx', '.html', '.json', '.css']);

const NEW_TEXT = 'Grandia Granaria';
const NEW_COMPACT = 'GrandiaGranaria';

function transform(s) {
  let out = s;
  // 1) Specific string filename token (not a code identifier)
  out = out.replace(/GamerGain_AI_Image/g, 'GrandiaGranaria_AI_Image');
  // 2) Hashtags: #GamerGain -> #GrandiaGranaria (keep single token)
  out = out.replace(/#GamerGain(?![A-Za-z0-9_])/g, '#' + NEW_COMPACT);
  // 3) URL-encoded contexts: keep %20 spacing valid
  out = out.replace(/GamerGain(?![A-Za-z0-9_])(?=%20)/g, 'Grandia%20Granaria');
  out = out.replace(/(?<=%20)GamerGain(?![A-Za-z0-9_])/g, 'Grandia%20Granaria');
  // 4) Underscore-preceded filename token: _GamerGain.png -> _GrandiaGranaria.png
  out = out.replace(/_GamerGain(?![A-Za-z0-9_])/g, '_' + NEW_COMPACT);
  // 5) General display text: GamerGain -> Grandia Granaria, but NEVER when it is
  //    the head of a code identifier (followed by a word char) e.g. GamerGainLogo.
  out = out.replace(/GamerGain(?![A-Za-z0-9_])/g, NEW_TEXT);
  return out;
}

let changed = 0, scanned = 0;
function walk(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    if (/node_modules|\.git|dist|build/.test(p)) return;
    for (const e of fs.readdirSync(p)) walk(path.join(p, e));
  } else {
    if (!ALLOW_EXT.has(path.extname(p))) return;
    // never touch the logo component's own identifier by accident (script handles via lookahead)
    scanned++;
    const src = fs.readFileSync(p, 'utf8');
    if (!src.includes('GamerGain')) return;
    const out = transform(src);
    if (out !== src) { fs.writeFileSync(p, out); changed++; console.log('updated', path.relative(ROOT, p)); }
  }
}

for (const t of TARGETS) {
  const full = path.join(ROOT, t);
  if (fs.existsSync(full)) walk(full);
}
console.log(`\nscanned ${scanned} files, changed ${changed}.`);
