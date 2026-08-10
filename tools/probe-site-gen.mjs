#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pickDirection } from './design-directions.mjs';

const SLUG = process.env.PROBE_SLUG ?? 'site-gen';
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

const id = caseId(input);
const fallbackDirection = pickDirection(input, id);
const useReferences = process.env.SKIP_REFERENCES !== '1';

let dir = fallbackDirection;
let referenceNote = 'референсы не запрашивались, дирекшен из встроенного списка';

if (useReferences) {
  try {
    const { resolveNicheDirection } = await import('./niche-reference.mjs');
    const live = await resolveNicheDirection(input, { log: (m) => process.stderr.write(`[референсы] ${m}\n`) });
    dir = {
      ...fallbackDirection,
      name: live.name,
      fonts: live.fonts,
      palette: live.palette,
      layout: live.layout,
      detail: live.detail,
      slots: live.slots ?? [],
    };
    referenceNote = `дирекшен собран по живым референсам: ${live.sources.map((s) => s.name).join(', ')}`;
  } catch (e) {
    process.stderr.write(`[референсы] не получилось (${e.message}); беру встроенный дирекшен ${fallbackDirection.key}\n`);
  }
}

process.stderr.write(`[дирекшен] ${referenceNote}\n`);

const DEFAULT_STRUCTURE = `1. Липкая шапка: название дела, якорные ссылки, кнопка действия справа.
2. Первый экран: H1 с сутью и городом, честная подводка из описания, основная кнопка и
   вторичная ссылка, под ними строка фактов из описания (что делаем · где · как связаться).
3. Услуги — карточки, выведенные только из описания.
4. Как это устроено — пронумерованные шаги, если порядок работы следует из описания.
5. Вопросы и ответы, 4–6 штук, на <details>/<summary>: реальные вопросы клиента такого
   бизнеса, ответы короткие и фактические, каждый пригоден к цитированию отдельно от
   страницы — это корм для ответов нейросетей.
6. Контакты: город и район текстом, кнопка действия, зона обслуживания.
7. Подвал.
8. В самом низу отдельным блоком <section id="seo-geo"> — панель «SEO и GEO»: два списка,
   «сделано за тебя» и «допиши сам», человеческим языком, без терминов, каждый пункт одной
   строкой с объяснением зачем. Панель визуально отделена от сайта рамкой и другим фоном.`;

const structure = dir.structure ?? DEFAULT_STRUCTURE;

const PROMPT = `Ты — генератор сайтов внутри сервиса. На вход приходит описание бизнеса,
которое владелец написал своими словами. Выдай готовую одностраничную посадочную
страницу на русском языке: уровня галерей Awwwards и Cosmos по типографике и цвету,
уровня Mobbin по структуре, и собранную сразу правильно под поиск и под ответы нейросетей.

ОПИСАНИЕ БИЗНЕСА:
${input}

АРТ-ДИРЕКШЕН (задан заранее, следуй ему буквально, не смешивай с другими):
Направление: ${dir.name}
Шрифты: ${dir.fonts} — подключить с Google Fonts, только нужные начертания
Палитра: ${dir.palette}
Композиция: ${dir.layout}
Детали: ${dir.detail}${
  dir.slots?.length
    ? `
