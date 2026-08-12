#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DIRECTIONS, pickDirection } from './design-directions.mjs';
import { motionBlock, pickPreset, resolveTechniques } from './motion-directions.mjs';

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
const forced = process.env.DIRECTION
  ? DIRECTIONS.find((d) => d.key === process.env.DIRECTION.trim().toLowerCase())
  : null;
const fallbackDirection = forced ?? pickDirection(input, id);
const useReferences = process.env.SKIP_REFERENCES !== '1';

let dir = fallbackDirection;
let referenceNote = 'референсы не запрашивались, дирекшен из встроенного списка';

if (useReferences) {
  try {
    const { resolveNicheDirection } = await import('./niche-reference.mjs');
    const live = await resolveNicheDirection(input, { log: (m) => process.stderr.write(`[референсы] ${m}\n`) });
    dir = forced
      ? { ...fallbackDirection, slots: live.slots ?? [] }
      : {
          ...fallbackDirection,
          name: live.name,
          fonts: live.fonts,
          palette: live.palette,
          layout: live.layout,
          detail: live.detail,
          slots: live.slots ?? [],
        };
    referenceNote = forced
      ? `направление ${forced.key} выбрано владельцем и не перебивается; от референсов взяты только сюжеты кадров (${(live.slots ?? []).length})`
      : `дирекшен собран по живым референсам: ${live.sources.map((s) => s.name).join(', ')}`;
  } catch (e) {
    process.stderr.write(`[референсы] не получилось (${e.message}); беру встроенный дирекшен ${fallbackDirection.key}\n`);
  }
}

process.stderr.write(`[дирекшен] ${referenceNote}\n`);

const NO_PHOTOS = '- Никаких картинок по ссылке и иконочных библиотек: графика — CSS и инлайновый SVG.';

let photoBlock = NO_PHOTOS;

if (process.env.SKIP_PHOTOS !== '1') {
  try {
    const { collectPhotos, formatPhotos } = await import('./stock-photos.mjs');
    const photos = await collectPhotos(input, { log: (m) => process.stderr.write(`[фото] ${m}\n`) });
    if (photos.length >= 4) {
      photoBlock = `ФОТОГРАФИИ (настоящие снимки, лицензия CC0 — брать разрешено):
${formatPhotos(photos)}

Как с ними обращаться:
- Ставь <img> ТОЛЬКО с этими адресами, дословно. Другие ссылки, заглушки и генераторы
  картинок запрещены.
- РИСОВАННЫХ ОБЪЕКТОВ НА СТРАНИЦЕ НЕТ. Раз есть настоящие снимки, ни один предмет не
  изображается путями SVG: ни банка, ни чашка, ни животное, ни струя, ни капля, ни пчела,
  ни абстрактное пятно вместо предмета. Нарисованное рядом с фотографией читается как
  сломанная вёрстка — это уже проверено на живой странице и признано браком.
  SVG остаётся только для интерфейса: стрелка, галочка, крестик, иконка внутри кнопки,
  волнистый разделитель секций. Всё, что изображает предмет или существо, — фотография.
- Движение делается САМИМ снимкам: медленное приближение 8–12с до масштаба 1.06, параллакс
  относительно фона, раскрытие маской clip-path по скроллу, перетекание двух разных кадров
  одного продукта, углубление тени при приближении. Искусственных струй и брызг поверх
  снимка не рисуй: чего нет в кадре, того нет на странице.
- Снимок, который не подходит бизнесу по смыслу, просто не бери: лучше меньше кадров.
- У каждого <img> обязательны loading="lazy", decoding="async", width и height числами
  (пропорции 3:2 или 4:3, реальный размер не важен) и осмысленный alt: что в кадре и как
  это связано с делом, без набивки ключевыми словами.
- Кадры — фон первого экрана, полосы между секциями, карточки услуг, лента галереи.
  Первый экран строится вокруг снимка: текст поверх затемнения или рядом в колонке.
- Затемнение под текстом обязательно, если текст лежит на снимке: контраст не ниже 4.5:1,
  иначе заголовок не читается.
- ПОДПИСИ НЕЙТРАЛЬНЫЕ. Нельзя писать «наш цех», «наша пасека», «наши работы», «фото
  клиента» — это чужие снимки, и выдавать их за съёмку этого бизнеса запрещено. Пиши по
  сути кадра: «мёд в сотах», «рабочее место мастера».
- В панели «SEO и GEO», в списке «допиши сам», ПЕРВОЙ строкой: «Замени фотографии на свои —
  сейчас на странице стоят бесплатные снимки из общего доступа; свои кадры дают доверие
  и попадают в поиск по картинкам».`;
      process.stderr.write(`[фото] в промпт ушло снимков: ${photos.length}\n`);
    } else {
      process.stderr.write(`[фото] найдено ${photos.length} — мало, страница пойдёт без снимков\n`);
    }
  } catch (e) {
    process.stderr.write(`[фото] не получилось (${e.message}); страница пойдёт без снимков\n`);
  }
}

