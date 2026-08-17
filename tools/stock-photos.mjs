const ENDPOINT = 'https://api.openverse.org/v1/images/';
const SOURCES = 'stocksnap,rawpixel';

const SUBJECTS = [
  { marks: /пасек|мёд|мед\b|пчел/i, queries: ['honey jar', 'honeycomb', 'beekeeper hive'] },
  { marks: /кофейн|кофе|обжарк/i, queries: ['coffee cup', 'coffee beans', 'barista espresso'] },
  { marks: /пекарн|хлеб|закваск|выпечк/i, queries: ['artisan bread', 'bakery pastry', 'sourdough loaf'] },
  { marks: /кондитер|торт|десерт/i, queries: ['cake dessert', 'pastry chef', 'birthday cake'] },
  { marks: /груминг|собак|зоосалон|котов|кошек/i, queries: ['dog grooming', 'happy dog', 'pet care'] },
  { marks: /ветеринар/i, queries: ['veterinarian dog', 'pet clinic', 'cat vet'] },
  { marks: /мебел|диван|матрас|ковр|ковролин|кресл|обивк|крупногабарит|перетяжк/i, queries: ['velvet fabric', 'leather sofa', 'mattress bed', 'armchair room'] },
  { marks: /химчист|аквачистк|прачечн|ателье|портн|кашемир|пуховик|дублёнк|глажк|подшив/i, queries: ['hanging clothes', 'ironing', 'folded clothes', 'silk fabric'] },
  { marks: /свадеб|фотограф|съёмк|съемк/i, queries: ['wedding couple', 'wedding bouquet', 'photographer camera'] },
  { marks: /маникюр|педикюр|ногт/i, queries: ['manicure nails', 'nail salon', 'spa hands'] },
  { marks: /барбершоп|стрижк|парикмахер/i, queries: ['barbershop haircut', 'barber scissors', 'mens grooming'] },
  { marks: /стоматолог|зуб/i, queries: ['dental clinic', 'dentist chair', 'healthy smile'] },
  { marks: /мебел|кухн|шкаф|стол[яр]/i, queries: ['modern kitchen interior', 'wooden furniture workshop', 'carpenter woodworking'] },
  { marks: /автосервис|ремонт авто|ходов|двигател/i, queries: ['car repair garage', 'mechanic engine', 'auto service'] },
  { marks: /клининг|уборк/i, queries: ['clean home interior', 'cleaning service', 'tidy room'] },
  { marks: /грузоперевоз|переезд|газел/i, queries: ['moving boxes truck', 'delivery van', 'movers'] },
  { marks: /цвет[ыо]|флорист|букет/i, queries: ['flower bouquet', 'florist shop', 'fresh flowers'] },
  { marks: /психолог|терапевт/i, queries: ['calm therapy room', 'counseling session', 'peaceful interior'] },
  { marks: /юрист|адвокат|банкрот|нотариус/i, queries: ['law office', 'legal documents', 'business meeting'] },
  { marks: /школ|курс|репетитор|обучен|детск/i, queries: ['classroom learning', 'kids workshop', 'students study'] },
  { marks: /танц/i, queries: ['dance studio', 'dancing couple', 'dance class'] },
  { marks: /фитнес|спорт|йог/i, queries: ['fitness gym', 'yoga studio', 'workout'] },
  { marks: /ремонт квартир|отделк|строит/i, queries: ['home renovation', 'interior construction', 'apartment interior'] },
  { marks: /теплиц|ферм|огород|сад/i, queries: ['greenhouse plants', 'farm harvest', 'garden vegetables'] },
];

const FALLBACK = ['small business workspace', 'craft workshop', 'friendly service'];

export function photoQueries(description) {
  const hit = SUBJECTS.find((s) => s.marks.test(String(description)));
  return hit ? hit.queries : FALLBACK;
}

export function searchUrl(query, perQuery) {
  return `${ENDPOINT}?q=${encodeURIComponent(query)}&source=${SOURCES}&license=cc0&category=photograph&page_size=${perQuery}&mature=false`;
}

const MUSEUM_TITLE =
  /\b(1[5-9]\d0s?|century|medieval|renaissance|baroque|antique|engraving|etching|lithograph|woodcut|manuscript|museum|painting|drawing|sketch|graffiti|mural|art\b)/i;

export function photographsOnly(results, query) {
  return (results ?? [])
    .filter((r) => r.category === 'photograph')
    .filter((r) => !MUSEUM_TITLE.test(String(r.title ?? '')))
    .map((r) => ({
      url: r.url,
      title: String(r.title ?? query).trim(),
      query,
      width: r.width ?? null,
      height: r.height ?? null,
    }));
}

async function search(query, perQuery) {
  const res = await fetch(searchUrl(query, perQuery), { headers: { 'User-Agent': 'site-generator/1.0' } });
  if (!res.ok) throw new Error(`Openverse ${res.status}`);
  const data = await res.json();
  return photographsOnly(data.results, query);
}

async function loads(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Referer: 'https://example.com/', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return false;
    const type = res.headers.get('content-type') ?? '';
    return type.startsWith('image/');
  } catch {
    return false;
  }
}

export async function collectPhotos(description, { perQuery = 4, log = () => {} } = {}) {
  const queries = photoQueries(description);
  const found = [];
  const seen = new Set();

  for (const query of queries) {
    try {
      for (const photo of await search(query, perQuery)) {
        if (!photo.url || seen.has(photo.url)) continue;
        seen.add(photo.url);
        found.push(photo);
      }
    } catch (e) {
      log(`«${query}» — не ответил: ${e.message}`);
    }
  }

  const checks = await Promise.all(found.map((p) => loads(p.url)));
  const alive = found.filter((_, i) => checks[i]);
  const dead = found.length - alive.length;
  log(`найдено ${found.length}, отдаются ${alive.length}${dead ? `, отброшено битых ${dead}` : ''}`);

  return alive;
}

export function formatPhotos(photos) {
  return photos.map((p, i) => `  ${i + 1}. ${p.url}\n     что на снимке: ${p.title} (запрос «${p.query}»)`).join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const description = process.argv.slice(2).join(' ');
  const photos = await collectPhotos(description, { log: (m) => process.stderr.write(`[фото] ${m}\n`) });
  process.stdout.write(`${formatPhotos(photos)}\n`);
}
