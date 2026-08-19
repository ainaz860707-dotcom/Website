#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const MIME = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

const KEEP_SUBSETS = ['cyrillic', 'cyrillic-ext', 'latin', 'latin-ext'];

async function fontFaces(href, log) {
  const res = await fetch(href, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Google Fonts: HTTP ${res.status}`);
  const css = await res.text();
  const blocks = [...css.matchAll(/\/\*\s*([a-z-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)];
  if (!blocks.length) throw new Error('в CSS нет блоков @font-face с подписью подмножества');

  const kept = [];
  for (const [, subset, block] of blocks) {
    if (!KEEP_SUBSETS.includes(subset)) continue;
    const url = block.match(/url\((https:\/\/[^)]+\.woff2)\)/)?.[1];
    if (!url) continue;
    const font = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!font.ok) throw new Error(`шрифт ${url}: HTTP ${font.status}`);
    const base64 = Buffer.from(await font.arrayBuffer()).toString('base64');
    kept.push(block.replace(/url\(https:\/\/[^)]+\.woff2\)/, `url(data:font/woff2;base64,${base64})`));
  }
  log(`шрифты: вшито блоков ${kept.length} из ${blocks.length}`);
  return kept.join('\n');
}

function dataUri(file) {
  const ext = path.extname(file).toLowerCase();
  const mime = MIME[ext];
  if (!mime) throw new Error(`неизвестный тип файла: ${file}`);
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

export async function inlinePage(source, { log = () => {} } = {}) {
  const dir = path.dirname(source);
  let html = fs.readFileSync(source, 'utf8');

  const link = html.match(/<link[^>]+href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"[^>]*>/);
  if (link) {
    const faces = await fontFaces(link[1].replace(/&amp;/g, '&'), log);
    html = html.replace(link[0], `<style>\n${faces}\n</style>`);
    html = html.replace(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>\s*/g, '');
  }

  let assets = 0;
  html = html.replace(/(src|poster)="((?!https?:|data:)[^"]+)"/g, (whole, attr, rel) => {
    const file = path.join(dir, rel);
    if (!fs.existsSync(file)) {
      log(`НЕ НАЙДЕНО: ${rel}`);
      return whole;
    }
    assets += 1;
    return `${attr}="${dataUri(file)}"`;
  });
  log(`вшито файлов: ${assets}`);

  return html;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [source, target] = process.argv.slice(2);
  if (!source || !target) {
    process.stdout.write('использование: node tools/inline-page.mjs <исходник.html> <результат.html>\n');
    process.exit(1);
  }
  const html = await inlinePage(path.resolve(source), { log: (m) => process.stdout.write(`${m}\n`) });
  fs.writeFileSync(path.resolve(target), html);
  const mb = (Buffer.byteLength(html) / 1048576).toFixed(2);
  process.stdout.write(`готово: ${target}, ${mb} МБ\n`);
}
