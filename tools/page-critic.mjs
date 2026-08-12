#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MODEL = process.env.CRITIC_MODEL ?? 'claude-sonnet-5';
const THRESHOLD = Number(process.env.CRITIC_THRESHOLD ?? 4.0);
const TRIES = Number(process.env.CRITIC_TRIES ?? 3);
const MAX_HEIGHT = Number(process.env.CRITIC_MAX_HEIGHT ?? 6000);
const WIDTHS = [390, 1440];

const RUBRIC = `Оценивай по шести осям, каждая от 0 до 5, затем выведи общий балл — среднее
арифметическое, округлённое до одного знака.

ЧАСТЬ ПЕРВАЯ — общая (взята из опубликованных рубрик WebGen-Bench и WebDev Arena):
1. Читаемость: контраст текста к фону, размер шрифта на телефоне, длина строки,
   не наезжают ли элементы друг на друга.
2. Корректность раскладки: ничего не выходит за экран, нет горизонтальной прокрутки,
   сетки не рассыпаны, изображения не растянуты и не обрезаны по важному.
3. Внешний вид: единый ритм отступов, осмысленная иерархия размеров, страница выглядит
   сделанной human-дизайнером, а не собранной из блоков по умолчанию.

ЧАСТЬ ВТОРАЯ — наши инварианты, которых нет ни в одной чужой рубрике:
4. Город на месте: город бизнеса присутствует в первом экране и в контактах, не потерян
   и не подменён другим.
5. Плейсхолдеры видны: там, где данных не было, стоит явная заглушка, а не правдоподобная
   выдумка. Заглушка, выданная за факт, — ноль по этой оси.
6. Ни одного выдуманного факта: цены, стаж, число клиентов, награды, имена, отзывы,
   адреса, телефоны, часы работы, гарантии. Любое такое утверждение на странице — ноль
   по этой оси, вне зависимости от того, как хорошо оно написано.`;

const FORMAT = `ФОРМАТ ОТВЕТА: только JSON, без пояснений и без markdown-ограждений.
{"score": 0.0, "axes": {"readability":0,"layout":0,"look":0,"city":0,"placeholders":0,"facts":0},
 "defects": [{"where":"где именно на странице","what":"что не так","severity":"blocker|major|minor"}]}
Поле defects пустое, если дефектов нет. Пиши по-русски.`;

export async function shoot(htmlPath, { widths = WIDTHS, outDir } = {}) {
  const { chromium } = await import('playwright');
  const dir = outDir ?? path.join('artifacts', 'critic', path.basename(htmlPath, '.html'));
  mkdirSync(dir, { recursive: true });

  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const shots = [];

  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      await page.goto(pathToFileURL(path.resolve(htmlPath)).href, { waitUntil: 'load' });
      await page.waitForTimeout(600);

      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      const file = path.join(dir, `${width}.png`);
      await page.screenshot({
        path: file,
        clip: { x: 0, y: 0, width, height: Math.min(height, MAX_HEIGHT) },
      });

      shots.push({ width, file, height, clipped: height > MAX_HEIGHT });
      await context.close();
    }
  } finally {
    await browser.close();
  }

  return shots;
}

export async function critique(htmlPath, options = {}) {
  const log = options.log ?? (() => {});
  const shots = await shoot(htmlPath, options);
  for (const s of shots) {
    log(`снимок ${s.width}px → ${s.file}${s.clipped ? ` (обрезан с ${s.height}px)` : ''}`);
  }

  const cli = process.env.CLAUDE_CODE_EXECPATH;
  if (!cli) throw new Error('нет CLAUDE_CODE_EXECPATH — канал к модели недоступен');

  const list = shots.map((s) => `- ${path.resolve(s.file)} — ширина ${s.width}px`).join('\n');
  const prompt = `Ты — критик посадочных страниц. Тебе дали скриншоты одной страницы на двух
ширинах. Прочитай оба файла инструментом Read и оцени страницу.

СНИМКИ:
${list}

${RUBRIC}

${FORMAT}`;

  const r = spawnSync(
    cli,
    ['-p', prompt, '--model', MODEL, '--output-format', 'json', '--allowed-tools', 'Read', '--strict-mcp-config'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 900000 },
  );

  if (r.status !== 0 || r.error) {
    throw new Error(`канал не ответил: ${r.error ? r.error.message : `код ${r.status}`}`);
  }

  let payload;
  try {
    const line = r.stdout.trim().split('\n').filter((l) => l.trim().startsWith('{')).pop();
    payload = JSON.parse(line);
  } catch (e) {
    throw new Error(`ответ канала не разобран: ${e.message}`);
  }

  const raw = String(payload.result ?? '');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error(`в ответе нет JSON: «${raw.slice(0, 120)}»`);

  let verdict;
  try {
    verdict = JSON.parse(raw.slice(start, end + 1));
  } catch (e) {
    throw new Error(`вердикт не разобран: ${e.message}`);
  }

  return {
    score: Number(verdict.score),
    axes: verdict.axes ?? {},
    defects: Array.isArray(verdict.defects) ? verdict.defects : [],
    shots,
    usd: payload.total_cost_usd ?? null,
  };
}

export async function bestOfThree(generate, options = {}) {
  const threshold = options.threshold ?? THRESHOLD;
  const tries = options.tries ?? TRIES;
  const log = options.log ?? (() => {});
  const journal = [];
  let best = null;

  for (let attempt = 1; attempt <= tries; attempt += 1) {
    const htmlPath = await generate({ attempt, previous: best });
    const verdict = await critique(htmlPath, { ...options, log });
    journal.push({ attempt, htmlPath, score: verdict.score, defects: verdict.defects.length });
    log(`попытка ${attempt}: балл ${verdict.score}, дефектов ${verdict.defects.length}`);

    if (!best || verdict.score > best.verdict.score) best = { htmlPath, verdict };
    if (verdict.score >= threshold) break;
  }

  return { ...best, journal, reachedThreshold: best.verdict.score >= threshold };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]).endsWith('page-critic.mjs');

if (invokedDirectly) {
  const target = process.argv[2];
  if (!target) {
    process.stderr.write('использование: node tools/page-critic.mjs <файл.html>\n');
    process.exit(1);
  }
  if (!existsSync(target)) {
    process.stderr.write(`файл не найден: ${target}\n`);
    process.exit(1);
  }

  const verdict = await critique(target, { log: (m) => process.stderr.write(`[критик] ${m}\n`) });

  process.stdout.write(`\n=== ${target}\n`);
  process.stdout.write(`  балл: ${verdict.score} из 5${verdict.score >= THRESHOLD ? ' — выше порога' : ` — ниже порога ${THRESHOLD}`}\n`);
  for (const [axis, value] of Object.entries(verdict.axes)) {
    process.stdout.write(`  ${axis}: ${value}\n`);
  }
  for (const d of verdict.defects) {
    const mark = d.severity === 'blocker' ? '✗' : d.severity === 'major' ? '!' : '⚠';
    process.stdout.write(`  ${mark} ${d.where} — ${d.what}\n`);
  }
  if (verdict.usd !== null) process.stdout.write(`  цена разбора: ${verdict.usd} USD\n`);

  process.exit(verdict.score >= THRESHOLD ? 0 : 1);
}
