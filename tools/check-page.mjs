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

function ldTypes(html) {
  return [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].flatMap((m) => {
    try {
      const parsed = JSON.parse(m[1]);
      return (Array.isArray(parsed) ? parsed : [parsed]).map((x) => x['@type']);
    } catch {
      return ['НЕ РАЗОБРАН'];
    }
  });
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
  if (!ldTypes(html).length) found.push('нет JSON-LD');
  if (count(/src="https?:/gi)) found.push(`внешних src: ${count(/src="https?:/gi)} — графика должна быть своей`);
  const warnings = gridRisk(css)
    .filter((selector) => !new RegExp(`class="[^"]*\\b${selector.replace(/^\./, '')}\\b[^"]*"[^>]*>\\s*<div`).test(html))
    .map((selector) => `сетка «${selector}» с ::before в первой ячейке — во второй колонке должен быть один элемент`);

  process.stdout.write(`\n=== ${file}\n`);
  process.stdout.write(
    `  текста без скриптов: ${text.length} · h1: ${count(/<h1[\s>]/gi)} · details: ${count(/<details[\s>]/gi)} · canvas: ${count(/<canvas[\s>]/gi)} · JSON-LD: ${ldTypes(html).join(', ') || 'нет'}\n`,
  );
  for (const problem of found) process.stdout.write(`  ✗ ${problem}\n`);
  for (const warning of warnings) process.stdout.write(`  ⚠ ${warning}\n`);
  if (found.length) failed += 1;
  else process.stdout.write('  ✓ проверки пройдены\n');
}

process.exit(failed ? 1 : 0);
