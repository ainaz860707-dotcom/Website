#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractTokens, luminance, saturation, toHex } from './reference-tokens.mjs';
import { cosmosCaptions, mobbinSites, pinterestSites, withOwnerBrowser } from './reference-sources.mjs';

const CACHE_DIR = path.join('references', 'niches');
const DEFAULT_PROFILE = path.join(homedir(), 'Library', 'Caches', 'ms-playwright-mcp', 'mcp-chrome-2d32ba4');
const SITES_PER_PASS = 4;
const CACHE_DAYS = 30;

const PROFILES = [
  {
    key: 'visual',
    title: 'бизнес продаёт картинку',
    marks: /фото|видео|свадеб|тату|флорист|букет|интерьер|дизайн|барбершоп|маникюр|педикюр|стилист|бров|ресниц|кондитер|торт|мебел|декор|съёмк|съемк/i,
    styles: ['Photography'],
    categories: ['Shopping'],
    pinterest: 'wedding photographer portfolio website design',
    cosmos: 'weddings',
    pinned: ['https://shiraliev.ru/'],
    gallery: true,
  },
  {
    key: 'craft',
    title: 'еда и ремесло, продаёт вкус и место',
    marks: /кофейн|пекарн|кафе|ресторан|бар\b|хлеб|закваск|ферм|сыровар|пивовар|мастерск|керамик|свеч/i,
    styles: ['Photography'],
    categories: ['Shopping'],
    pinterest: 'coffee shop bakery website design',
    cosmos: null,
    gallery: true,
  },
  {
    key: 'care',
    title: 'здоровье и уход, продаёт доверие',
    marks: /стоматолог|клиник|ветеринар|психолог|массаж|врач|медиц|терапевт|реабилитац|зуб|лечен/i,
    styles: ['Minimal'],
    categories: null,
    pinterest: 'clinic health website design minimal',
    cosmos: null,
    gallery: false,
  },
  {
    key: 'formal',
    title: 'документы и деньги, продаёт надёжность',
    marks: /юрист|адвокат|бухгалт|банкрот|налог|страхов|нотариус|аудит|консалт|учёт|учет/i,
    styles: ['Minimal'],
    categories: ['Business'],
    pinterest: 'law firm accountant website design',
    cosmos: null,
    gallery: false,
  },
  {
    key: 'technical',
    title: 'техника и работа руками, продаёт результат',
    marks: /автосервис|ремонт|перетяжк|стиральн|грузоперевоз|сантехник|электрик|производств|теплиц|монтаж|установк|клининг|уборк|окн|кровл/i,
    styles: ['Minimal', 'Motion'],
    categories: ['Business'],
    pinterest: 'service repair company website design',
    cosmos: null,
    gallery: false,
  },
  {
    key: 'learning',
    title: 'обучение и дети, продаёт увлечение',
    marks: /школ|курс|репетитор|детск|робототехник|танц|музык|язык|обучен|студи[яию]\s|секц/i,
    styles: ['Illustration', 'Colorful'],
    categories: null,
    pinterest: 'kids school studio website design',
    cosmos: null,
    gallery: false,
  },
];

const FALLBACK_PROFILE = { key: 'plain', title: 'общий случай', styles: ['Minimal'], categories: null, pinterest: 'small business landing page design', cosmos: null, gallery: false };

const TECH_TAGLINE =
  /\bAI\b|platform|software|cloud|API|SaaS|autonomous|robotics|developer|infrastructure|analytics|crypto|fintech|agent|smart |telehealth|electric|vehicle|computer|energy|instruments|aviation|\bRV\b/i;

export function nicheProfile(description) {
  const text = String(description).toLowerCase();
  return PROFILES.find((p) => p.marks.test(text)) ?? FALLBACK_PROFILE;
}

