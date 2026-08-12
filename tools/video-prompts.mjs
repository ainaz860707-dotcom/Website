export const SUBJECT_RULE = `Главный объект — родовой, а не конкретный: «кабинет психолога», «фасад
загородного дома», «зал ресторана». Ни вывески, ни лица, ни номера машины, ни логотипа, ни
интерьера, снятого с реального адреса клиента: сгенерированный кадр, выданный за помещение
клиента, — выдуманный факт о бизнесе (CLAUDE.md §12). В промпт добавляется хвост
«no text, no signage, no logos, no readable brand marks, no faces».`;

export const LIGHTS = [
  {
    key: 'golden',
    name: 'Golden Hour',
    en: 'golden hour light, low warm sun, long soft shadows',
    mood: 'тёплый, дорогой, обжитой',
    fit: 'жильё, загородное, ресторан, бассейн, всё «уютное»',
    textContrast: 'низкий — светлый текст поверх кадра тонет, нужна затемняющая подложка',
  },
  {
    key: 'blue',
    name: 'Blue Hour',
    en: 'blue hour, dusk, cool ambient sky, warm practical lights inside',
    mood: 'премиальный, спокойный, вечерний',
    fit: 'архитектура, автомобиль, отель, тёмная тема сайта',
    textContrast: 'высокий для светлого текста — лучший фон под белый заголовок',
  },
  {
    key: 'daylight',
    name: 'Дневной свет',
    en: 'clean midday daylight, neutral white balance, crisp shadows',
    mood: 'деловой, честный, без пафоса',
    fit: 'услуги, медицина, производство, B2B',
    textContrast: 'средний — текст выносится в спокойную зону кадра, не поверх окна',
  },
  {
    key: 'overcast',
    name: 'Пасмурная погода',
    en: 'soft overcast light, diffused shadows, muted palette',
    mood: 'сдержанный, северный, редакционный',
    fit: 'минимализм, психолог, юрист, ателье',
    textContrast: 'высокий — самый послушный фон, ровная яркость по всему кадру',
  },
  {
    key: 'morning',
    name: 'Утренний свет',
    en: 'early morning light, thin haze, gentle rim light',
    mood: 'свежий, тихий, начало дня',
    fit: 'спорт, кофейня, детское, оздоровление',
    textContrast: 'средний — дымка съедает контраст на дальнем плане',
  },
  {
    key: 'night',
    name: 'Ночь на практическом свете',
    en: 'night interior, practical lamps only, deep shadows, warm pools of light',
    mood: 'камерный, дорогой, закрытый клуб',
    fit: 'бар, тёмный лендинг, шоурум, стритвир',
    textContrast: 'высокий в тенях — текст ставится на тёмную часть кадра',
  },
];

export const CAMERAS = [
  {
    key: 'orbit',
    name: 'Медленный облёт',
    en: 'slow orbital move around the subject, steady gimbal, constant speed',
    amplitude: 'высокая',
    loop: 'кольцуется плохо — нужен обратный ход или затемнение на стыке',
    fit: 'товар, здание, объект целиком',
  },
  {
    key: 'push-in',
    name: 'Плавный Push-In',
    en: 'slow push-in toward the subject, locked horizon, no handheld shake',
    amplitude: 'низкая',
    loop: 'кольцуется через плавное затухание либо реверс',
    fit: 'первый экран — самый безопасный приём под заголовок',
  },
  {
    key: 'pan',
    name: 'Панорама',
    en: 'slow lateral pan across the scene, constant speed, level horizon',
    amplitude: 'средняя',
    loop: 'кольцуется реверсом',
    fit: 'интерьер, пейзаж, фон секции',
  },
  {
    key: 'drone',
    name: 'Пролёт дроном',
    en: 'aerial drone flight over the location, smooth forward travel, slight descent',
    amplitude: 'высокая',
    loop: 'не кольцуется — только под скролл-скраб или один проход',
    fit: 'территория, посёлок, производство, вид сверху',
  },
  {
    key: 'pov',
    name: 'POV',
    en: 'first person point of view walking through the space, natural head height, gentle stabilised motion',
    amplitude: 'высокая',
    loop: 'не кольцуется',
    fit: 'проход по помещению, экскурсия, скролл-скраб',
  },
  {
    key: 'static',
    name: 'Статичный кадр с жизнью внутри',
    en: 'locked static camera, only the scene breathes: light shifts, fabric and foliage move',
    amplitude: 'нулевая',
    loop: 'кольцуется идеально',
    fit: 'фон под текст, шапка, карточка — когда движение не должно мешать чтению',
  },
];

