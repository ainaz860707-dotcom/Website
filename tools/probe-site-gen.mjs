#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const SLUG = 'site-gen';
const CASES = path.join('plans', 'analysis', '2026-08-10-proba-yadra-site-gen', 'cases.yaml');
const MODEL = process.env.PROBE_MODEL ?? 'claude-sonnet-5';

const input = process.argv.slice(2).join(' ').trim();
if (!input) {
  process.stderr.write('нужен один аргумент: описание бизнеса своими словами\n');
  process.exit(1);
}

function caseId(description) {
  let text = '';
  try {
    text = readFileSync(CASES, 'utf8');
  } catch {
    return '000';
  }
  let current = null;
  for (const line of text.split('\n')) {
    const id = line.match(/^\s*-\s*id:\s*(\d+)\s*$/);
    if (id) current = id[1];
    if (current && line.includes(description)) return current.padStart(3, '0');
  }
  return '000';
}

const PROMPT = `Ты — генератор сайтов внутри сервиса. На вход приходит описание бизнеса,
которое владелец написал своими словами. Твоя задача — выдать готовую одностраничную
посадочную страницу на русском языке, собранную сразу правильно под поиск (SEO) и под
ответы нейросетей (GEO).

ОПИСАНИЕ БИЗНЕСА:
${input}

ЖЁСТКИЕ ЗАПРЕТЫ (нарушение любого = брак):
- Не выдумывай факты, которых нет в описании: цены, сроки работы на рынке, количество
  клиентов, награды, имена сотрудников, отзывы, номера домов, телефоны, часы работы.
- Не пиши воду: «команда профессионалов», «индивидуальный подход», «широкий спектр
  услуг», «качество на высоте» — запрещённые обороты.
- Не теряй и не подменяй город из описания.
- Никаких внешних файлов: ни шрифтов, ни CDN, ни картинок по ссылке.

ЧТО ДЕЛАТЬ С НЕДОСТАЮЩИМИ ДАННЫМИ:
Телефон, точный адрес, часы, цены — оформляй как заметный плейсхолдер-чип вида
<span class="fill">телефон</span>, чтобы владелец подставил за секунду. Плейсхолдер —
только для данных, не для текста: все смысловые тексты должны быть финальными.

ЧТО ДОЛЖНО БЫТЬ НА СТРАНИЦЕ:
1. Первый экран: H1 с сутью дела и городом, одна честная подводка из описания, кнопка
   действия (позвонить или написать).
2. Что делаем — конкретные услуги, выведенные только из описания.
3. Как это устроено — короткий понятный порядок работы, если он следует из описания.
4. Блок вопросов и ответов, 4–6 штук: реальные вопросы клиента такого бизнеса,
   ответы короткие и фактические. Это основной корм для ответов нейросетей — пиши так,
   чтобы каждый ответ можно было процитировать отдельно от страницы.
5. Контакты с городом и районом текстом, а не только в разметке.
6. В самом низу страницы блок <section id="seo-geo"> — панель «SEO и GEO»: два списка,
   «сделано за тебя» и «допиши сам», человеческим языком, без терминов, каждый пункт
   одной строкой и объясняющий зачем. Панель визуально отделена от сайта.

ТЕХНИЧЕСКАЯ ЧАСТЬ (внутри той же страницы):
- <title> до 60 знаков с городом, <meta name="description"> до 155 знаков.
- <html lang="ru">, viewport, <link rel="canonical" href="https://example.com/">.
- Open Graph: og:title, og:description, og:type, og:locale.
- JSON-LD: LocalBusiness (или ProfessionalService / Dentist / VeterinaryCare —
  подходящий тип) с полями name, description, areaServed с городом, address с
  addressLocality, и отдельный блок FAQPage с теми же вопросами и ответами.
- Семантические теги, один H1, осмысленные H2.
- Вёрстка адаптивная, весь CSS в <style>, тёмный текст на светлом фоне, аккуратная
  типографика, читается на телефоне.

ФОРМАТ ОТВЕТА: только исходный код HTML-файла, начиная с <!DOCTYPE html>. Без
пояснений, без markdown-ограждений, без единого слова до или после кода.`;

const scratch = mkdtempSync(path.join(tmpdir(), 'probe-site-gen-'));
const cli = process.env.CLAUDE_CODE_EXECPATH;
if (!cli) {
  process.stderr.write('нет CLAUDE_CODE_EXECPATH — прогонный канал недоступен\n');
  process.exit(1);
}

const r = spawnSync(
  cli,
  ['-p', PROMPT, '--model', MODEL, '--output-format', 'json', '--allowed-tools', '', '--strict-mcp-config'],
  { cwd: scratch, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 600000 },
);

if (r.status !== 0 || r.error) {
  process.stderr.write(`канал не ответил: ${r.error ? r.error.message : `код ${r.status}`}\n${(r.stderr ?? '').slice(-500)}\n`);
  process.exit(1);
}

let payload;
try {
  const line = r.stdout.trim().split('\n').filter((l) => l.trim().startsWith('{')).pop();
  payload = JSON.parse(line);
} catch (e) {
  process.stderr.write(`ответ канала не разобран: ${e.message}\n`);
  process.exit(1);
}

const raw = String(payload.result ?? '');
const html = raw
  .replace(/^\s*```(?:html)?\s*/i, '')
  .replace(/```\s*$/, '')
  .trim();

if (!/^<!DOCTYPE html/i.test(html)) {
  process.stderr.write(`ответ не похож на HTML-файл: начало «${html.slice(0, 80)}»\n`);
  process.exit(1);
}

const outDir = path.join('artifacts', 'core-probe', SLUG);
mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `${caseId(input)}.html`);
writeFileSync(file, `${html}\n`, 'utf8');

process.stdout.write(`${file}\n\n${html}\n`);
process.stdout.write(`${JSON.stringify({ usd: payload.total_cost_usd ?? null })}\n`);
