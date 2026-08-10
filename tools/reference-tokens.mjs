#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

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
  if (/^#[0-9a-f]{8}$/.test(c)) return c.slice(0, 7);
  return c;
}

export function toRgb(color) {
  const c = normalizeColor(color);
  const hex = c.match(/^#([0-9a-f]{6})$/);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgb = c.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const parts = rgb[1].split(/[,/]/).map((p) => Number(p.trim().replace('%', '')));
    if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
  }
  return null;
}

export function luminance(color) {
  const c = toRgb(color);
  if (!c) return null;
  return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
}

export function saturation(color) {
  const c = toRgb(color);
  if (!c) return null;
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  return max === 0 ? 0 : (max - min) / max;
}

export function toHex(color) {
  const c = toRgb(color);
  if (!c) return null;
  const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`.toUpperCase();
}

export async function extractTokens(url) {
  let html;
  try {
    html = await get(url);
  } catch (e) {
    return { url, ok: false, reason: e.message };
  }

  const inline = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  const sheets = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi)]
    .map((tag) => tag[0].match(/href=["']([^"']+)["']/i)?.[1])
    .filter(Boolean)
    .map((href) => {
      try {
        return new URL(href, url).href;
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .slice(0, 4);

  const external = [];
  for (const href of sheets) {
    try {
      external.push(await get(href));
    } catch {
      external.push('');
    }
  }
  const css = [...inline, ...external].join('\n');
  if (!css.trim()) return { url, ok: false, reason: 'стилей не видно: всё в скриптах или за CDN' };

  const fonts = [...css.matchAll(/font-family\s*:\s*([^;}]+)/gi)]
    .map((m) => m[1].split(',')[0].replace(/["']/g, '').trim())
    .filter((f) => f && !f.startsWith('var(') && !/^(inherit|initial|unset)/i.test(f))
    .filter((f) => !/^(-apple-system|system-ui|sans-serif|serif|monospace|ui-monospace|BlinkMacSystemFont)$/i.test(f));

  const googleFonts = [...html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"']+)/gi)].flatMap((m) =>
    [...m[1].matchAll(/family=([^&:]+)/g)].map((f) => decodeURIComponent(f[1]).replace(/\+/g, ' '))
  );

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

  return {
    url,
    ok: true,
    fonts: top(fonts, 6).map(([name, count]) => ({ name, count })),
    googleFonts: [...new Set(googleFonts)],
    colors: top([...hex, ...rgb], 12).map(([value, count]) => ({ value, count })),
    scale: scale.length ? { min: scale[0], max: scale[scale.length - 1], steps: scale.length } : null,
    radii: top(radii, 5).map(([value, count]) => ({ value, count })),
    shadows: shadows.length,
    transitions: transitions.length,
    easings: top(easings, 3).map(([value]) => value),
    animations: [...new Set(anims)],
  };
}

export function formatTokens(t) {
  if (!t.ok) return `\n=== ${t.url}\n  недоступно: ${t.reason}\n`;
  const lines = [
    `\n=== ${t.url}`,
    `  шрифты в CSS: ${t.fonts.map((f) => `${f.name} ×${f.count}`).join(' · ') || '—'}`,
    `  подключено с Google Fonts: ${t.googleFonts.join(', ') || '—'}`,
    `  частые цвета: ${t.colors.slice(0, 8).map((c) => `${c.value} ×${c.count}`).join(' · ') || '—'}`,
    `  шкала кеглей, px: ${t.scale ? `${t.scale.min} … ${t.scale.max} (${t.scale.steps} ступеней)` : '—'}`,
    `  радиусы: ${t.radii.map((r) => `${r.value} ×${r.count}`).join(' · ') || '—'}`,
    `  теней: ${t.shadows} · переходов: ${t.transitions} · кривых: ${t.easings.join(' ') || '—'}`,
    `  анимаций @keyframes: ${t.animations.length}${t.animations.length ? ` (${t.animations.slice(0, 6).join(', ')})` : ''}`,
  ];
  return `${lines.join('\n')}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const urls = process.argv.slice(2);
  if (!urls.length) {
    process.stderr.write('использование: node reference-tokens.mjs <url> [<url> ...]\n');
    process.exit(1);
  }
  for (const url of urls) process.stdout.write(formatTokens(await extractTokens(url)));
}