const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function slugify(text) {
  return String(text)
    .toLowerCase()
    .split('')
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function nicheKey(description) {
  const profile = nicheProfile(description);
  const words = slugify(description)
    .split('-')
    .filter((w) => w.length > 3)
    .slice(0, 3);
  return [profile.key, ...words].join('-') || profile.key;
}

const SUBJECT_VOCABULARY = [
  [/\bdress|gown|bridal\b/i, 'платье невесты'],
  [/\bring|engagement|diamond|band\b/i, 'кольца и детали'],
  [/\bceremony|altar|vows|officiant\b/i, 'церемония'],
  [/\bbouquet|florals?|flowers?|floral\b/i, 'букет и флористика'],
  [/\btable|tablescape|place setting|reception|dinner\b/i, 'сервировка и застолье'],
  [/\bportrait|couple|bride and groom|newlyweds\b/i, 'портрет пары'],
  [/\bdance|dancing|party\b/i, 'первый танец'],
  [/\bvenue|location|landscape|beach|mountain|chapel|estate\b/i, 'локация съёмки'],
  [/\binvitation|stationery|calligraphy|card\b/i, 'приглашения и детали'],
  [/\bcake|dessert|food\b/i, 'торт и угощение'],
  [/\bveil|hair|makeup|getting ready|robe\b/i, 'сборы'],
  [/\bsuit|groom|tuxedo\b/i, 'жених'],
  [/\bguests?|family|toast\b/i, 'гости и эмоции'],
];

export function subjectsFromCaptions(captions) {
  const counts = new Map();
  for (const caption of captions) {
    for (const [mark, label] of SUBJECT_VOCABULARY) {
      if (mark.test(caption)) counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, count]) => ({ label, count }));
}

async function gatherSources(profile, { profileDir, log }) {
  return withOwnerBrowser(
    async (page) => {
      const result = { sites: [], subjects: [], captionCount: 0 };

      const fromPinterest = await pinterestSites(page, { query: profile.pinterest, pages: 2 }).catch((e) => {
        log(`Pinterest мимо: ${e.message}`);
        return [];
      });
      log(`Pinterest: сайтов ниши ${fromPinterest.length}`);

      const fromMobbin = await mobbinSites(page, { styles: profile.styles, categories: profile.categories, pages: 2 }).catch((e) => {
        log(`Mobbin мимо: ${e.message}`);
        return [];
      });
      log(`Mobbin: кураторских сайтов ${fromMobbin.length}`);

      if (profile.cosmos) {
        const captions = await cosmosCaptions(page, { slug: profile.cosmos, scrolls: 4 }).catch((e) => {
          log(`Cosmos мимо: ${e.message}`);
          return [];
        });
        result.captionCount = captions.length;
        result.subjects = subjectsFromCaptions(captions);
        log(`Cosmos: подписей ${captions.length} → сюжетов ${result.subjects.length}`);
      }

      const pinned = (profile.pinned ?? []).map((url) => ({ name: `закреплён владельцем: ${url}`, url, source: 'pinned' }));
      result.sites = [...pinned, ...fromPinterest, ...fromMobbin.filter((s) => !TECH_TAGLINE.test(s.tagline ?? ''))];
      return result;
    },
    { profileDir }
  );
}

const NOT_A_BRAND_COLOR = new Set([
  '#2563EB', '#3B82F6', '#1D4ED8', '#0D6EFD', '#007BFF', '#3858E9', '#0000EE', '#0000FF',
  '#25D366', '#0088CC', '#229ED9', '#1877F2', '#E4405F', '#FF0000', '#0077FF', '#00B900', '#1DA1F2',
]);

