#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.BFL_BASE_URL?.trim() || 'https://api.bfl.ai';

const MODELS = {
  'klein-4b': { endpoint: '/v1/flux-2-klein-4b', about: 'самый дешёвый и быстрый, для проб' },
  'klein-9b': { endpoint: '/v1/flux-2-klein-9b', about: 'дешёвый, качество выше 4b' },
  pro: { endpoint: '/v1/flux-2-pro', about: 'рабочий по умолчанию' },
  flex: { endpoint: '/v1/flux-2-flex', about: 'когда в кадре нужен читаемый текст' },
  max: { endpoint: '/v1/flux-2-max', about: 'максимальное качество, самый дорогой' },
};

const FORMATS = ['jpeg', 'png', 'webp'];
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const GUARD = 'no text, no signage, no logos, no watermarks, no faces';
const POLL_MS = 1500;
const DEADLINE_MS = 5 * 60 * 1000;
const MAX_REFS = 8;
const MAX_REF_MB = 20;

const USAGE = `node tools/bfl-image.mjs "<промпт>" [опции]
node tools/bfl-image.mjs --balance

  Картинка через FLUX (Black Forest Labs): генерация с нуля и правка готового кадра словами.

  --model <${Object.keys(MODELS).join('|')}>   по умолчанию pro
  --size <ШхВ>        например 1024x1024 (по умолчанию) или 1440x2048 под 9:16
  --format <${FORMATS.join('|')}>   по умолчанию jpeg
  --ref <файл|адрес>  исходный кадр для правки словами; до ${MAX_REFS} штук, флаг повторяется
  --count <N>         сколько вариантов подряд, по умолчанию 1
  --seed <N>          повторяемый результат
  --out <папка>       по умолчанию artifacts/bfl/<слаг промпта>
  --allow-text        снять запрет на текст, вывески, логотипы и лица в кадре
  --balance           сколько кредитов на счету; вызов бесплатный, проверяет ключ

  Кадр для страницы клиента родовой: вывеска, лицо, логотип, номер машины в кадре
  есть выдуманный факт о бизнесе и блокер на ревью (§12 CLAUDE.md). Запрет снимается
  только флагом --allow-text и только под собственные съёмки клиента.

  Каждый прогон списывает деньги со счёта BFL; цена ответа печатается перед ожиданием.
  Ключ — в ENV: BFL_API_KEY (dashboard.bfl.ai → Keys)`;

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  process.stdout.write(`${USAGE}\n`);
  process.exit(argv.length ? 0 : 1);
}

const WITH_VALUE = new Set(['model', 'size', 'format', 'ref', 'count', 'seed', 'out']);
const options = new Map();
const refs = [];
const words = [];

for (let i = 0; i < argv.length; i += 1) {
  const token = argv[i];
  if (!token.startsWith('--')) {
    words.push(token);
    continue;
  }
  const name = token.slice(2);
  if (WITH_VALUE.has(name)) {
    if (argv[i + 1] === undefined) {
      process.stderr.write(`у --${name} не задано значение\n`);
      process.exit(1);
    }
    if (name === 'ref') refs.push(argv[i + 1]);
    else options.set(name, argv[i + 1]);
    i += 1;
  } else {
    options.set(name, true);
  }
}

const option = (name, fallback) => options.get(name) ?? fallback;

const key = process.env.BFL_API_KEY?.trim();
if (!key) {
  process.stderr.write(
    'нет BFL_API_KEY — ключ берётся на dashboard.bfl.ai в разделе Keys и кладётся строкой в .env.\n' +
      'Без ключа генерировать нечем: кадр считается на стороне провайдера и это стоит денег.\n',
  );
  process.exit(1);
}