export const USAGES = [
  {
    key: 'hero',
    name: 'Hero Section',
    seconds: '5–8',
    aspect: '16:9, композиция держится и в обрезке под телефон',
    loop: false,
    weight: 'до 3 МБ',
    motion: 'одно непрерывное движение в одну сторону, амплитуда низкая: push-in либо статика',
    rule: `Первый экран НЕ играет сам: скролл двигает video.currentTime по рецепту SCRUB_RECIPE
  из tools/stock-video.mjs. Секция помечена data-hero и высотой 260vh, внутри position: sticky —
  секция по содержимому даёт делитель в двести пикселей и ролик проматывается мгновенно.
  Постер — отдельный <img alt> с width, не атрибут poster и не loading="lazy": он и есть LCP-кадр
  и единственное, что прочитает поиск. Само <video> декоративное, aria-hidden="true".`,
  },
  {
    key: 'background',
    name: 'Фон сайта',
    seconds: '10–15',
    aspect: '16:9, безопасное поле по краям — обрежется под любой экран',
    loop: true,
    weight: 'до 4 МБ',
    motion: 'амплитуда низкая, без резких смен яркости — иначе текст поверх мигает',
    rule: `Секция ниже первого экрана. Кольцо бесшовное: первый и последний кадр совпадают либо
  стык прячется затемнением. Атрибуты: autoplay muted loop playsinline, звука нет.
  autoplay и data-src вместе — брак, приёмы исключают друг друга.`,
  },
  {
    key: 'scroll-scrub',
    name: 'Scroll Scrub',
    seconds: '8–12',
    aspect: '16:9',
    loop: false,
    weight: 'до 6 МБ',
    motion: 'одно непрерывное движение в одну сторону, без остановок и разворотов',
    rule: `Тот же SCRUB_RECIPE, но в секции-главе ниже первого экрана: подписи глав лежат
  в разметке ВСЕ сразу, класс переключает только видимость. Разворот камеры внутри ролика
  ломает приём: на обратном скролле сцена пойдёт не назад, а по своей траектории.`,
  },
  {
    key: 'header',
    name: 'Шапка страницы',
    seconds: '4–6',
    aspect: '21:9 — полоса, а не экран',
    loop: true,
    weight: 'до 1,5 МБ',
    motion: 'статика или еле заметная панорама: шапка не отвлекает от навигации',
    rule: 'Высота полосы задана заранее, чтобы шапка не прыгала при загрузке (CLS).',
  },
  {
    key: 'card',
    name: 'Карточка объекта',
    seconds: '3–4',
    aspect: '4:3 или 1:1',
    loop: true,
    weight: 'до 800 КБ',
    motion: 'один короткий приём: наезд либо статика с жизнью внутри',
    rule: `Играет по наведению и по попаданию в экран на телефоне: hover прячется за
  @media (hover: hover), иначе на телефоне карточка мёртвая. Пока не играет — виден постер.`,
  },
];

export const ONE_VIDEO = `Ровно одно <video> на страницу — правило слоя видео, и check-page.mjs
его считает. Назначение из каталога выбирается ОДНО: hero и фон вместе не ставятся.`;

export const COMMON_TAIL =
  'no text, no signage, no logos, no readable brand marks, no faces, no on-screen captions, photorealistic, cinematic, 4k';

export const REDUCED_MOTION = `Каждый видеоблок закрывается @media (prefers-reduced-motion: reduce):
видео заменяется своим poster-кадром. Это не опция, а условие приёмки.`;

export const CONTENT_FIRST = `Ни одного смысла только внутри ролика: заголовок, цена, адрес и
телефон живут в разметке. Нейросети и поиск видео не читают.`;

const byKey = (list, key, axis) => {
  const found = list.find((x) => x.key === key);
  if (!found) throw new Error(`${axis}: нет ключа «${key}», есть ${list.map((x) => x.key).join(', ')}`);
  return found;
};

export function buildVideoPrompt({ subject, light, camera, usage }) {
  if (!subject) throw new Error('нет главного объекта');
  const l = byKey(LIGHTS, light, 'свет');
  const c = byKey(CAMERAS, camera, 'камера');
  const u = byKey(USAGES, usage, 'назначение');

  const prompt = [subject.trim().replace(/\.$/, ''), l.en, c.en, COMMON_TAIL].join(', ');

  const spec = [
    `назначение: ${u.name}`,
    `длительность: ${u.seconds} с`,
    `кадр: ${u.aspect}`,
    `кольцевание: ${u.loop ? `да — ${c.loop}` : 'не нужно, один проход'}`,
    `вес: ${u.weight}`,
    `движение: ${u.motion} (у приёма «${c.name}» амплитуда ${c.amplitude})`,
    `текст поверх: контраст ${l.textContrast}`,
  ].join('\n');

  return {
    prompt,
    spec,
    rules: [u.rule, ONE_VIDEO, REDUCED_MOTION, CONTENT_FIRST, SUBJECT_RULE].join('\n\n'),
    light: l,
    camera: c,
    usage: u,
  };
}

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

if (args.length) {
  if (args.includes('--list')) {
    const table = (title, list, extra) =>
      `${title}\n${list.map((x) => `  ${x.key.padEnd(12)} ${x.name}${extra(x)}`).join('\n')}`;
    process.stdout.write(
      [
        table('СВЕТ', LIGHTS, (x) => ` — ${x.mood}; ${x.fit}`),
        table('КАМЕРА', CAMERAS, (x) => ` — амплитуда ${x.amplitude}; ${x.fit}`),
        table('НАЗНАЧЕНИЕ', USAGES, (x) => ` — ${x.seconds} с, ${x.aspect}`),
      ].join('\n\n') + '\n'
    );
  } else {
    const built = buildVideoPrompt({
      subject: arg('subject'),
      light: arg('light'),
      camera: arg('camera'),
      usage: arg('usage'),
    });
    process.stdout.write(
      `ПРОМПТ ДЛЯ МОДЕЛИ\n${built.prompt}\n\nТЕХЗАДАНИЕ\n${built.spec}\n\nПРАВИЛА ВЁРСТКИ\n${built.rules}\n`
    );
  }
}
