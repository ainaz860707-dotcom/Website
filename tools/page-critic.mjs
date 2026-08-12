#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MODEL = process.env.CRITIC_MODEL ?? 'claude-sonnet-5';
const THRESHOLD = Number(process.env.CRITIC_THRESHOLD ?? 4.0);
const TRIES = Number(process.env.CRITIC_TRIES ?? 3);
const MAX_SLICES = Number(process.env.CRITIC_MAX_SLICES ?? 9);
const WIDTHS = [390, 1440];

const RUBRIC = `Оценивай по семи осям, каждая от 0 до 5, затем выведи общий балл — среднее
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
   по этой оси, вне зависимости от того, как хорошо оно написано.
7. Своё, а не трафарет. Спрашивай по каждой секции: можно ли перенести её на сайт другого
   бизнеса, поменяв только слова? Если да, секция ничего не говорит об этом деле.
   Признаки трафарета, каждый снижает оценку: нумерация шагов «01 · 02 · 03» вместо названий
   действий; список характеристик, где под каждой строкой линейка; три одинаковые карточки
   в ряд; надзаголовок над каждой секцией подряд; подписи под фотографиями, построенные по
   одному шаблону; секции, идущие в порядке «услуги, шаги, вопросы, контакты» без причины
   именно для этого дела. Страница безупречная по первым шести осям и полностью типовая по
   этой — обычный случай, не бойся поставить низкую оценку рядом с высокими.
   В дефектах по этой оси пиши, ЧЕМ заменить, а не только что не так.`;

const FORMAT = `ФОРМАТ ОТВЕТА: только JSON, без пояснений и без markdown-ограждений.
{"score": 0.0, "axes": {"readability":0,"layout":0,"look":0,"city":0,"placeholders":0,"facts":0,"own":0},
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
      const viewport = { width, height: width < 700 ? 844 : 1000 };
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      const page = await context.newPage();
      await page.goto(pathToFileURL(path.resolve(htmlPath)).href, { waitUntil: 'load' });
      await page.waitForTimeout(700);

      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      const slices = Math.min(Math.ceil(height / viewport.height), MAX_SLICES);

      for (let i = 0; i < slices; i += 1) {
        await page.evaluate((top) => window.scrollTo(0, top), i * viewport.height);
        await page.waitForTimeout(350);
        const file = path.join(dir, `${width}-${String(i + 1).padStart(2, '0')}.png`);
        await page.screenshot({ path: file });
        shots.push({ width, file, slice: i + 1, of: slices });
      }

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
  for (const width of new Set(shots.map((s) => s.width))) {
    const own = shots.filter((s) => s.width === width);
    log(`${width}px: кадров ${own.length}, вся страница сверху донизу`);
  }

  const cli = process.env.CLAUDE_CODE_EXECPATH;
  if (!cli) throw new Error('нет CLAUDE_CODE_EXECPATH — канал к модели недоступен');

  const list = shots
    .map((s) => `- ${path.resolve(s.file)} — ширина ${s.width}px, экран ${s.slice} из ${s.of}`)
    .join('\n');
  const prompt = `Ты — критик посадочных страниц. Тебе дали скриншоты одной страницы на двух
ширинах, снятые экран за экраном сверху донизу. Прочитай инструментом Read ВСЕ файлы до
единого и оцени страницу целиком: оси «город» и «своё, а не трафарет» требуют нижних секций,
по одному первому экрану их ставить нельзя.

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
