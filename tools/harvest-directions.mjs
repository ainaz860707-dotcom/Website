#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { awwwardsSites } from './reference-sources.mjs';
import { extractTokens } from './reference-tokens.mjs';
import { pickFonts, pickPalette, pickRhythm } from './niche-reference.mjs';

const CATEGORIES = [
  'photography',
  'architecture',
  'e-commerce',
  'food-drink',
  'fashion',
  'agency',
  'sport',
  'portfolio',
];

const OUT_DIR = path.join('references', 'harvest');
const CONCURRENCY = 4;

async function mapLimit(items, limit, fn) {
  const out = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return out;
}

export function candidateOf(tokens, category) {
  const one = [tokens];
  const palette = pickPalette(tokens.colors ?? []);
  const fonts = pickFonts(one);
  const rhythm = pickRhythm(one);

  return {
    url: tokens.url,
    domain: new URL(tokens.url).hostname.replace(/^www\./, ''),
    category,
    display: fonts.display,
    text: fonts.text,
    googleFonts: tokens.googleFonts ?? [],
    paper: palette.paper,
    ink: palette.ink,
    accent: palette.accent,
    muted: palette.muted,
    scaleMin: rhythm.scaleMin,
    scaleMax: rhythm.scaleMax,
    radius: rhythm.radius,
    sharp: rhythm.sharp,
    shadows: tokens.shadows ?? 0,
    transitions: tokens.transitions ?? 0,
    easings: rhythm.easings,
    animations: (tokens.animations ?? []).slice(0, 6),
  };
}

export async function harvest({ categories = CATEGORIES, per = 6, log = () => {} } = {}) {
  const candidates = [];
  const misses = [];

  for (const category of categories) {
    let sites = [];
    try {
      sites = (await awwwardsSites({ category })).slice(0, per);
    } catch (e) {
      misses.push({ category, url: null, reason: e.message });
      log(`${category}: Awwwards не ответил — ${e.message}`);
      continue;
    }

    const tokens = await mapLimit(sites, CONCURRENCY, (s) => extractTokens(s.url));
    for (const t of tokens) {
      if (!t.ok) {
        misses.push({ category, url: t.url, reason: t.reason });
        continue;
      }
      candidates.push(candidateOf(t, category));
    }
    log(`${category}: сайтов ${sites.length}, разобрано ${tokens.filter((t) => t.ok).length}`);
  }

  return { candidates, misses };
}

export function formatCandidate(c) {
  const scale = c.scaleMin && c.scaleMax ? `${c.scaleMin}→${c.scaleMax}px` : '—';
  return [
    `\n=== ${c.domain}  [${c.category}]`,
    `  шрифты: ${c.display ?? '—'} + ${c.text ?? '—'}${c.googleFonts.length ? `  (Google: ${c.googleFonts.join(', ')})` : ''}`,
    `  палитра: фон ${c.paper} · текст ${c.ink} · акцент ${c.accent ?? 'нет'} · приглушённый ${c.muted}`,
    `  ритм: шкала ${scale} · радиус ${c.radius}${c.sharp ? ' (острые углы)' : ''} · теней ${c.shadows} · переходов ${c.transitions}`,
    c.animations.length ? `  анимации: ${c.animations.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flag = (name, fallback) => {
    const hit = args.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : fallback;
  };
  const categories = flag('categories', '')
    ? flag('categories', '').split(',').map((c) => c.trim()).filter(Boolean)
    : CATEGORIES;
  const per = Number(flag('per', '6'));

  const { candidates, misses } = await harvest({
    categories,
    per,
    log: (m) => process.stderr.write(`[сбор] ${m}\n`),
  });

  const date = new Date().toISOString().slice(0, 10);
  mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${date}-awwwards.json`);
  writeFileSync(file, `${JSON.stringify({ date, categories, per, candidates, misses }, null, 2)}\n`, 'utf8');

  for (const c of candidates) process.stdout.write(formatCandidate(c));
  process.stdout.write(`\n\nразобрано ${candidates.length}, не отдали стилей ${misses.length}\n${file}\n`);
}