function pickPalette(colors) {
  const scored = colors
    .map((c) => ({ value: toHex(c.value), count: c.count, lum: luminance(c.value), sat: saturation(c.value) }))
    .filter((c) => c.value && c.lum !== null);

  const byCount = (a, b) => b.count - a.count;
  const paper = scored.filter((c) => c.lum > 0.86 && c.sat < 0.25).sort(byCount)[0];
  const ink = scored.filter((c) => c.lum < 0.28).sort(byCount)[0];
  const accent = scored
    .filter((c) => c.sat > 0.4 && c.lum > 0.12 && c.lum < 0.8 && c.count > 1 && !NOT_A_BRAND_COLOR.has(c.value))
    .sort((a, b) => b.count - a.count || b.sat - a.sat)[0];
  const muted = scored.filter((c) => c.lum >= 0.35 && c.lum <= 0.75 && c.sat < 0.35).sort(byCount)[0];

  return {
    paper: paper?.value ?? '#FFFFFF',
    ink: ink?.value ?? '#111111',
    accent: accent?.value ?? null,
    muted: muted?.value ?? '#8A8A8A',
  };
}

const SERIF_MARK = /serif|caslon|garamond|prata|times|georgia|playfair|didot|canela|ogg|editorial|ionic|freight|tiempos|domaine/i;

const GENERIC_FONT = /^(mono|sans|serif|body|text|heading|icons?)$|videojs|swiper|slick|glide|icomoon|fontawesome|material icons/i;

