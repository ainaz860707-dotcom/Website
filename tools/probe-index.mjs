#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const dir = path.join('artifacts', 'core-probe', 'site-gen');
const casesFile = path.join('plans', 'analysis', '2026-08-10-proba-yadra-site-gen', 'cases.yaml');

const cases = [];
let id = null;
for (const line of readFileSync(casesFile, 'utf8').split('\n')) {
  const m = line.match(/^\s*-\s*id:\s*(\d+)\s*$/);
  if (m) { id = m[1]; continue; }
  const t = line.match(/^\s*input:\s*"(.*)"\s*$/);
  if (t && id) { cases.push({ id: id.padStart(3, '0'), input: t[1] }); id = null; }
}

const rows = cases.map(({ id: cid, input }) => {
  const file = `${cid}.html`;
  const ready = existsSync(path.join(dir, file));
  const link = ready
    ? `<a href="${file}" target="_blank">открыть сайт →</a>`
    : '<span class="pending">ещё генерируется</span>';
  return `<li class="${ready ? 'ready' : 'wait'}"><span class="num">${Number(cid)}</span><div><p class="inp">${input}</p>${link}</div></li>`;
}).join('\n');

const ready = cases.filter((c) => existsSync(path.join(dir, `${c.id}.html`))).length;

const html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Проба ядра — 20 сайтов</title>
<style>
:root { color-scheme: light dark; }
body { max-width: 820px; margin: 0 auto; padding: 32px 20px 80px; font: 16px/1.55 -apple-system, system-ui, sans-serif; }
h1 { font-size: 26px; margin: 0 0 6px; }
.sub { color: #6b7280; margin: 0 0 28px; }
.ask { background: #fef3c7; color: #78350f; border-radius: 10px; padding: 14px 16px; margin-bottom: 28px; }
ul { list-style: none; padding: 0; margin: 0; }
li { display: flex; gap: 14px; padding: 16px 0; border-top: 1px solid #e5e7eb; }
.num { flex: 0 0 32px; height: 32px; border-radius: 50%; background: #111827; color: #fff; display: grid; place-items: center; font-size: 14px; font-weight: 600; }
li.wait .num { background: #d1d5db; color: #6b7280; }
.inp { margin: 4px 0 8px; }
a { color: #1d4ed8; font-weight: 600; }
.pending { color: #9ca3af; font-size: 14px; }
@media (prefers-color-scheme: dark) {
  body { background: #0b0f19; color: #e5e7eb; }
  li { border-color: #1f2937; }
  .ask { background: #422006; color: #fde68a; }
  a { color: #93c5fd; }
}
</style></head><body>
<h1>Проба ядра: 20 сайтов из описаний</h1>
<p class="sub">Готово ${ready} из ${cases.length}. Обнови страницу, чтобы подтянуть новые.</p>
<div class="ask"><strong>Вопрос по каждому сайту один:</strong> отдала бы эту страницу тому человеку из описания слева, не переписывая тексты? Не «нравится дизайн» — именно отдала бы или нет. Ответ пиши мне списком: <em>1 да, 2 нет — вода в текстах, 3 да…</em></div>
<ul>
${rows}
</ul>
</body></html>`;

writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
process.stdout.write(`${path.join(dir, 'index.html')} — готово ${ready} из ${cases.length}\n`);
