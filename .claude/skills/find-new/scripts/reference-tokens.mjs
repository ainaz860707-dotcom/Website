#!/usr/bin/env node
const urls = process.argv.slice(2);
if (!urls.length) {
  process.stderr.write('использование: node reference-tokens.mjs <url> [<url> ...]\n');
  process.exit(1);
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function top(list, n) {
  const counts = new Map();
  for (const v of list) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function normalizeColor(raw) {
  const c = raw.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(c)) return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
  return c;
}

for (const url of urls) {
  process.stdout.write(`\n=== ${url}\n`);
  let html;
  try {
    html = await get(url);
  } catch (e) {
    process.stdout.write(`  недоступно: ${e.message}\n`);
    continue;
  }

  const inline = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  const sheets = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi)]
    .map((tag) => tag[0].match(/href=["']([^"']+)["']/i)?.[1])
    .filter(Boolean)
    .map((href) => new URL(href, url).href)
    .slice(0, 4);

  const external = [];
  for (const href of sheets) {
    try {
      external.push(await get(href));
    } catch {
      /* пропускаем недоступную таблицу стилей */
    }
  }
  const css = [...inline, ...external].join('\n');
  if (!css.trim()) {
    process.stdout.write('  стилей не видно: всё в скриптах или за CDN с защитой\n');
    continue;
  }

  const fonts = [...css.matchAll(/font-family\s*:\s*([^;}]+)/gi)]
    .map((m) => m[1].split(',')[0].replace(/["']/g, '').trim())
    .filter((f) => f && !f.startsWith('var(') && !/^(inherit|initial|unset)$/i.test(f));

  const googleFonts = [...html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"']+)/gi)]
    .flatMap((m) => [...m[1].matchAll(/family=([^&:]+)/g)].map((f) => decodeURIComponent(f[1]).replace(/\+/g, ' ')));

  const hex = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => normalizeColor(m[0]));
  const rgb = [...css.matchAll(/rgba?\([^)]+\)/gi)].map((m) => m[0].replace(/\s+/g, ''));
  const sizes = [...css.matchAll(/font-size\s*:\s*([\d.]+)(px|rem)/gi)]
    .map((m) => (m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1])))
    .filter((n) => n >= 9 && n <= 200);
  const radii = [...css.matchAll(/border-radius\s*:\s*([^;}]+)/gi)].map((m) => m[1].trim().split(/\s+/)[0]);
  const shadows = [...css.matchAll(/box-shadow\s*:\s*([^;}]+)/gi)].map((m) => m[1].trim());
  const transitions = [...css.matchAll(/transition[^:]*:\s*([^;}]+)/gi)].map((m) => m[1].trim());
  const easings = [...css.matchAll(/cubic-bezier\([^)]+\)/gi)].map((m) => m[0].replace(/\s+/g, ''));
  const anims = [...css.matchAll(/@keyframes\s+([\w-]+)/gi)].map((m) => m[1]);

  const scale = [...new Set(sizes)].sort((a, b) => a - b);

  process.stdout.write(`  шрифты в CSS: ${top(fonts, 5).map(([f, n]) => `${f} ×${n}`).join(' · ') || '—'}\n`);
  process.stdout.write(`  подключено с Google Fonts: ${[...new Set(googleFonts)].join(', ') || '—'}\n`);
  process.stdout.write(`  частые цвета: ${top([...hex, ...rgb], 8).map(([c, n]) => `${c} ×${n}`).join(' · ') || '—'}\n`);
  process.stdout.write(`  шкала кеглей, px: ${scale.length ? `${scale[0]} … ${scale[scale.length - 1]} (${scale.length} ступеней)` : '—'}\n`);
  process.stdout.write(`  радиусы: ${top(radii, 5).map(([r, n]) => `${r} ×${n}`).join(' · ') || '—'}\n`);
  process.stdout.write(`  теней: ${shadows.length}${shadows.length ? ` · пример: ${shadows[0].slice(0, 60)}` : ''}\n`);
  process.stdout.write(`  переходов: ${transitions.length} · кривых: ${top(easings, 3).map(([e]) => e).join(' ') || '—'}\n`);
  process.stdout.write(`  анимаций @keyframes: ${anims.length}${anims.length ? ` (${[...new Set(anims)].slice(0, 6).join(', ')})` : ''}\n`);
}
