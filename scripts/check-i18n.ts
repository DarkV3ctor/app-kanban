// Verifies that every UI string passed to t() / tk() has a Ukrainian translation,
// and reports translations that are no longer used.
// Run: npm run i18n:check   (Node 22.18+ runs TypeScript directly)

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { UK } from '../src/locales/uk.ts';

const SRC = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const CALL = /\b(?:t|tk)\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'locales' ? [] : walk(p);
    return /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

const used = new Map<string, string>();
for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(CALL)) {
    const key = m[2].replace(/\\(['"`\\])/g, '$1');
    if (!used.has(key)) used.set(key, relative(SRC, file));
  }
}

const missing = [...used].filter(([k]) => !(k in UK));
const unused = Object.keys(UK).filter((k) => !used.has(k));

for (const [k, file] of missing) console.log(`missing  ${file}: ${JSON.stringify(k)}`);
for (const k of unused) console.log(`unused   ${JSON.stringify(k)}`);
console.log(`${used.size} keys, ${missing.length} missing, ${unused.length} unused`);
process.exit(missing.length ? 1 : 0);
