#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const CACHE_PATH = path.join(ROOT, 'artifacts', 'refero', 'styles.json');
const CATALOG = 'https://styles.refero.design';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function payloadOf(html) {
  const marker = 'self.__next_f.push([1,';
  const chunks = [];
  let at = 0;
  while ((at = html.indexOf(marker, at)) !== -1) {
    const open = html.indexOf('"', at + marker.length);
    if (open === -1) break;
    let end = open + 1;
    let escaped = false;
    for (; end < html.length; end += 1) {
      const c = html[end];
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') break;
    }
    try {
      chunks.push(JSON.parse(html.slice(open, end + 1)));
    } catch {}
    at = end + 1;
  }
  return chunks.join('');
}

function objectAt(text, key) {
  const at = text.indexOf(`"${key}":{`);
  if (at === -1) return null;
  const start = at + key.length + 3;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function firstMatch(text, re) {
  return text.match(re)?.[1] ?? null;
}

export async function styleRecord(uuid) {
  const res = await fetch(`${CATALOG}/style/${uuid}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} на /style/${uuid}`);
  const payload = payloadOf(await res.text());
  const design = objectAt(payload, 'designSystem');
  if (!design) throw new Error(`в /style/${uuid} нет блока designSystem`);

  const based = objectAt(payload, 'isBasedOn') ?? {};
  const typography = objectAt(payload, 'typography') ?? {};
  const shapes = objectAt(payload, 'shapes') ?? {};
  const spacing = objectAt(payload, 'spacing') ?? {};
  const keywords = (() => {
    const raw = firstMatch(payload, /"keywords":\[([^\]]*)\]/);
    if (!raw) return [];
    try {
      return JSON.parse(`[${raw}]`);
    } catch {
      return [];
    }
  })();

  return {
    uuid,
    url: `${CATALOG}/style/${uuid}`,
    name: based.name ?? firstMatch(payload, /"og:title","content":"([^"]+?) design system/) ?? uuid,
    site: based.url ?? null,
    category: firstMatch(payload, /"name":"category","content":"([^"]+)"/),
    northStar: firstMatch(payload, /"northStar":"([^"]*)"/),
    description: firstMatch(payload, /"og:description","content":"([^"]+)"/),
    preview: firstMatch(payload, /"contentUrl":"(https:\/\/images\.refero\.design\/[^"]+)"/),
    keywords,
    theme: design.theme ?? null,
    colors: design.colors ?? [],
    fonts: (typography.fonts ?? []).map((f) => ({
      family: f.family,
      weights: f.weights ?? [],
      source: f.source ?? null,
    })),
    typeScale: (() => {
      const raw = firstMatch(payload, /"typeScale":(\[[^\]]*\])/);
      if (!raw) return [];
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    })(),
    radii: (shapes.radii ?? []).map((r) => ({ value: r.value, contexts: r.contexts ?? [], frequency: r.frequency ?? 0 })),
    baseUnit: spacing.baseUnit ?? null,
    dos: design.dos ?? [],
    donts: design.donts ?? [],
  };
}

