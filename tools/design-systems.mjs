#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { toHex, toRgb } from './reference-tokens.mjs';

export const CATALOGS = [
  { name: 'Design Systems Surf', url: 'https://designsystems.surf/design-systems', scope: 'мировые, 100+ систем' },
  { name: 'Каталог отечественных дизайн-систем', url: 'https://www.designsystemsclub.ru/', scope: 'российские, 26 компаний' },
];

const CDN = 'https://cdn.jsdelivr.net/npm/';

export const SYSTEMS = [
  {
    key: 'primer',
    name: 'Primer — GitHub',
    origin: 'мировая',
    license: 'MIT',
    docs: 'https://primer.style/',
    css: [
      `${CDN}@primer/primitives/dist/css/functional/themes/light.css`,
      `${CDN}@primer/primitives/dist/css/base/size/size.css`,
      `${CDN}@primer/primitives/dist/css/base/typography/typography.css`,
      `${CDN}@primer/primitives/dist/css/functional/size/border.css`,
    ],
  },
  {
    key: 'carbon',
    name: 'Carbon — IBM',
    origin: 'мировая',
    license: 'Apache-2.0',
    docs: 'https://carbondesignsystem.com/',
    css: [`${CDN}@carbon/styles/css/styles.css`],
  },
  {
    key: 'polaris',
    name: 'Polaris — Shopify',
    origin: 'мировая',
    license: 'MIT',
    docs: 'https://polaris.shopify.com/',
    css: [`${CDN}@shopify/polaris/build/esm/styles.css`],
  },
  {
    key: 'spectrum',
    name: 'Spectrum — Adobe',
    origin: 'мировая',
    license: 'Apache-2.0',
    docs: 'https://spectrum.adobe.com/',
    css: [`${CDN}@spectrum-css/tokens/dist/index.css`],
  },
  {
    key: 'atlassian',
    name: 'Atlassian Design System',
    origin: 'мировая',
    license: 'Apache-2.0',
    docs: 'https://atlassian.design/',
    css: [`${CDN}@atlaskit/tokens/css/atlassian-light.css`],
  },
  {
    key: 'lightning',
    name: 'Lightning — Salesforce',
    origin: 'мировая',
    license: 'BSD-3-Clause',
    docs: 'https://www.lightningdesignsystem.com/',
    css: [`${CDN}@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.min.css`],
  },
  {
    key: 'govuk',
    name: 'GOV.UK Design System',
    origin: 'мировая',
    license: 'MIT',
    docs: 'https://design-system.service.gov.uk/',
    css: [`${CDN}govuk-frontend/dist/govuk/govuk-frontend.min.css`],
  },
  {
    key: 'gravity',
    name: 'Gravity UI — Яндекс',
    origin: 'российская',
    license: 'MIT',
    docs: 'https://gravity-ui.com/',
    css: [`${CDN}@gravity-ui/uikit/styles/styles.css`],
  },
  {
    key: 'vkui',
    name: 'VKUI — VK',
    origin: 'российская',
    license: 'MIT',
    docs: 'https://vkcom.github.io/VKUI/',
    css: [`${CDN}@vkontakte/vkui-tokens/themes/vkBase/cssVars/declarations/onlyVariables.css`],
  },
];

const CACHE_DIR = path.join('references', 'design-systems');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.text();
}

function declarations(css) {
  const map = new Map();
  for (const m of css.matchAll(/(--[a-zA-Z0-9_-]+)\s*:\s*([^;{}]+)[;}]/g)) {
    const name = m[1];
    const value = m[2].trim();
    if (!map.has(name)) map.set(name, value);
  }
  return map;
}

function resolve(value, map, depth = 0) {
  if (depth > 4 || !value.includes('var(')) return value;
  const next = value.replace(/var\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,\s*([^()]*))?\)/g, (all, ref, fallback) =>
    map.has(ref) ? map.get(ref) : (fallback ?? all).trim()
  );
  return next === value ? value : resolve(next, map, depth + 1);
}