Сюжеты слотов галереи (что в этой нише реально снимают, по частоте): ${dir.slots.join(' · ')}.
Подписи слотов пиши своими словами по этим сюжетам. Ни одного имени, бренда или места из
референсов на странице быть не должно — берётся только тип кадра.`
    : ''
}

ЖЁСТКИЕ ЗАПРЕТЫ (нарушение любого = брак):
- Не выдумывай факты, которых нет в описании: цены, сроки работы на рынке, количество
  клиентов, награды, имена сотрудников, отзывы, номера домов, телефоны, часы работы.
- Не пиши воду: «команда профессионалов», «индивидуальный подход», «широкий спектр
  услуг», «качество на высоте» — запрещённые обороты.
- Не теряй и не подменяй город из описания.
- Весь текст лежит в HTML и виден без единого выполненного скрипта. Контент не
  подставляется и не раскрывается скриптом: поисковые роботы и краулеры нейросетей
  читают только разметку. Аккордеон FAQ — на <details>/<summary>.
- Шрифты Inter, Roboto, Arial, Space Grotesk и системные — запрещены.
- Фиолетовый градиент на белом и прочая безликая «нейросетевая» эстетика — запрещены.
- Никаких картинок по ссылке и иконочных библиотек: графика — CSS и инлайновый SVG.

ЧТО ДЕЛАТЬ С НЕДОСТАЮЩИМИ ДАННЫМИ:
Телефон, точный адрес, часы, цены — заметный плейсхолдер-чип <span class="fill">телефон</span>,
оформленный в стиле арт-дирекшена. Плейсхолдер — только для данных, не для текста:
все смысловые тексты финальные.

СТРУКТУРА СТРАНИЦЫ (паттерны реальных продуктовых лендингов):
${structure}

Вопросы и ответы — на <details>/<summary>, ответы короткие и фактические, каждый пригоден
к цитированию отдельно от страницы. Панель «SEO и GEO» — отдельным <section id="seo-geo">
в самом низу: два списка, «сделано за тебя» и «допиши сам», человеческим языком, без
терминов, визуально отделена рамкой и другим фоном.

АНИМАЦИЯ (обязательна, делает страницу живой):
- Появление первого экрана: срежиссированный вход со ступенчатыми задержками
  (animation-delay 60–90ms между элементами) — заголовок, подводка, кнопка, строка фактов.
- Появление секций при скролле — на CSS scroll-driven animations:
  animation-timeline: view(); animation-range: entry 0% cover 35%.
- Микровзаимодействия в духе арт-дирекшена: кнопки, карточки, ссылки — трансформации и
  цвет на hover и focus-visible, длительность 150–400ms, кривая cubic-bezier.
- Один запоминающийся приём на страницу под арт-дирекшен: бегущая строка на CSS,
  параллакс через transform, «печатающийся» акцент, дышащая фоновая форма.
- Никаких библиотек анимации.

ПРАВИЛО, КОТОРОЕ НЕЛЬЗЯ НАРУШИТЬ (иначе половина сайта окажется невидимой):
Любое скрытие ради анимации разрешено ТОЛЬКО под классом .js на <html>, который ставит
инлайновый скрипт первой строкой в <head>:
  <script>document.documentElement.classList.add('js')</script>
и в CSS:
  .js .reveal { opacity: 0; animation: reveal 700ms both; animation-timeline: view();
                animation-range: entry 0% cover 30%; }
Базовое правило .reveal — БЕЗ opacity:0 и без скрывающих transform: элемент виден всегда.
Тогда там, где скрипт не выполнился и где страница не прокручивается — краулер нейросети,
режим чтения, печать, скриншот целой страницы — весь текст на месте.

Дополнительно обязательно:
  @media (prefers-reduced-motion: reduce) { .js .reveal { opacity: 1; animation: none; } }
  @media print { .js .reveal { opacity: 1; animation: none; } }

Пустых контейнеров в разметке быть не должно: если номер, иконку или маркер рисует
псевдоэлемент ::before, то он и есть первая ячейка сетки — отдельный пустой <div></div>
под него не нужен и ломает раскладку, сдвигая содержимое в соседнюю колонку.

Самопроверка перед выдачей: мысленно удали из документа все <script> и убедись, что
каждая секция — услуги, шаги, вопросы, контакты — остаётся видимой. Если хоть один блок
пропал, правило нарушено, переделай.

ТЕХНИЧЕСКАЯ ЧАСТЬ:
- <title> до 60 знаков с городом, <meta name="description"> до 155 знаков.
- <html lang="ru">, viewport, <link rel="canonical" href="https://example.com/">.
- Open Graph: og:title, og:description, og:type, og:locale.
- JSON-LD: подходящий тип LocalBusiness (NailSalon, Dentist, VeterinaryCare,
  ProfessionalService и т.п.) с name, description, areaServed с городом, address с
  addressLocality; отдельным блоком FAQPage с теми же вопросами и ответами.
- Один H1, осмысленные H2, семантические теги, внятные alt у SVG через <title>.
- Весь CSS в <style>, переменные в :root, адаптив от 360px, контраст текста не ниже 4.5:1.
- Фокус видимый, кнопки — настоящие <a>/<button>.

ФОРМАТ ОТВЕТА: только исходный код HTML-файла, начиная с <!DOCTYPE html>. Без пояснений,
без markdown-ограждений, без единого слова до или после кода.`;

const scratch = mkdtempSync(path.join(tmpdir(), 'probe-site-gen-'));
const cli = process.env.CLAUDE_CODE_EXECPATH;
if (!cli) {
  process.stderr.write('нет CLAUDE_CODE_EXECPATH — прогонный канал недоступен\n');
  process.exit(1);
}

const r = spawnSync(
  cli,
  ['-p', PROMPT, '--model', MODEL, '--output-format', 'json', '--allowed-tools', '', '--strict-mcp-config'],
  { cwd: scratch, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 900000 },
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
const start = raw.search(/<!DOCTYPE html/i);
const end = raw.toLowerCase().lastIndexOf('</html>');

if (start < 0 || end < 0) {
  process.stderr.write(`в ответе нет HTML-документа: начало «${raw.slice(0, 80)}»\n`);
  process.exit(1);
}

const html = raw.slice(start, end + '</html>'.length).trim();

const outDir = path.join('artifacts', 'core-probe', SLUG);
mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `${id}.html`);
writeFileSync(file, `${html}\n`, 'utf8');

process.stdout.write(`${file}  [${dir.key}]\n\n${html}\n`);
process.stdout.write(`${JSON.stringify({ usd: payload.total_cost_usd ?? null })}\n`);
