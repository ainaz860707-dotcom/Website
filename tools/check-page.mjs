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

  for (const rule of rules(css)) {
    if (!HIDING.test(rule.body) || BY_DESIGN.test(rule.selector)) continue;
    if (onlyInsideSvg(rule.selector)) continue;
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

  const asked = headings(html).filter((h) => QUESTION.test(h.trim())).length;
  if (asked < 4) found.push(`вопросных заголовков и вопросов ${asked} — нужно от четырёх, вопрос клиента совпадает с его запросом`);

  const body = html.slice(html.search(/<body\b/i) + 1);
  const citable = sections(html).filter((n) => n >= 134 && n <= 167).length;
  const firstScreen = words(textOf(body.split(/<h2\b/i)[0]));
  const wordy = longParagraphs(html);
  const PHOTO_HOSTS = /^https?:\/\/(cdn\.stocksnap\.io|images\.rawpixel\.com)\//;
  const externals = [...html.matchAll(/<(script|img|iframe)[^>]+src="(https?:[^"]+)"/gi)];
  const foreign = externals.filter(([, tag, src]) => !(tag.toLowerCase() === 'img' && PHOTO_HOSTS.test(src)));
  if (foreign.length) found.push(`внешних src не из фотобанка: ${foreign.length} (${foreign[0][1]})`);

  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const sloppy = images.filter((tag) => !/alt="[^"]{6,}"/i.test(tag) || !/width=/i.test(tag) || !/loading="lazy"/i.test(tag));
  if (sloppy.length) found.push(`снимков без alt, width или loading="lazy": ${sloppy.length} из ${images.length}`);
  const warnings = gridRisk(css)
    .filter((selector) => !new RegExp(`class="[^"]*\\b${selector.replace(/^\./, '')}\\b[^"]*"[^>]*>\\s*<div`).test(html))
    .map((selector) => `сетка «${selector}» с ::before в первой ячейке — во второй колонке должен быть один элемент`);

  if (!citable) warnings.push('ни одной секции в окне 134–167 слов — цельного куска для цитаты нейросети на странице нет');
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
  for (const problem of found) process.stdout.write(`  ✗ ${problem}\n`);
  for (const warning of warnings) process.stdout.write(`  ⚠ ${warning}\n`);
  if (found.length) failed += 1;
  else process.stdout.write('  ✓ проверки пройдены\n');
}

process.exit(failed ? 1 : 0);