function px(value) {
  const m = String(value).trim().match(/^(-?[\d.]+)(px|rem|em)$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return m[2] === 'px' ? n : n * 16;
}

function ladder(entries, { min, max }) {
  const values = new Set();
  for (const value of entries) {
    const n = px(value);
    if (n === null || n < min || n > max) continue;
    values.add(Math.round(n * 100) / 100);
  }
  return [...values].sort((a, b) => a - b);
}

function pick(map, re, avoid = null) {
  const out = [];
  for (const [name, value] of map) {
    const plain = canonical(name);
    if (!re.test(plain) || (avoid && avoid.test(plain))) continue;
    out.push(resolve(value, map));
  }
  return out;
}

function step(scale) {
  if (scale.length < 3) return null;
  const gaps = scale.slice(1).map((v, i) => Math.round((v - scale[i]) * 100) / 100).filter((g) => g > 0);
  if (!gaps.length) return null;
  const counts = new Map();
  for (const g of gaps) counts.set(g, (counts.get(g) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function channel(v) {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color) {
  const c = toRgb(color);
  if (!c) return null;
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

export function contrast(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

const NOISE =
  /(syntax|prettylights|chat|bubble|avatar|banner|toast|chart|data-?viz|visualization|code|editor|diff|sponsor|counter|skeleton|tooltip|badge|calendar|breadcrumb|table|modal|dialog|switch|slider|checkbox|radio|textarea|spinner|progress|scrollbar|blanket|underline|shadow|gradient|opacity|logo|illustration|marketing)/i;

const HUES = /(^|-)(red|orange|yellow|green|teal|cyan|blue|indigo|purple|violet|magenta|pink|brown|lime|olive|gold|silver)(-|$)/;
const STATES = /(inverse|hover|active|pressed|selected|disabled|focus|visited|down)/;
const MEANINGS = /(success|error|danger|warning|negative|positive|caution|info|critical|discovery)/;

const ROLES = [
  {
    role: 'текст',
    keywords: [/(^|-)text(-|$)/, /(^|-)fg(color)?(-|$)/, /(^|-)foreground(-|$)/, /(^|-)content(-|$)/],
    avoid: new RegExp(
      `${STATES.source}|${MEANINGS.source}|${HUES.source}|(placeholder|on-color|on-brand|onbrand|on-accent|muted|subtle|secondary|tertiary|hint|helper|link|accent|brand)`
    ),
  },
  {
    role: 'фон',
    keywords: [/(^|-)(bg|bgcolor|background)(-|$)/, /(^|-)surface(-|$)/, /(^|-)canvas(-|$)/, /(^|-)layer(-|$)/],
    avoid: new RegExp(`${STATES.source}|${MEANINGS.source}|${HUES.source}|(accent|brand|emphasis|inset|overlay|dark|neutral)`),
  },
  {
    role: 'граница',
    keywords: [/(^|-)border(color)?(-|$)/, /(^|-)stroke(-|$)/, /(^|-)divider(-|$)/, /(^|-)outline(-|$)/],
    avoid: new RegExp(`${STATES.source}|${MEANINGS.source}|${HUES.source}|(width|radius|style|accent|brand)`),
  },
  {
    role: 'акцент',
    keywords: [/(^|-)accent(-|$)/, /(^|-)brand(-|$)/, /(^|-)action(-|$)/, /(^|-)interactive(-|$)/, /(^|-)link(-|$)/],
    avoid: new RegExp(`${STATES.source}|${MEANINGS.source}|${HUES.source}|(subtle|muted|on-|text-|foreground|secondary|tertiary|100|50)`),
  },
];

const canonical = (name) => name.replace(/^--/, '').replace(/_/g, '-').replace(/-{2,}/g, '-').toLowerCase();

const DEFAULT_SUFFIX = /^(default|primary|base|normal|regular|main|1|01|100)$/;

function bestVar(map, { keywords, avoid }) {
  const candidates = [];
  for (const [name, raw] of map) {
    const plain = canonical(name);
    if (avoid.test(plain) || NOISE.test(plain)) continue;
    const keyword = keywords.findIndex((re) => re.test(plain));
    if (keyword < 0) continue;
    const hex = toHex(resolve(raw, map));
    if (!hex) continue;
    const parts = plain.split('-');
    candidates.push({
      name,
      hex,
      named: DEFAULT_SUFFIX.test(parts[parts.length - 1]) ? 0 : 1,
      segments: parts.length,
      keyword,
      length: plain.length,
    });
  }
  if (!candidates.length) return null;
  candidates.sort(
    (a, b) => a.named - b.named || a.segments - b.segments || a.keyword - b.keyword || a.length - b.length || a.name.localeCompare(b.name)
  );
  return { name: candidates[0].name, hex: candidates[0].hex };
}

function colorRoles(map) {
  const found = {};
  for (const role of ROLES) {
    const hit = bestVar(map, role);
    if (hit) found[role.role] = hit;
  }
  return found;
}

function shadowLadder(map) {
  const seen = new Map();
  for (const [name, raw] of map) {
    if (!/(shadow|elevation)/i.test(name) || /(color|inset|focus|border)/i.test(name)) continue;
    const value = resolve(raw, map);
    if (!/px/.test(value) || /^(none|0)$/.test(value)) continue;
    if (!seen.has(value)) seen.set(value, name);
    if (seen.size >= 4) break;
  }
  return [...seen.entries()].map(([value, name]) => ({ name, value }));
}

export function kitFromCss(css, meta) {
  const map = declarations(css);
  const inline = [...css.matchAll(/font-size\s*:\s*([\d.]+(?:px|rem))/gi)].map((m) => m[1]);

  const type = ladder([...pick(map, /(font-size|fontsize|text-size|size-text|type-size|-fs-)/), ...inline], { min: 10, max: 200 });
  const space = ladder(pick(map, /(^|-)(space|spacing|gap|inset|padding|margin)(-|$)|base-size/, /(font|text|type|line-height|icon|avatar|border|radius)/), {
    min: 2,
    max: 160,
  });
  const radii = ladder(pick(map, /(radius|rounded|corner)/, /(width|style|color)/), { min: 0, max: 64 });

  const durations = [
    ...new Set(
      pick(map, /(duration|motion|transition|timing|anim)/i)
        .map((v) => String(v).match(/^([\d.]+)(ms|s)$/))
        .filter(Boolean)
        .map((m) => Math.round(m[2] === 's' ? Number(m[1]) * 1000 : Number(m[1])))
        .filter((n) => n >= 40 && n <= 1200)
    ),
  ].sort((a, b) => a - b);

  const easings = [...new Set([...css.matchAll(/cubic-bezier\([^)]+\)/gi)].map((m) => m[0].replace(/\s+/g, '')))].slice(0, 4);

  const roles = colorRoles(map);
  const pair =
    roles['текст'] && roles['фон']
      ? { text: roles['текст'].hex, bg: roles['фон'].hex, ratio: contrast(roles['текст'].hex, roles['фон'].hex) }
      : null;
  const accentOnBg =
    roles['акцент'] && roles['фон'] ? contrast(roles['акцент'].hex, roles['фон'].hex) : null;

  return {
    ...meta,
    takenAt: new Date().toISOString().slice(0, 10),
    vars: map.size,
    type: { scale: type, ui: type.filter((n) => n <= 40), step: step(type.filter((n) => n <= 40)) },
    space: { scale: space.filter((n) => n <= 96), step: step(space.filter((n) => n <= 96)) },
    radii,
    shadows: shadowLadder(map),
    motion: { durations, easings },
    color: { roles, pair, accentOnBg },
  };
}

export async function fetchKit(keyOrUrl, { log = () => {} } = {}) {
  const known = SYSTEMS.find((s) => s.key === keyOrUrl);
  const meta = known ?? { key: 'custom', name: keyOrUrl, origin: 'вручную', license: 'проверь сам', docs: keyOrUrl, css: [keyOrUrl] };
  const parts = [];
  for (const url of meta.css) {
    log(`тяну ${url}`);
    parts.push(await get(url));
  }
  const { css: _sources, ...rest } = meta;
  return kitFromCss(parts.join('\n'), { ...rest, sources: meta.css });
}

export function cachePath(key) {
  return path.join(CACHE_DIR, `${key}.json`);
}

export function saveKit(kit) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const file = cachePath(kit.key);
  writeFileSync(file, `${JSON.stringify(kit, null, 2)}\n`, 'utf8');
  return file;
}

export function loadKit(key) {
  try {
    return JSON.parse(readFileSync(cachePath(key), 'utf8'));
  } catch {
    return null;
  }
}

export async function resolveKit(key, { log = () => {} } = {}) {
  try {
    const kit = await fetchKit(key, { log });
    saveKit(kit);
    return kit;
  } catch (e) {
    const cached = loadKit(key);
    if (!cached) throw e;
    log(`сеть не дала (${e.message}) — беру снимок от ${cached.takenAt}`);
    return cached;
  }
}

const listOf = (values, unit = '') => values.map((v) => `${v}${unit}`).join(' · ');

export function kitBlock(kit) {
  const ui = kit.type.ui.length ? kit.type.ui : kit.type.scale;
  const lines = [
    `ИЗМЕРИМАЯ ЧАСТЬ СТИЛЯ — снята с живой дизайн-системы «${kit.name}» (${kit.license}, ${kit.vars} переменных, срез ${kit.takenAt}).`,
    'Это лестницы чисел, а не внешний вид. Настроение, шрифты, цвет и композиция остаются за',
    'арт-дирекшеном выше: страница малого бизнеса не должна выглядеть как корпоративная панель.',
    '',
  ];
  if (ui.length >= 4) {
    lines.push(
      `- Кегли интерфейса и текста, px: ${listOf(ui)}. Бери ступени отсюда, промежуточных не выдумывай.`,
      '  Дисплейный заголовок первого экрана — исключение: его кегль задаёт арт-дирекшен, он крупнее',
      '  всего, что есть в системе, и это правильно для посадочной страницы.'
    );
  }
  if (kit.space.step && kit.space.scale.length >= 5) {
    lines.push(
      `- Шаг сетки ${kit.space.step}px. Отступы, поля и промежутки — только из лестницы: ${listOf(kit.space.scale)} px.`,
      '  Отбивка секций набирается умножением шага, а не круглым числом на глаз.'
    );
  }
  if (kit.radii.length) {
    lines.push(`- Радиусы: ${listOf(kit.radii, 'px')}. На странице живут два-три из них, а не все сразу.`);
  }
  if (kit.motion.durations.length) {
    lines.push(
      `- Длительности переходов, мс: ${listOf(kit.motion.durations.slice(0, 6))}${kit.motion.easings.length ? `; кривые: ${kit.motion.easings.slice(0, 2).join(' ')}` : ''}.`,
      '  Наведение и фокус — короткая ступень, появление крупного блока — длинная.'
    );
  }
  lines.push(
    kit.color.pair && kit.color.pair.ratio >= 4.5
      ? `- Проверка контраста: базовая пара «текст на фоне» в системе даёт ${kit.color.pair.ratio}:1 — это норма, а не потолок.`
      : '- Проверка контраста обязательна:'
  );
  lines.push(
    '  Свою пару из палитры арт-дирекшена держи не ниже 4.5:1 для текста и 3:1 для крупных',
    '  заголовков, границ полей и иконок. Цвета системы на страницу НЕ переносятся — это чужой',
    '  бренд; переносится требование к контрасту.'
  );
  lines.push(
    '- Состояния обязательны у всего кликабельного: покой, наведение, нажатие, фокус с видимым',
    '  кольцом (outline 2px и offset 2px, не outline: none), недоступность. Разница между состояниями',
    '  делается сдвигом по той же лестнице, а не случайным цветом.'
  );
  return lines.join('\n');
}

export function formatKit(kit) {
  const role = (name) => (kit.color.roles[name] ? `${kit.color.roles[name].hex} (${kit.color.roles[name].name})` : '—');
  return [
    `\n=== ${kit.name} · ${kit.origin} · ${kit.license} · ${kit.docs}`,
    `  переменных: ${kit.vars} · срез ${kit.takenAt}`,
    `  кегли, px: ${listOf(kit.type.scale.slice(0, 14)) || '—'}${kit.type.scale.length > 14 ? ' …' : ''}`,
    `  шаг сетки: ${kit.space.step ?? '—'}px · отступы: ${listOf(kit.space.scale.slice(0, 12)) || '—'}`,
    `  радиусы: ${listOf(kit.radii.slice(0, 10), 'px') || '—'}`,
    `  длительности, мс: ${listOf(kit.motion.durations.slice(0, 8)) || '—'} · кривые: ${kit.motion.easings.slice(0, 2).join(' ') || '—'}`,
    `  теней в лестнице: ${kit.shadows.length}`,
    `  роли цвета: текст ${role('текст')} · фон ${role('фон')} · граница ${role('граница')} · акцент ${role('акцент')}`,
    `  контраст пары «текст на фоне»: ${kit.color.pair ? `${kit.color.pair.ratio}:1` : '—'} · акцент на фоне: ${kit.color.accentOnBg ?? '—'}`,
    '',
  ].join('\n');
}

async function discover(pkg) {
  const meta = await (await fetch(`https://data.jsdelivr.com/v1/packages/npm/${pkg}`)).json();
  const version = meta?.tags?.latest;
  if (!version) throw new Error(`пакет ${pkg} не найден на jsDelivr`);
  const tree = await (await fetch(`https://data.jsdelivr.com/v1/packages/npm/${pkg}@${version}`)).json();
  const files = [];
  const walk = (nodes, prefix = '') => {
    for (const node of nodes ?? []) {
      if (node.type === 'directory') walk(node.files, `${prefix}/${node.name}`);
      else if (node.name.endsWith('.css')) files.push({ path: `${prefix}/${node.name}`, size: node.size ?? 0 });
    }
  };
  walk(tree.files);
  return { version, files: files.sort((a, b) => b.size - a.size).slice(0, 15) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, argument] = process.argv.slice(2);
  const log = (m) => process.stderr.write(`[дизайн-система] ${m}\n`);

  if (command === 'list' || !command) {
    process.stdout.write('\nКаталоги, откуда берутся системы:\n');
    for (const c of CATALOGS) process.stdout.write(`  ${c.name} — ${c.url} (${c.scope})\n`);
    process.stdout.write('\nСистемы с машинным входом:\n');
    for (const s of SYSTEMS) process.stdout.write(`  ${s.key.padEnd(10)} ${s.name} · ${s.origin} · ${s.license}\n`);
    process.stdout.write('\nkit <ключ|url-стилей> — снять лестницы · discover <npm-пакет> — найти файл токенов\n\n');
  } else if (command === 'discover') {
    if (!argument) {
      process.stderr.write('нужен npm-пакет, например @consta/uikit\n');
      process.exit(1);
    }
    const { version, files } = await discover(argument);
    process.stdout.write(`\n${argument}@${version} — крупнейшие CSS-файлы:\n`);
    for (const f of files) process.stdout.write(`  ${String(Math.round(f.size / 1024)).padStart(5)} КБ  ${CDN}${argument}${f.path}\n`);
    process.stdout.write('\n');
  } else if (command === 'kit') {
    if (!argument) {
      process.stderr.write('нужен ключ системы или ссылка на CSS с переменными\n');
      process.exit(1);
    }
    const kit = await fetchKit(argument, { log });
    process.stdout.write(formatKit(kit));
    if (SYSTEMS.some((s) => s.key === argument)) log(`снимок сохранён: ${saveKit(kit)}`);
    process.stdout.write(`${kitBlock(kit)}\n`);
  } else if (command === 'all') {
    for (const system of SYSTEMS) {
      try {
        const kit = await fetchKit(system.key, { log });
        saveKit(kit);
        process.stdout.write(formatKit(kit));
      } catch (e) {
        process.stdout.write(`\n=== ${system.name}\n  недоступна: ${e.message}\n`);
      }
    }
  } else {
    process.stderr.write(`неизвестная команда «${command}»: list · kit · all · discover\n`);
    process.exit(1);
  }
}
