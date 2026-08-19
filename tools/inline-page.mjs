#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const SUBSETS = new Set(['cyrillic', 'latin']);
const MIME = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', mp4: 'video/mp4', webm: 'video/webm' };

const [src, dst] = process.argv.slice(2);
if (!src || !dst) {
  console.error('использование: node tools/inline-page.mjs <исходная страница> <файл на выход> [--wrap]');
  console.error('  шрифты Google, видео и снимки вшиваются в файл как data:; внешних запросов не остаётся');
  process.exit(1);
}
const wrap = process.argv.includes('--wrap');

let html = await fs.readFile(src, 'utf8');
const dir = path.dirname(src);

const link = html.match(/<link href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/);
if (link) {
  const css = await (await fetch(link[1].replaceAll('&amp;', '&'), { headers: { 'User-Agent': UA } })).text();
  let faces = '';
  let kept = 0;
  for (const chunk of css.split('/*').slice(1)) {
    const subset = chunk.slice(0, chunk.indexOf('*/')).trim();
    if (!SUBSETS.has(subset)) continue;
    const face = chunk.slice(chunk.indexOf('*/') + 2).trim();
    const url = face.match(/url\((https:[^)]+\.woff2)\)/);
    if (!url) continue;
    const buf = Buffer.from(await (await fetch(url[1], { headers: { 'User-Agent': UA } })).arrayBuffer());
    faces += face.replace(
      /url\(https:[^)]+\.woff2\)\s*format\('woff2'\)/,
      `url(data:font/woff2;base64,${buf.toString('base64')}) format('woff2')`,
    ).replace(/\n\s+/g, '') + '\n';
    kept += 1;
  }
  html = html.replace(/<link rel="preconnect"[^>]*>\s*/g, '').replace(/<link href="https:\/\/fonts\.googleapis[^>]*>\s*/, '');
  html = html.replace('<style>', '<style>\n' + faces, 1);
  console.log(`шрифты: вшито ${kept} начертаний, ${Math.round(faces.length / 1024)} КБ`);
}

for (const rel of [...html.matchAll(/(?:src|poster)="((?!https?:|data:)[^"]+\.(?:webp|jpe?g|png|mp4|webm))"/gi)].map((m) => m[1])) {
  const buf = await fs.readFile(path.join(dir, rel));
  html = html.replaceAll(rel, `data:${MIME[rel.split('.').pop().toLowerCase()]};base64,${buf.toString('base64')}`);
}
html = html.replace('preload="none"', 'preload="auto"');

if (!wrap) {
  const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'));
  const body = html.slice(html.indexOf('<body'), html.lastIndexOf('</body>'));
  html = head.replace(/<meta charset[^>]*>\s*/, '').replace(/<meta name="viewport"[^>]*>\s*/, '').trim()
    + '\n<div id="top">' + body.slice(body.indexOf('>') + 1).trim() + '</div>\n';
}

await fs.mkdir(path.dirname(dst), { recursive: true });
await fs.writeFile(dst, html);
console.log(`${dst}: ${Math.round(html.length / 1024 / 1024 * 10) / 10} МБ, внешних запросов 0`);
