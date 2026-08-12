#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.LUMA_BASE_URL?.trim() || 'https://agents.lumalabs.ai/v1';
const MODEL = process.env.MORPH_MODEL?.trim() || 'ray-3.2';
const FPS = 24;
const WAITING = ['queued', 'pending', 'processing', 'dreaming'];

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const USAGE = `node tools/photo-morph.mjs <фото1> <фото2> [опции]

  Собирает видеопереход между двумя снимками: нейросеть достраивает кадры между
  первым и вторым фото. На выходе mp4 для первого экрана и постер к нему.

  --out <папка>       куда положить, по умолчанию artifacts/video/<имя-первого-фото>
  --seconds <5|10>    длительность, по умолчанию 5
  --resolution <…>    720p или 1080p, по умолчанию 1080p
  --prompt "…"        чем заполнить переход, словами
  --url               считать аргументы адресами в сети, а не файлами на диске

  ОБА СНИМКА — СНИМКИ САМОГО КЛИЕНТА. Чужое фото под видом съёмки этого бизнеса
  есть выдуманный факт о бизнесе и брак (§12 CLAUDE.md).

  Вызов платный: каждый прогон списывает деньги со счёта Luma.
  Ключ — в ENV: LUMA_AGENTS_API_KEY`;

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  process.stdout.write(`${USAGE}\n`);
  process.exit(argv.length ? 0 : 1);
}

const WITH_VALUE = new Set(['out', 'seconds', 'resolution', 'prompt']);
const options = new Map();
const frames = [];

for (let i = 0; i < argv.length; i += 1) {
  const token = argv[i];
  if (!token.startsWith('--')) {
    frames.push(token);
    continue;
  }
  const name = token.slice(2);
  if (WITH_VALUE.has(name)) {
    if (argv[i + 1] === undefined) {
      process.stderr.write(`у --${name} не задано значение\n`);
      process.exit(1);
    }
    options.set(name, argv[i + 1]);
    i += 1;
  } else {
    options.set(name, true);
  }
}

const option = (name, fallback) => options.get(name) ?? fallback;
const asUrls = options.get('url') === true;

if (frames.length !== 2) {
  process.stderr.write(`нужно ровно два снимка, получено ${frames.length}\n\n${USAGE}\n`);
  process.exit(1);
}

const key = process.env.LUMA_AGENTS_API_KEY?.trim();
if (!key) {
  process.stderr.write(
    'нет LUMA_AGENTS_API_KEY — ключ берётся на lumalabs.ai в разделе API keys и кладётся в ENV.\n' +
      'Без ключа морф собрать нечем: кадры достраиваются на стороне провайдера и это стоит денег.\n',
  );
  process.exit(1);
}

const seconds = Number(option('seconds', '5'));
if (![5, 10].includes(seconds)) {
  process.stderr.write(`--seconds принимает 5 или 10, получено «${option('seconds', '')}»\n`);
  process.exit(1);
}

const resolution = option('resolution', '1080p');
if (!['720p', '1080p'].includes(resolution)) {
  process.stderr.write(`--resolution принимает 720p или 1080p, получено «${resolution}»\n`);
  process.exit(1);
}

const prompt = option(
  'prompt',
  'плавный переход между двумя кадрами одного места: камера медленно идёт вперёд, свет и время суток не меняются',
);

function keyframe(source) {
  if (asUrls) return { url: source };
  if (!existsSync(source)) throw new Error(`нет файла ${source}`);
  const ext = path.extname(source).toLowerCase();
  const mime = MIME[ext];
  if (!mime) throw new Error(`формат «${ext || 'без расширения'}» не годится: нужен jpg, png или webp`);
  const bytes = readFileSync(source);
  const mb = bytes.length / 1024 / 1024;
  if (mb > 20) throw new Error(`${source} весит ${mb.toFixed(1)} МБ — сожми до 20 МБ`);
  return { data: bytes.toString('base64'), media_type: mime };
}

async function call(method, endpoint, body) {
  const res = await fetch(`${BASE}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Luma ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

let keyframes;
try {
  keyframes = [keyframe(frames[0]), keyframe(frames[1])];
} catch (e) {
  process.stderr.write(`${e.message}\n`);
  process.exit(1);
}

const slug = path.basename(frames[0], path.extname(frames[0])).replace(/[^a-zA-Z0-9а-яё-]+/gi, '-') || 'hero';
const outDir = option('out', path.join('artifacts', 'video', slug));

process.stderr.write(`[морф] ${MODEL} · ${seconds}с · ${resolution} · ${frames[0]} → ${frames[1]}\n`);
process.stderr.write('[морф] вызов платный, генерация идёт минуты\n');

let generation;
try {
  generation = await call('POST', '/generations', {
    prompt,
    type: 'video',
    model: MODEL,
    video: {
      duration: `${seconds}s`,
      resolution,
      keyframes,
      keyframe_indexes: [0, seconds * FPS],
    },
  });
} catch (e) {
  process.stderr.write(`[морф] провайдер отказал: ${e.message}\n`);
  if (!asUrls) {
    process.stderr.write('[морф] если отказ из-за встроенных в запрос байтов — выложи снимки по адресам и повтори с --url\n');
  }
  process.exit(1);
}

process.stderr.write(`[морф] задание ${generation.id}\n`);

const deadline = Date.now() + 15 * 60 * 1000;
while (WAITING.includes(generation.state)) {
  if (Date.now() > deadline) {
    process.stderr.write(`[морф] пятнадцать минут в состоянии ${generation.state}; задание ${generation.id} брошено\n`);
    process.exit(1);
  }
  await new Promise((done) => setTimeout(done, 6000));
  generation = await call('GET', `/generations/${generation.id}`);
  process.stderr.write(`[морф] ${generation.state}\n`);
}

if (generation.state !== 'completed') {
  process.stderr.write(`[морф] не собралось: ${generation.state} ${generation.failure_reason ?? ''}\n`);
  process.exit(1);
}

const link = (generation.output ?? []).map((o) => o.url).find(Boolean);
if (!link) {
  process.stderr.write('[морф] задание завершено, но ссылки на видео в ответе нет\n');
  process.exit(1);
}

const file = await fetch(link);
if (!file.ok) {
  process.stderr.write(`[морф] видео не скачалось: ${file.status}\n`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const videoFile = path.join(outDir, 'hero.mp4');
writeFileSync(videoFile, Buffer.from(await file.arrayBuffer()));

let posterFile = '';
if (!asUrls) {
  posterFile = path.join(outDir, `hero-poster${path.extname(frames[0]).toLowerCase()}`);
  copyFileSync(frames[0], posterFile);
}

const mb = statSync(videoFile).size / 1024 / 1024;
process.stderr.write(`[морф] готово: ${videoFile} · ${mb.toFixed(1)} МБ\n`);
if (mb > 4) {
  process.stderr.write(`[морф] ${mb.toFixed(1)} МБ на первый экран — много; возьми --resolution 720p или --seconds 5\n`);
}

process.stdout.write(
  `${JSON.stringify(
    {
      video: videoFile,
      poster: posterFile || null,
      megabytes: Number(mb.toFixed(2)),
      generation: generation.id,
      next: 'HERO_VIDEO=<адрес hero.mp4 на сайте> HERO_VIDEO_POSTER=<адрес постера> node tools/probe-site-gen.mjs "<описание бизнеса>"',
    },
    null,
    2,
  )}\n`,
);