export async function catalogIndex({ scrolls = 40 } = {}) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ userAgent: UA });
    await page.goto(`${CATALOG}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    let seen = 0;
    let idle = 0;
    for (let i = 0; i < scrolls; i += 1) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 3));
      await page.waitForTimeout(900);
      const count = await page.evaluate(
        () => new Set([...document.querySelectorAll('a[href^="/style/"]')].map((a) => a.getAttribute('href'))).size
      );
      if (count === seen) {
        idle += 1;
        if (idle > 3) break;
      } else idle = 0;
      seen = count;
    }
    return await page.evaluate(() => {
      const map = new Map();
      for (const a of document.querySelectorAll('a[href^="/style/"]')) {
        const uuid = a.getAttribute('href').split('/').pop();
        if (map.has(uuid)) continue;
        const [name, tagline] = a.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
        map.set(uuid, { uuid, name: name ?? null, tagline: tagline ?? null, preview: a.querySelector('img')?.src ?? null });
      }
      return [...map.values()];
    });
  } finally {
    await browser.close();
  }
}

export async function sync({ limit = null, concurrency = 6, log = () => {} } = {}) {
  const index = await catalogIndex();
  const wanted = limit ? index.slice(0, limit) : index;
  log(`каталог: стилей ${index.length}, качаем ${wanted.length}`);

  const styles = [];
  const failed = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (cursor < wanted.length) {
        const item = wanted[cursor];
        cursor += 1;
        try {
          const record = await styleRecord(item.uuid);
          styles.push({ ...record, preview: record.preview ?? item.preview, tagline: item.tagline ?? record.northStar });
        } catch (e) {
          failed.push({ uuid: item.uuid, error: e.message });
        }
        if ((styles.length + failed.length) % 25 === 0) log(`  готово ${styles.length + failed.length}/${wanted.length}`);
      }
    })
  );

  const payload = { source: CATALOG, styles: styles.sort((a, b) => a.name.localeCompare(b.name)), failed };
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  log(`записано ${styles.length} стилей в ${path.relative(ROOT, CACHE_PATH)}${failed.length ? `, не открылось ${failed.length}` : ''}`);
  return payload;
}

export function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) {
    throw new Error(`каталог не скачан: нет ${path.relative(ROOT, CACHE_PATH)} — сначала «node tools/refero-styles.mjs sync»`);
  }
  return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
}

const NICHE_TERMS = [
  [/клининг|уборк|химчистк|мойк/i, ['cleaning', 'home services', 'trust', 'fresh', 'calm', 'blue', 'spacious']],
  [/фотограф|съёмк|съемк|видеограф|фотостуди/i, ['photography', 'editorial', 'portfolio', 'gallery', 'image-led', 'minimal']],
  [/свадебн|торжеств/i, ['wedding', 'romantic', 'elegant', 'serif', 'warm', 'editorial']],
  [/ресторан|кафе|кофейн|пекарн|кондитер|бар\b|еда|доставка еды/i, ['restaurant', 'food', 'appetite', 'warm', 'craft', 'editorial']],
  [/салон красот|барбершоп|парикмахер|маникюр|бров|ресниц|космет|спа/i, ['beauty', 'salon', 'luxury', 'soft', 'elegant', 'fashion']],
  [/клиник|медиц|врач|стоматолог|зуб|анализ/i, ['healthcare', 'clinic', 'trust', 'calm', 'clean', 'accessible']],
  [/психолог|психотерап|коуч/i, ['wellness', 'calm', 'warm', 'human', 'soft', 'trust']],
  [/юрист|адвокат|нотариус|бухгалт|налог|консалт/i, ['professional services', 'authority', 'serif', 'restrained', 'trust', 'corporate']],
  [/банк|финанс|инвест|страхов|кредит/i, ['fintech', 'finance', 'trust', 'data', 'premium', 'restrained']],
  [/недвижим|застройщик|аренда квартир|жк\b/i, ['real estate', 'architecture', 'premium', 'photography', 'editorial']],
  [/интерьер|мебел|ремонт квартир|архитект|строит|кровл|окн/i, ['architecture', 'interior', 'craft', 'material', 'editorial', 'photography']],
  [/автосервис|шиномонтаж|автомойк|ремонт авто|автосалон/i, ['automotive', 'industrial', 'bold', 'dark', 'technical']],
  [/грузоперевоз|логист|доставк|склад/i, ['logistics', 'industrial', 'utility', 'data', 'technical']],
  [/тренер|фитнес|спорт|йог|танц|бассейн/i, ['fitness', 'sport', 'energetic', 'bold', 'motion']],
  [/школ|курс|обучен|репетитор|универс|образован/i, ['education', 'learning', 'friendly', 'accessible', 'structured']],
  [/магазин|шоурум|лавка|товар|интернет-магазин|маркетплейс/i, ['ecommerce', 'product', 'commerce', 'catalog', 'retail']],
  [/агентств|маркетинг|студи[яю]|продакшн|брендинг/i, ['agency', 'creative', 'bold', 'editorial', 'expressive']],
  [/сервис|приложен|платформ|saas|crm|стартап|it\b|разработк/i, ['saas', 'product', 'dev tools', 'dashboard', 'modern']],
  [/ферм|мёд|мед\b|эко|сад|теплиц|питомник/i, ['organic', 'natural', 'earthy', 'craft', 'warm']],
  [/тату|мастерск|ремесл|керамик|столярн/i, ['craft', 'artisan', 'texture', 'expressive', 'editorial']],
];

const MOOD_TERMS = [
  [/тёмн|темн|нуар|ночн|премиум|дорог|люкс|золот/i, ['dark', 'premium', 'luxury', 'gold', 'moody', 'midnight']],
  [/светл|воздушн|минимал|чист|спокойн/i, ['light', 'minimal', 'airy', 'calm', 'restrained', 'white']],
  [/ярк|смел|дерзк|контраст|энерг/i, ['bold', 'vivid', 'high-contrast', 'energetic', 'expressive']],
  [/тепл|уютн|домашн|мягк/i, ['warm', 'soft', 'friendly', 'human', 'cozy']],
  [/строг|технич|инженер|данн|таблиц|дашборд/i, ['technical', 'data', 'dashboard', 'systematic', 'monospace']],
];

export function queryTerms(text) {
  const terms = new Set();
  for (const [marks, words] of [...NICHE_TERMS, ...MOOD_TERMS]) {
    if (marks.test(text)) for (const w of words) terms.add(w);
  }
  for (const word of text.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []) terms.add(word);
  if (!terms.size) for (const w of ['minimal', 'editorial', 'trust', 'modern']) terms.add(w);
  return [...terms];
}

export function matchStyles(cache, text, { limit = 3, terms = null } = {}) {
  const wanted = terms ?? queryTerms(text);
  const scored = cache.styles.map((style) => {
    const haystack = {
      head: `${style.name} ${style.category ?? ''} ${style.northStar ?? ''} ${style.tagline ?? ''}`.toLowerCase(),
      body: `${style.description ?? ''} ${style.keywords.join(' ')} ${style.dos.join(' ')} ${style.donts.join(' ')}`.toLowerCase(),
    };
    const hits = [];
    let score = 0;
    for (const term of wanted) {
      const inHead = haystack.head.includes(term);
      const inBody = haystack.body.includes(term);
      if (!inHead && !inBody) continue;
      score += inHead ? 3 : 1;
      hits.push(term);
    }
    return { style, score, hits };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.style.name.localeCompare(b.style.name))
    .slice(0, limit);
}

export function describeMatch({ style, hits }) {
  const palette = style.colors.slice(0, 4).map((c) => `${c.hex} ${c.name}`).join(', ');
  const fonts = style.fonts.map((f) => f.family).slice(0, 2).join(' + ');
  const scale = style.typeScale.map((t) => t.size).filter(Boolean);
  const radii = style.radii
    .filter((r) => Number.isFinite(r.value) && r.value <= 64)
    .slice(0, 3)
    .map((r) => `${Math.round(r.value)}px`)
    .join('/');
  return [
    `${style.name}${style.category ? ` — ${style.category}` : ''}: «${style.northStar ?? style.tagline ?? ''}»`,
    `  чем подошёл: ${hits.slice(0, 6).join(', ')}`,
    `  тема: ${style.theme ?? '—'}; палитра: ${palette || '—'}`,
    `  шрифты: ${fonts || '—'}; кегли: ${scale.length ? `${Math.min(...scale)}–${Math.max(...scale)}px` : '—'}; шаг сетки: ${style.baseUnit ?? '—'}; радиусы: ${radii || '—'}`,
    `  живой сайт: ${style.site ?? '—'}`,
    `  разбор: ${style.url}`,
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, ...rest] = process.argv.slice(2);
  const args = rest.filter((a) => !a.startsWith('--'));
  const limitFlag = rest.find((a) => a.startsWith('--limit='));
  const limit = limitFlag ? Number(limitFlag.split('=')[1]) : 3;
  const asJson = rest.includes('--json');

  if (command === 'sync') {
    await sync({ limit: limitFlag ? Number(limitFlag.split('=')[1]) : null, log: (m) => process.stdout.write(`${m}\n`) });
  } else if (command === 'match') {
    const text = args.join(' ');
    if (!text) throw new Error('нужен текст ниши: node tools/refero-styles.mjs match "химчистка мебели, выезд на дом"');
    const found = matchStyles(loadCache(), text, { limit });
    if (asJson) process.stdout.write(`${JSON.stringify(found, null, 2)}\n`);
    else if (!found.length) process.stdout.write('в каталоге ничего не совпало — расширь запрос или синхронизируй каталог\n');
    else process.stdout.write(`${found.map(describeMatch).join('\n\n')}\n`);
  } else if (command === 'show') {
    const key = args.join(' ').toLowerCase();
    const cache = loadCache();
    const style = cache.styles.find((s) => s.uuid === key || s.name.toLowerCase() === key || (s.site ?? '').includes(key));
    if (!style) throw new Error(`в каталоге нет «${key}»`);
    process.stdout.write(`${JSON.stringify(style, null, 2)}\n`);
  } else {
    process.stdout.write(
      [
        'использование:',
        '  node tools/refero-styles.mjs sync [--limit=N]          скачать каталог styles.refero.design в artifacts/refero/styles.json',
        '  node tools/refero-styles.mjs match "<ниша>" [--limit=N] [--json]   подобрать референсы под нишу',
        '  node tools/refero-styles.mjs show <uuid|имя|домен>      полные токены одного стиля',
        '',
        'каталог бесплатный, аккаунт не нужен. Живой поиск по 150k экранов — это MCP Refero Pro, он не подключён.',
      ].join('\n') + '\n'
    );
  }
}