let systemBlock = '';

if (process.env.SKIP_DESIGN_SYSTEM !== '1') {
  const key = process.env.DESIGN_SYSTEM?.trim() || 'polaris';
  try {
    const { resolveKit, kitBlock } = await import('./design-systems.mjs');
    const kit = await resolveKit(key, { log: (m) => process.stderr.write(`[дизайн-система] ${m}\n`) });
    systemBlock = `\n${kitBlock(kit)}\n`;
    process.stderr.write(`[дизайн-система] лестницы из «${kit.name}», срез ${kit.takenAt}\n`);
  } catch (e) {
    process.stderr.write(`[дизайн-система] ${key} не снялась (${e.message}); страница пойдёт без лестниц\n`);
  }
}

const list = (value) => String(value ?? '').split(/[,\s]+/).filter(Boolean);
const preset = pickPreset(process.env.MOTION);
const motionOptions = { add: list(process.env.MOTION_ADD), drop: list(process.env.MOTION_DROP) };
const motion = motionBlock(preset, motionOptions);
const chosenNames = resolveTechniques(preset, motionOptions).map((t) => t.name);

process.stderr.write(
  `[движение] пресет ${preset.key} — ${preset.name}; приёмов ${chosenNames.length}: ${chosenNames.join(', ') || 'нет'}\n`,
);

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

const { pickRoute, structureBlock, routeBlock } = await import('./site-routes.mjs');
const picked = pickRoute(input);
process.stderr.write(`[маршрут] ${picked.route.name} (${picked.key}) — ${picked.why}\n`);

const structure = dir.structure ?? structureBlock(picked.route) ?? DEFAULT_STRUCTURE;
const routeNote = `\n${routeBlock(picked)}\n`;