async function call(method, url, body) {
  const res = await fetch(url.startsWith('http') ? url : `${BASE}${url}`, {
    method,
    headers: {
      'x-key': key,
      accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`BFL ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

if (options.get('balance') === true) {
  try {
    const credits = await call('GET', '/v1/credits');
    const amount = credits.credits ?? credits.balance ?? null;
    process.stderr.write(`[bfl] ключ рабочий, кредитов: ${amount ?? '—'}\n`);
    process.stdout.write(`${JSON.stringify({ credits: amount, dollars: amount === null ? null : Number((amount * 0.01).toFixed(2)) }, null, 2)}\n`);
  } catch (e) {
    process.stderr.write(`[bfl] ${e.message}\n`);
    process.exit(1);
  }
  process.exit(0);
}

const modelName = String(option('model', 'pro'));
const model = MODELS[modelName];
if (!model) {
  process.stderr.write(`--model принимает ${Object.keys(MODELS).join(', ')}; получено «${modelName}»\n`);
  process.exit(1);
}

const format = String(option('format', 'jpeg'));
if (!FORMATS.includes(format)) {
  process.stderr.write(`--format принимает ${FORMATS.join(', ')}; получено «${format}»\n`);
  process.exit(1);
}

const size = String(option('size', '1024x1024'));
const sizeMatch = /^(\d{2,5})x(\d{2,5})$/i.exec(size);
if (!sizeMatch) {
  process.stderr.write(`--size задаётся как ШИРИНАxВЫСОТА, например 1440x2048; получено «${size}»\n`);
  process.exit(1);
}
const width = Number(sizeMatch[1]);
const height = Number(sizeMatch[2]);
if (width < 64 || height < 64) {
  process.stderr.write('стороны кадра меньше 64 точек не принимаются\n');
  process.exit(1);
}

const count = Number(option('count', '1'));
if (!Number.isInteger(count) || count < 1 || count > 10) {
  process.stderr.write(`--count принимает целое от 1 до 10; получено «${option('count', '')}»\n`);
  process.exit(1);
}

if (refs.length > MAX_REFS) {
  process.stderr.write(`исходных кадров максимум ${MAX_REFS}, передано ${refs.length}\n`);
  process.exit(1);
}

const promptWords = words.join(' ').trim();
if (!promptWords) {
  process.stderr.write(`промпт не задан\n\n${USAGE}\n`);
  process.exit(1);
}

const allowText = options.get('allow-text') === true;
const prompt = allowText ? promptWords : `${promptWords}. ${GUARD}`;

function reference(source) {
  if (/^https?:\/\//i.test(source)) return source;
  if (!existsSync(source)) throw new Error(`нет файла ${source}`);
  const ext = path.extname(source).toLowerCase();
  const mime = MIME[ext];
  if (!mime) throw new Error(`формат «${ext || 'без расширения'}» не годится: нужен jpg, png или webp`);
  const bytes = readFileSync(source);
  const mb = bytes.length / 1024 / 1024;
  if (mb > MAX_REF_MB) throw new Error(`${source} весит ${mb.toFixed(1)} МБ — сожми до ${MAX_REF_MB} МБ`);
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

let inputs;
try {
  inputs = refs.map(reference);
} catch (e) {
  process.stderr.write(`${e.message}\n`);
  process.exit(1);
}

const slug =
  promptWords
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'kadr';
const outDir = String(option('out', path.join('artifacts', 'bfl', slug)));
const seed = options.has('seed') ? Number(option('seed')) : null;

process.stderr.write(`[bfl] ${modelName} · ${width}x${height} · ${format} · вариантов ${count}`);
process.stderr.write(refs.length ? ` · правка ${refs.length} кадр(ов)\n` : '\n');
if (!allowText) process.stderr.write('[bfl] запрет на текст, вывески, логотипы и лица в кадре включён\n');

mkdirSync(outDir, { recursive: true });

const made = [];
let spent = 0;

for (let n = 1; n <= count; n += 1) {
  const body = {
    prompt,
    width,
    height,
    output_format: format,
    ...(seed === null ? {} : { seed: seed + n - 1 }),
  };
  inputs.forEach((image, index) => {
    body[index === 0 ? 'input_image' : `input_image_${index + 1}`] = image;
  });

  let task;
  try {
    task = await call('POST', model.endpoint, body);
  } catch (e) {
    process.stderr.write(`[bfl] провайдер отказал: ${e.message}\n`);
    process.exit(made.length ? 0 : 1);
  }

  const cost = Number(task.cost ?? 0);
  spent += cost;
  process.stderr.write(`[bfl] задание ${task.id} · цена ${cost ? `${cost} кредитов ($${(cost * 0.01).toFixed(3)})` : '—'}\n`);

  let state = task;
  const deadline = Date.now() + DEADLINE_MS;
  while (!['Ready', 'Error', 'Failed', 'Content Moderated', 'Request Moderated'].includes(state.status)) {
    if (Date.now() > deadline) {
      process.stderr.write(`[bfl] пять минут в состоянии ${state.status}; задание ${task.id} брошено\n`);
      process.exit(1);
    }
    await new Promise((done) => setTimeout(done, POLL_MS));
    state = await call('GET', task.polling_url ?? `/v1/get_result?id=${task.id}`);
  }

  if (state.status !== 'Ready') {
    process.stderr.write(`[bfl] не собралось: ${state.status} ${JSON.stringify(state.details ?? {})}\n`);
    process.exit(made.length ? 0 : 1);
  }

  const link = state.result?.sample;
  if (!link) {
    process.stderr.write('[bfl] задание готово, но ссылки на кадр в ответе нет\n');
    process.exit(1);
  }

  const file = await fetch(link);
  if (!file.ok) {
    process.stderr.write(`[bfl] кадр не скачался: ${file.status}\n`);
    process.exit(1);
  }

  const target = path.join(outDir, count > 1 ? `${slug}-${n}.${format}` : `${slug}.${format}`);
  writeFileSync(target, Buffer.from(await file.arrayBuffer()));
  const mb = statSync(target).size / 1024 / 1024;
  process.stderr.write(`[bfl] готово: ${target} · ${mb.toFixed(2)} МБ\n`);
  made.push({ file: target, megabytes: Number(mb.toFixed(2)), task: task.id });
}

process.stdout.write(
  `${JSON.stringify(
    {
      model: modelName,
      size: `${width}x${height}`,
      prompt,
      images: made,
      credits: Number(spent.toFixed(3)),
      dollars: Number((spent * 0.01).toFixed(3)),
    },
    null,
    2,
  )}\n`,
);
