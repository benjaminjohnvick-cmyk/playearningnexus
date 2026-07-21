#!/usr/bin/env node
/**
 * Convert Base44 Deno functions to run on the self-hosted SDK.
 *  - swaps  import {...} from 'npm:@base44/sdk@x'  →  ../../sdk/mod.ts
 *  - swaps  Deno.serve(<handler>)  →  export default __handler(<handler>)
 * Usage: node tools/codemod-functions.mjs <src_functions_dir> <dest_functions_dir>
 */
import fs from 'node:fs';
import path from 'node:path';

const [,, SRC, DEST] = process.argv;
if (!SRC || !DEST) { console.error('usage: codemod-functions.mjs <src> <dest>'); process.exit(1); }
fs.mkdirSync(DEST, { recursive: true });

const dirs = fs.readdirSync(SRC).filter(d => fs.existsSync(path.join(SRC, d, 'entry.ts')));
let converted = 0; const flags = [];

const SDK_IMPORT = /import\s*\{([^}]*)\}\s*from\s*['"]npm:@base44\/sdk@[^'"]+['"]\s*;?/;

for (const d of dirs) {
  const srcFile = path.join(SRC, d, 'entry.ts');
  let code = fs.readFileSync(srcFile, 'utf8');

  const hasImport = SDK_IMPORT.test(code);
  const serveCount = (code.match(/Deno\.serve\s*\(/g) || []).length;

  if (hasImport) {
    code = code.replace(SDK_IMPORT,
      `import {$1} from "../../sdk/mod.ts";\nimport { __handler } from "../../sdk/runtime.ts";`);
  } else {
    // No SDK import (rare) — still add runtime for the handler swap.
    code = `import { __handler } from "../../sdk/runtime.ts";\n` + code;
  }

  if (serveCount === 1) {
    code = code.replace(/Deno\.serve\s*\(/, 'export default __handler(');
  } else {
    flags.push(`${d} (Deno.serve x${serveCount})`);
  }

  const outDir = path.join(DEST, d);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'entry.ts'), code);
  converted++;
}

// Emit a manifest of all function names for the router.
fs.writeFileSync(path.join(DEST, '_manifest.json'), JSON.stringify(dirs.sort(), null, 2));

console.log(`Converted ${converted} functions → ${DEST}`);
console.log(`Manifest: ${dirs.length} function names written to _manifest.json`);
if (flags.length) {
  console.log(`\n⚠ ${flags.length} need manual review (not exactly one Deno.serve):`);
  flags.slice(0, 30).forEach(f => console.log('  - ' + f));
}