function pickFonts(tokens) {
  const weighted = new Map();
  for (const t of tokens)
    for (const f of t.fonts ?? []) {
      if (GENERIC_FONT.test(f.name)) continue;
      weighted.set(f.name, (weighted.get(f.name) ?? 0) + f.count);
    }
  const ranked = [...weighted.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  const display = ranked.find((f) => SERIF_MARK.test(f.name)) ?? ranked[0] ?? null;
  const text = ranked.find((f) => f !== display) ?? null;
  return { display: display?.name ?? null, text: text?.name ?? null, ranked: ranked.slice(0, 8) };
}

function pickRhythm(tokens) {
  const mins = tokens.map((t) => t.scale?.min).filter(Boolean);
  const maxs = tokens.map((t) => t.scale?.max).filter(Boolean);
  const radii = new Map();
  for (const t of tokens)
    for (const r of t.radii ?? []) {
      const value = r.value.replace('!important', '').trim();
      if (/var\(|calc\(|inherit|%/i.test(value)) continue;
      if (Number.parseFloat(value) >= 100) continue;
      radii.set(value, (radii.get(value) ?? 0) + r.count);
    }
  const dominantRadius = [...radii.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '0';
  const sharp = /^0(px)?$/.test(dominantRadius);
  return {
    scaleMin: mins.length ? Math.min(...mins) : null,
    scaleMax: maxs.length ? Math.max(...maxs) : null,
    radius: dominantRadius,
    sharp,
    easings: [...new Set(tokens.flatMap((t) => t.easings ?? []))].slice(0, 3),
  };
}

export function synthesizeDirection(description, profile, sources, tokens, subjects = []) {
  const usable = tokens.filter((t) => t.ok);
  const palette = pickPalette(usable.flatMap((t) => t.colors ?? []));
  const fonts = pickFonts(usable);
  const rhythm = pickRhythm(usable);

  const paletteLine = [
    `фон ${palette.paper}`,
    `текст ${palette.ink}`,
    palette.accent ? `единственный акцент ${palette.accent}` : 'акцента в референсах не нашлось — держи страницу монохромной',
    `приглушённый ${palette.muted}`,
  ].join(' · ');

  const fontsLine = fonts.display
    ? `'${fonts.display}' на заголовки${fonts.text ? ` + '${fonts.text}' на текст` : ''} — или ближайшая пара с Google Fonts, если этих нет`
    : 'шрифты в референсах не читаются — возьми пару антиква + гротеск с Google Fonts';

  const layout = [
    rhythm.sharp ? 'скругления нулевые' : `скругления около ${rhythm.radius}`,
    rhythm.scaleMin && rhythm.scaleMax ? `шкала кеглей ${rhythm.scaleMin}→${rhythm.scaleMax}px` : null,
    profile.gallery ? 'крупные рамки-слоты под снимки с подписями, много воздуха и широкие поля' : 'плотная сетка, факты в строку, воздух вокруг блока действия',
    'тонкие линейки 1px между секциями',
  ]
    .filter(Boolean)
    .join(', ');

  const detail = [
    palette.accent ? `акцентом красится ровно одно: кнопка действия` : 'выделение — только весом шрифта и линейкой',
    'кнопки без заливки с подчёркиванием на hover',
    rhythm.easings.length ? `кривые переходов как в референсах: ${rhythm.easings[0]}` : 'переходы 200–300мс, без пружин',
  ].join(', ');

  const usedSources = [...new Set(sources.map((s) => s.source ?? 'mobbin'))].join(' + ');

  return {
    key: nicheKey(description),
    name: `${profile.title} — собрано по ${usable.length} референсам (${usedSources})`,
    profile: profile.key,
    fonts: fontsLine,
    palette: paletteLine,
    layout,
    detail,
    gallery: profile.gallery,
    slots: subjects.map((s) => s.label),
    measured: { palette, fonts: fonts.ranked, rhythm, subjects },
    sources: sources.map((s) => ({ name: s.name, url: s.url, from: s.source ?? 'mobbin' })),
    date: new Date().toISOString().slice(0, 10),
  };
}

function cachePath(key) {
  return path.join(CACHE_DIR, `${key}.json`);
}

export function readCache(description) {
  const file = cachePath(nicheKey(description));
  if (!existsSync(file)) return null;
  try {
    const cached = JSON.parse(readFileSync(file, 'utf8'));
    const age = (Date.now() - Date.parse(cached.date)) / 86400000;
    return age > CACHE_DAYS ? null : cached;
  } catch {
    return null;
  }
}

export async function resolveNicheDirection(description, options = {}) {
  const { refresh = false, profileDir = process.env.REFERENCE_BROWSER_PROFILE ?? DEFAULT_PROFILE, log = () => {} } = options;

  if (!refresh) {
    const cached = readCache(description);
    if (cached) {
      log(`референсы из кэша: ${cachePath(cached.key)} (${cached.date})`);
      return cached;
    }
  }

  const profile = nicheProfile(description);
  log(`ниша «${profile.title}»: Pinterest «${profile.pinterest}» · Mobbin ${profile.styles.join('/')} · Cosmos ${profile.cosmos ?? '—'}`);

  const gathered = await gatherSources(profile, { profileDir, log });
  const candidates = gathered.sites.filter((s) => s.url);
  if (!candidates.length) throw new Error('все три источника вернули пусто');
  log(`кандидатов всего: ${candidates.length}`);

  const tokens = [];
  const taken = [];
  for (const site of candidates) {
    if (taken.length >= SITES_PER_PASS) break;
    const t = await extractTokens(site.url);
    log(`  ${site.name} — ${t.ok ? 'токены сняты' : `мимо: ${t.reason}`}`);
    if (!t.ok) continue;
    tokens.push(t);
    taken.push(site);
  }
  if (!tokens.length) throw new Error('ни с одного референса не удалось снять стили');
  log(`в дирекшен легли: ${taken.map((s) => s.name).join(', ')}`);

  const direction = synthesizeDirection(description, profile, taken, tokens, gathered.subjects);
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath(direction.key), `${JSON.stringify(direction, null, 2)}\n`, 'utf8');
  log(`записано в ${cachePath(direction.key)}`);
  return direction;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const refresh = args.includes('--refresh');
  const description = args.filter((a) => a !== '--refresh').join(' ').trim();
  if (!description) {
    process.stderr.write('использование: node niche-reference.mjs [--refresh] "<описание бизнеса>"\n');
    process.exit(1);
  }
  const direction = await resolveNicheDirection(description, { refresh, log: (m) => process.stdout.write(`${m}\n`) });
  process.stdout.write(`\n${JSON.stringify(direction, null, 2)}\n`);
}