const PROMPT = `Ты — генератор сайтов внутри сервиса. На вход приходит описание бизнеса,
которое владелец написал своими словами. Выдай готовую одностраничную посадочную
страницу на русском языке: уровня галерей Awwwards и Cosmos по типографике и цвету,
уровня Mobbin по структуре, и собранную сразу правильно под поиск и под ответы нейросетей.

ОПИСАНИЕ БИЗНЕСА:
${input}

${routeNote}
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
${systemBlock}
ЖЁСТКИЕ ЗАПРЕТЫ (нарушение любого = брак):
- Не выдумывай факты, которых нет в описании: цены, сроки работы на рынке, количество
  клиентов, награды, имена сотрудников, отзывы, номера домов, телефоны, часы работы.
- Не пиши воду: «команда профессионалов», «индивидуальный подход», «широкий спектр
  услуг», «качество на высоте» — запрещённые обороты.
- Не теряй и не подменяй город из описания.
- Текст первого экрана НИКОГДА не режется контейнером. Запрещено класть заголовок в
  коробку с заданной высотой (\`height\`) и \`overflow:hidden\`, и запрещено прижимать его
  \`position:absolute; bottom:0\` — длина заголовка зависит от описания бизнеса, и длинный
  заголовок в такой коробке обрезается сверху. Разрешено: текст в обычном потоке,
  у контейнера \`min-height\`, картинка первого экрана — фоном или соседней ячейкой сетки.
  Перед выдачей посчитай: заголовок длиннее шести слов при кегле больше 80px не помещается
  в один экран — уменьшай кегль, а не обрезай.
- Меню и подписи к фотографиям видны без скриптов. Мобильное меню, спрятанное через
  \`opacity:0\` или \`pointer-events:none\` и открываемое только скриптом, — брак: без JS
  разделы недостижимы. Делай прокручиваемую строку ссылок или обычный список.
- Весь текст лежит в HTML и виден без единого выполненного скрипта. Контент не
  подставляется и не раскрывается скриптом: поисковые роботы и краулеры нейросетей
  читают только разметку. Аккордеон FAQ — на <details>/<summary>.
- Шрифты Inter, Roboto, Arial, Space Grotesk и системные — запрещены.
- Фиолетовый градиент на белом и прочая безликая «нейросетевая» эстетика — запрещены.
${photoBlock}

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

ЦИТИРУЕМОСТЬ (числа замерены, это не вкусовщина):
- 44% цитат берутся из первой трети страницы, поэтому первый экран несёт фактический ответ
  в первых 40–60 словах: что за дело, для кого, в каком городе. Слоган без фактов там —
  потерянное место.
- Заголовки секций и вопросы FAQ формулируются так, как человек спрашивает вслух.
- Абзац — 2–4 предложения. Абзац на семь предложений не цитируется целиком и не читается.
- Объёма ради объёма не набирай. Блок ровно такой длины, какая набирается из сказанного
  владельцем: дописать нечем — блок короткий, и это правильный результат, а не недоделка.

${motion}

ГЛУБИНА (страница не должна читаться плоской):
Заведи в :root три переменные тени и пользуйся только ими, не сочиняя тень на месте:
  --shadow-sm: 0 1px 2px rgba(R,G,B,.05), 0 3px 8px rgba(R,G,B,.05);
  --shadow-md: 0 2px 4px rgba(R,G,B,.04), 0 8px 20px rgba(R,G,B,.09), 0 18px 44px rgba(R,G,B,.07);
  --shadow-lg: 0 4px 8px rgba(R,G,B,.05), 0 18px 38px rgba(R,G,B,.14), 0 36px 80px rgba(R,G,B,.12);
где R,G,B — самый тёмный цвет палитры, а не чёрный: тень в цвет палитры выглядит как свет,
а серо-чёрная — как грязь. Слоёв всегда несколько: одна тень с большим размытием читается
пятном. Ставь тень тому, что по смыслу приподнято над страницей: карточки и слоты под
снимки, липкая шапка, всплывающие элементы; на hover тень углубляется вместе со сдвигом.
Не вешай тень на текст, разделители, поля ввода и на всё подряд. Исключение — дирекшены,
где плоскость заявлена приёмом (Swiss, Neo-Brutalist): там глубину даёт жёсткая офсет-тень
без размытия или её отсутствие, и этот запрет сильнее общего правила.

Пустых контейнеров в разметке быть не должно: если номер, иконку или маркер рисует
псевдоэлемент ::before, то он и есть первая ячейка сетки — отдельный пустой <div></div>
под него не нужен и ломает раскладку, сдвигая содержимое в соседнюю колонку.

Обратная ошибка ломает раскладку так же: если ::before занял первую ячейку сетки в две
колонки, то во второй колонке обязан лежать РОВНО ОДИН элемент. Заголовок и абзац рядом
дают три ячейки на две колонки, и абзац уезжает во вторую строку первой колонки — в узкую
полосу под номером, где встаёт по одному слову в строку. Правильно — обернуть содержимое
в один <div>, либо задать ему grid-column: 2. Посчитай ячейки в каждой сетке перед выдачей:
элементов ровно столько, сколько колонок, или они явно расставлены.

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

const generated = raw.slice(start, end + '</html>'.length).trim();

const PANEL = /[ \t]*<section id="seo-geo"[\s\S]*?<\/section>\s*/i;
const panel = generated.match(PANEL);
const html = panel ? generated.replace(PANEL, '\n') : generated;

const outDir = path.join('artifacts', 'core-probe', SLUG);
mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `${id}.html`);
writeFileSync(file, `${html}\n`, 'utf8');

if (panel) {
  const reportFile = path.join(outDir, `${id}-otchet.html`);
  writeFileSync(
    reportFile,
    `<!DOCTYPE html>\n<html lang="ru">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="robots" content="noindex">\n<title>Что сделано на странице и что дописать</title>\n<style>body{font:16px/1.6 system-ui,sans-serif;max-width:52rem;margin:3rem auto;padding:0 1.25rem;color:#1B1917;}h2,h3{line-height:1.25;}ul{padding-left:1.2em;}li{margin-bottom:.5em;}</style>\n</head>\n<body>\n${panel[0].trim()}\n</body>\n</html>\n`,
    'utf8',
  );
  process.stderr.write(`[отчёт] панель SEO и GEO вынесена из страницы: ${reportFile}\n`);
} else {
  process.stderr.write('[отчёт] панели SEO и GEO в выдаче нет\n');
}

const check = spawnSync(process.execPath, [path.join('tools', 'check-page.mjs'), file], { encoding: 'utf8' });
process.stderr.write(`[проверка]${check.status === 0 ? ' пройдена' : ''}\n${check.stdout ?? ''}`);

process.stdout.write(`${file}  [${dir.key}]\n\n${html}\n`);
process.stdout.write(`${JSON.stringify({ usd: payload.total_cost_usd ?? null })}\n`);
