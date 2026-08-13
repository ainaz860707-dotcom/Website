#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const files = process.argv.slice(2);
if (!files.length) {
  process.stderr.write('использование: node tools/check-page.mjs <файл.html> [<файл.html> ...]\n');
  process.exit(1);
}

function styles(html) {
  return [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
}

function rules(css) {
  const withoutKeyframes = css.replace(/@(-webkit-)?keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/gi, '');
  const withoutAtBlocks = withoutKeyframes.replace(/@(media|supports)[^{]+\{/g, '{');
  return [...withoutAtBlocks.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim(),
    body: m[2],
  }));
}

const HIDING = /(^|[;\s])(opacity\s*:\s*0(\.0+)?\s*[;}]|visibility\s*:\s*hidden)/i;
const BY_DESIGN =
  /\.js\b|mobile|panel|spotlight|cursor|drawer|overlay|toggle|checkbox|input|sr-only|visually-hidden|::(before|after)|:(hover|focus|checked|target)|tooltip|dialog|\[hidden\]/i;

function textOf(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function topTypes(node) {
  if (Array.isArray(node)) return node.flatMap(topTypes);
  if (!node || typeof node !== 'object') return [];
  if (node['@graph']) return topTypes(node['@graph']);
  return [node['@type']].flat().filter(Boolean);
}

function ldTypes(html) {
  return [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].flatMap((m) => {
    try {
      return topTypes(JSON.parse(m[1]));
    } catch {
      return ['НЕ РАЗОБРАН'];
    }
  });
}

const DEPRECATED_LD = {
  HowTo: 'расширенные результаты сняты в сентябре 2023',
  SpecialAnnouncement: 'снят 31 июля 2025',
  CourseInfo: 'снят в июне 2025',
  EstimatedSalary: 'снят в июне 2025',
  LearningVideo: 'снят в июне 2025',
  ClaimReview: 'снят в июне 2025',
  VehicleListing: 'снят в июне 2025',
};

const QUESTION = /\?|^(как|что|почему|зачем|сколько|где|когда|какой|какая|какое|какие|кто|чем|нужно ли|можно ли|стоит ли|есть ли)\b/i;

function headings(html) {
  return [...html.matchAll(/<(h2|h3|summary)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) =>
    textOf(m[2]),
  );
}

function words(value) {
  return value.split(/\s+/).filter(Boolean).length;
}

function sections(html) {
  return html
    .split(/<h2\b/i)
    .slice(1)
    .map((chunk) => words(textOf(chunk)));
}

function longParagraphs(html) {
  return [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => textOf(m[1]))
    .filter((t) => (t.match(/[.!?…](\s|$)/g) || []).length > 4).length;
}

const FLAT_WHITE = /(^|[;\s])background(-color)?\s*:\s*(#fff(fff)?|white|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))\s*(;|$)/i;
const LAYERED = /(url\(|gradient\()/i;

function surface(css) {
  const all = rules(css);
  const base = all.filter((r) => /(^|,)\s*(html|body)\s*(,|$)/i.test(r.selector));
  const declared = base.map((r) => r.body).join(';');
  const overlay = all.some(
    (r) => /\b(html|body)\b[^,]*::(before|after)/i.test(r.selector) && /position\s*:\s*fixed/i.test(r.body) && LAYERED.test(r.body),
  );
  return {
    painted: Boolean(declared),
    layered: LAYERED.test(declared) || overlay,
    flatWhite: FLAT_WHITE.test(declared),
    grain: /feturbulence/i.test(css),
  };
}

function gridRisk(css) {
  const twoColumn = rules(css).filter((r) => /grid-template-columns\s*:\s*[^;]*\s+[^;]+/.test(r.body) && /display\s*:\s*grid/.test(r.body));
  return twoColumn.filter((r) => css.includes(`${r.selector}::before`)).map((r) => r.selector);
}

let failed = 0;

for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const css = styles(html);
  const text = textOf(html);
  const found = [];
  const count = (re) => (html.match(re) || []).length;

  const outsideSvg = html.replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
  const onlyInsideSvg = (selector) => {
    const classes = [...selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
    if (!classes.length) return false;
    return classes.every((name) => !new RegExp(`class="[^"]*\\b${name}\\b`).test(outsideSvg));
  };

  const STATE_CLASS = /\.is-[a-zA-Z0-9-]+\b/;
  const decorative = (selector) => {
    const classes = [...selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
    if (!classes.length) return false;
    return classes.some((name) =>
      new RegExp(`<[a-z]+\\b[^>]*class="[^"]*\\b${name}\\b[^"]*"[^>]*aria-hidden="true"`, 'i').test(html),
    );
  };

  for (const rule of rules(css)) {
    if (!HIDING.test(rule.body) || BY_DESIGN.test(rule.selector)) continue;
    if (STATE_CLASS.test(rule.selector)) continue;
    if (onlyInsideSvg(rule.selector) || decorative(rule.selector)) continue;
    found.push(`скрытие вне .js: «${rule.selector}» прячет содержимое без скриптов`);
  }

  if (!/@media\s+print/i.test(css)) found.push('нет @media print — на печати останутся пустые блоки');
  if (!/prefers-reduced-motion/i.test(css)) found.push('нет @media (prefers-reduced-motion: reduce)');
  if (/\.js\s+\.reveal/.test(css) && !/classList\.add\(['"]js['"]\)/.test(html)) {
    found.push('в CSS есть .js .reveal, но скрипт, ставящий класс js, отсутствует');
  }
  if (text.length < 1500) found.push(`текста без скриптов ${text.length} знаков — краулеру нейросети нечего цитировать`);
  if (count(/<h1[\s>]/gi) !== 1) found.push(`h1 ровно один нужен, найдено ${count(/<h1[\s>]/gi)}`);
  const types = ldTypes(html);
  if (!types.length) found.push('нет JSON-LD');
  for (const type of types) {
    if (DEPRECATED_LD[type]) found.push(`тип разметки ${type} устарел: ${DEPRECATED_LD[type]}`);
  }

  const skin = surface(css);
  if (!skin.painted) found.push('фон страницы не задан вовсе — под текстом белый лист браузера');
  else if (skin.flatWhite && !skin.layered) found.push('фон страницы — плоская белая заливка: поверхность из арт-дирекшена не сделана');

  const asked = headings(html).filter((h) => QUESTION.test(h.trim())).length;
  if (asked < 4) found.push(`вопросных заголовков и вопросов ${asked} — нужно от четырёх, вопрос клиента совпадает с его запросом`);

  const body = html.slice(html.search(/<body\b/i) + 1);
  const citable = sections(html).filter((n) => n >= 134 && n <= 167).length;
  const firstScreen = words(textOf(body.split(/<h2\b/i)[0]));
  const wordy = longParagraphs(html);
  const MEDIA_HOSTS = /^https?:\/\/(cdn\.stocksnap\.io|images\.rawpixel\.com|images\.pexels\.com|videos\.pexels\.com)\//;
  const externals = [...html.matchAll(/<(script|img|iframe|video)\b([^>]*)>/gi)].flatMap(([, tag, attrs]) => {
    const link = attrs.match(/\b(?:data-)?src="(https?:[^"]+)"/i);
    return link ? [{ tag: tag.toLowerCase(), src: link[1] }] : [];
  });
  const foreign = externals.filter((e) => !(/^(img|video)$/.test(e.tag) && MEDIA_HOSTS.test(e.src)));
  if (foreign.length) found.push(`внешних src не из фотобанка: ${foreign.length} (${foreign[0].src})`);

  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const HERO_IMG = /class="[^"]*\b(hero__poster|poster)\b/i;
  const inHeroPicture = new Set(
    [...html.matchAll(/<picture\b[^>]*class="[^"]*\b(?:hero__poster|poster)\b[^"]*"[^>]*>([\s\S]*?)<\/picture>/gi)]
      .flatMap((m) => [...m[1].matchAll(/<img\b[^>]*>/gi)].map((i) => i[0])),
  );
  const isPoster = (tag) => HERO_IMG.test(tag) || inHeroPicture.has(tag);
  const posters = images.filter(isPoster);
  const sloppy = images
    .filter((tag) => !isPoster(tag))
    .filter((tag) => !/alt="[^"]{6,}"/i.test(tag) || !/width=/i.test(tag) || !/loading="lazy"/i.test(tag));
  if (sloppy.length) found.push(`снимков без alt, width или loading="lazy": ${sloppy.length} из ${images.length}`);
  const lazyPoster = posters.filter((tag) => /loading="lazy"/i.test(tag));
  if (lazyPoster.length) found.push('постер первого экрана с loading="lazy" — он и есть LCP-кадр, отложенная загрузка его роняет');
  const blindPoster = posters.filter((tag) => !/alt="[^"]{6,}"/i.test(tag) || !/width=/i.test(tag));
  if (blindPoster.length) found.push('у постера первого экрана нет осмысленного alt или width — краулер кадр не увидит');

  const videos = [...html.matchAll(/<video\b[^>]*>/gi)].map((m) => m[0]);
  const ambient = videos.filter((tag) => /\bdata-ambient\b/i.test(tag));
  if (videos.length - ambient.length > 1) {
    found.push(`видео первого экрана ${videos.length - ambient.length} — оно должно быть ровно одно`);
  }
  if (ambient.length > 1) {
    found.push(`фоновых видео ${ambient.length} — больше одного это мегабайты и расфокус`);
  }
  for (const tag of videos) {
    const isAmbient = /\bdata-ambient\b/i.test(tag);
    if (!/\bmuted\b/i.test(tag) || !/\bplaysinline\b/i.test(tag)) {
      found.push('у <video> нет muted или playsinline — на телефоне вместо кадра чёрный прямоугольник');
    }
    const scrubbed = /\bdata-src="/i.test(tag);
    if (scrubbed && /\bautoplay\b/i.test(tag)) {
      found.push('<video> одновременно на скролл-скраббинге (data-src) и на autoplay — приёмы исключают друг друга');
    }
    if (isAmbient) {
      if (/\bsrc="/i.test(tag) || /\bdata-src="/i.test(tag)) {
        found.push('у фонового <video> есть src — с ним браузер тянет метаданные ещё до прокрутки, источники навешивает скрипт');
      }
      if (!/\bdata-webm-desktop="/i.test(tag) || !/\bdata-mp4-desktop="/i.test(tag)) {
        found.push('у фонового <video> нет data-webm-desktop или data-mp4-desktop — скрипту нечего навесить');
      }
      if (!/\bdata-webm-mobile="/i.test(tag) || !/\bdata-mp4-mobile="/i.test(tag)) {
        found.push('у фонового <video> нет вертикальных файлов — кроп горизонтали на телефоне срезает композицию');
      }
      if (!/\bpreload="none"/i.test(tag)) {
        found.push('у фонового <video> нет preload="none" — ролик грузится до входа во вьюпорт и роняет LCP');
      }
      if (!/\bposter="/i.test(tag)) {
        found.push('у фонового <video> нет постера — до загрузки на месте секции пустота');
      }
      continue;
    }
    if (!scrubbed && !/\bsrc="/i.test(tag)) found.push('у <video> нет ни src, ни data-src');
    if (!posters.length && !/\bposter="/i.test(tag)) {
      found.push('видео без постера — пока файл качается, на первом экране пустота');
    }
    if (scrubbed && !/\bdata-src-mobile="/i.test(tag)) {
      found.push('у видео первого экрана нет data-src-mobile — на телефоне идёт кроп горизонтали');
    }
  }
  if (ambient.length && !/IntersectionObserver/i.test(html)) {
    found.push('фоновое видео есть, а IntersectionObserver нет — источники не навесятся, останется один постер');
  }
  if (videos.length && !/requestAnimationFrame/i.test(html) && !/\bautoplay\b/i.test(videos[0])) {
    found.push('видео есть, а скролл-скраббинга нет: без requestAnimationFrame перемотка идёт рывками');
  }
  if (videos.some((tag) => /\bdata-src="/i.test(tag))) {
    const heroTag = html.match(/<[a-z]+\b[^>]*\bdata-hero\b[^>]*>/i);
    const heroClasses = (heroTag?.[0].match(/class="([^"]*)"/i)?.[1] ?? '').split(/\s+/).filter(Boolean);
    const tallEnough = rules(css).some((rule) => {
      const mine = heroClasses.some((name) => new RegExp(`\\.${name}\\s*(?:,|\\{)`).test(`${rule.selector}{`));
      if (!mine) return false;
      const vh = rule.body.match(/(?:min-)?height\s*:\s*(\d+(?:\.\d+)?)vh/i);
      return vh ? Number(vh[1]) >= 200 : false;
    });
    if (!heroTag) {
      found.push('видео на скролл-скраббинге, а секции с data-hero нет — скрипту не за что зацепиться');
    } else if (!tallEnough) {
      found.push(
        `секция с data-hero (${heroClasses.map((c) => `.${c}`).join('') || 'без класса'}) не выше 200vh — скрипт делит прокрутку на «высота минус экран», и весь ролик проматывается за пару сотен пикселей`,
      );
    }
  }
  const warnings = gridRisk(css)
    .filter((selector) => !new RegExp(`class="[^"]*\\b${selector.replace(/^\./, '')}\\b[^"]*"[^>]*>\\s*<div`).test(html))
    .map((selector) => `сетка «${selector}» с ::before в первой ячейке — во второй колонке должен быть один элемент`);

  if (skin.painted && !skin.layered && !skin.flatWhite) {
    warnings.push('фон страницы — одна ровная заливка: свет и зерно из поверхности дирекшена на странице не появились');
  }
  if (/feturbulence/i.test(css) && !/position\s*:\s*fixed/i.test(css)) {
    warnings.push('зерно есть, но неподвижного слоя под него нет — шум на прокручиваемом фоне перерисовывается каждый кадр');
  }
  if (firstScreen < 40) warnings.push(`первый экран ${firstScreen} слов до первого h2 — 44% цитат берут из первой трети страницы, а там пока слоган`);
  if (wordy) warnings.push(`абзацев длиннее четырёх предложений: ${wordy}`);
  if (types.includes('FAQPage')) {
    warnings.push('FAQPage: расширенный сниппет Google снят 7 мая 2026 — разметку оставляем ради разбора страницы, выигрыша в выдаче она больше не даёт');
  }

  process.stdout.write(`\n=== ${file}\n`);
  process.stdout.write(
    `  текста без скриптов: ${text.length} · h1: ${count(/<h1[\s>]/gi)} · details: ${count(/<details[\s>]/gi)} · canvas: ${count(/<canvas[\s>]/gi)} · JSON-LD: ${types.join(', ') || 'нет'}\n`,
  );
  process.stdout.write(
    `  вопросов: ${asked} · блоков 134–167 слов: ${citable} · первый экран: ${firstScreen} слов · длинных абзацев: ${wordy}\n`,
  );
  process.stdout.write(
    `  поверхность: ${skin.layered ? 'слоями' : skin.painted ? 'ровная заливка' : 'не задана'}${skin.grain ? ' + зерно' : ''}\n`,
  );
  for (const problem of found) process.stdout.write(`  ✗ ${problem}\n`);
  for (const warning of warnings) process.stdout.write(`  ⚠ ${warning}\n`);
  if (found.length) failed += 1;
  else process.stdout.write('  ✓ проверки пройдены\n');
}

process.exit(failed ? 1 : 0);
