#!/usr/bin/env node
import { DIRECTIONS } from './design-directions.mjs';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

const families = (s) => [...new Set((s.match(/'([^']+)'/g) ?? []).map((f) => f.slice(1, -1)))];

async function hasCyrillic(family) {
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@400&display=swap`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
  const css = await res.text();
  return { ok: /\/\*\s*cyrillic/i.test(css), reason: null };
}

const wanted = [...new Set(DIRECTIONS.flatMap((d) => families(d.fonts)))];
const results = await Promise.all(
  wanted.map(async (f) => ({ font: f, ...(await hasCyrillic(f)) }))
);

const broken = results.filter((r) => !r.ok);
for (const r of results.sort((a, b) => Number(a.ok) - Number(b.ok))) {
  process.stdout.write(`${r.ok ? '✓' : '✗'} ${r.font}${r.reason ? ` (${r.reason})` : ''}\n`);
}

if (broken.length) {
  const names = new Set(broken.map((b) => b.font));
  const hit = DIRECTIONS.filter((d) => families(d.fonts).some((f) => names.has(f)));
  process.stdout.write(`\nбез кириллицы: ${broken.length} из ${wanted.length}\n`);
  for (const d of hit) {
    const bad = families(d.fonts).filter((f) => names.has(f));
    process.stdout.write(`  ${d.key}: ${bad.join(', ')}\n`);
  }
  process.exit(1);
}

process.stdout.write(`\nвсе ${wanted.length} шрифтов каталога держат кириллицу\n`);
