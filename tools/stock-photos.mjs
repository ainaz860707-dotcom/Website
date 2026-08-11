const ENDPOINT = 'https://api.openverse.org/v1/images/';
const SOURCES = 'stocksnap,rawpixel';

const SUBJECTS = [
  { marks: /пасек|мёд|мед\b|пчел/i, queries: ['honey jar', 'honeycomb', 'beekeeper hive'] },
  { marks: /кофейн|кофе|обжарк/i, queries: ['coffee cup', 'coffee beans', 'barista espresso'] },
  { marks: /пекарн|хлеб|закваск|выпечк/i, queries: ['artisan bread', 'bakery pastry', 'sourdough loaf'] },
  { marks: /кондитер|торт|десерт/i, queries: ['cake dessert', 'pastry chef', 'birthday cake'] },
  { marks: /груминг|собак|зоосалон|котов|кошек/i, queries: ['dog grooming', 'happy dog', 'pet care'] },
  { marks: /ветеринар/i, queries: ['veterinarian dog', 'pet clinic', 'cat vet'] },
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

async function search(query, perQuery) {
  const url = `${ENDPOINT}?q=${encodeURIComponent(query)}&source=${SOURCES}&license=cc0&page_size=${perQuery}&mature=false`;
  const res = await fetch(url, { headers: { 'User-Agent': 'site-generator/1.0' } });
  if (!res.ok) throw new Error(`Openverse ${res.status}`);
  const data = await res.json();
  return (data.results ?? []).map((r) => ({
    url: r.url,
    title: String(r.title ?? query).trim(),
    query,
    width: r.width ?? null,
    height: r.height ?? null,
  }));
}

export async function collectPhotos(description, { perQuery = 4, log = () => {} } = {}) {
  const queries = photoQueries(description);
  const photos = [];
  const seen = new Set();

  for (const query of queries) {
    try {
      for (const photo of await search(query, perQuery)) {
        if (!photo.url || seen.has(photo.url)) continue;
        seen.add(photo.url);
        photos.push(photo);
      }
      log(`«${query}» — набрано ${photos.length}`);
    } catch (e) {
      log(`«${query}» — не ответил: ${e.message}`);
    }
  }

  return photos;
}

export function formatPhotos(photos) {
  return photos.map((p, i) => `  ${i + 1}. ${p.url}\n     что на снимке: ${p.title} (запрос «${p.query}»)`).join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const description = process.argv.slice(2).join(' ');
  const photos = await collectPhotos(description, { log: (m) => process.stderr.write(`[фото] ${m}\n`) });
  process.stdout.write(`${formatPhotos(photos)}\n`);
}
