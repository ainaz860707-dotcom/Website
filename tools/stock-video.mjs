import { photoQueries } from './stock-photos.mjs';

const ENDPOINT = 'https://api.pexels.com/videos/search';

function apiKey() {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error('нет PEXELS_API_KEY');
  return key;
}

function bestFile(files) {
  const usable = files
    .filter((f) => f.file_type === 'video/mp4' && f.width && f.width >= 960 && f.width <= 1920)
    .sort((a, b) => a.width - b.width);
  return usable[0] ?? files.find((f) => f.file_type === 'video/mp4') ?? null;
}

async function search(query, perQuery) {
  const url = `${ENDPOINT}?query=${encodeURIComponent(query)}&per_page=${perQuery}&orientation=landscape&size=medium`;
  const res = await fetch(url, { headers: { Authorization: apiKey() } });
  if (!res.ok) throw new Error(`Pexels ${res.status}`);
  const data = await res.json();
  return (data.videos ?? [])
    .map((v) => {
      const file = bestFile(v.video_files ?? []);
      if (!file) return null;
      return {
        url: file.link,
        poster: v.image,
        width: file.width,
        height: file.height,
        seconds: v.duration,
        title: String(v.alt ?? query).trim() || query,
        query,
      };
    })
    .filter(Boolean);
}

export async function collectVideos(description, { perQuery = 2, log = () => {} } = {}) {
  const queries = photoQueries(description).slice(0, 2);
  const videos = [];
  const seen = new Set();

  for (const query of queries) {
    try {
      for (const video of await search(query, perQuery)) {
        if (seen.has(video.url)) continue;
        seen.add(video.url);
        videos.push(video);
      }
      log(`«${query}» — набрано ${videos.length}`);
    } catch (e) {
      log(`«${query}» — не ответил: ${e.message}`);
      if (String(e.message).includes('нет PEXELS_API_KEY')) break;
    }
  }

  return videos.filter((v) => v.seconds && v.seconds <= 30).slice(0, 3);
}

const SCRUB_RECIPE = `КАК ДЕЛАЕТСЯ СКРОЛЛ-СКРАББИНГ (проверено на живой странице, отступление = брак).
Приём: видео НИКОГДА не играется само — скролл крутит его таймлайн.

ГЕОМЕТРИЯ. Эти два правила обязательны дословно, высота секции — не украшение, а сам
механизм: скрипт делит прокрутку на «высота секции минус экран», и если секция высотой
по содержимому, всё видео проматывается за двести пикселей и дальше стоит.
  .hero{position:relative;height:260vh}
  .hero__sticky{position:sticky;top:0;height:100vh;overflow:hidden}
Меньше 200vh не ставить. Содержимое первого экрана живёт внутри .hero__sticky, поэтому
высота 260vh НЕ создаёт пустоты: человек видит один экран, просто листает его дольше.

Разметка первого экрана строго такая:
  <section class="hero" data-hero>
    <div class="hero__sticky">
      <video class="hero__video" data-src="ССЫЛКА" muted playsinline
             disablepictureinpicture aria-hidden="true"></video>
      <img class="hero__poster" src="ПОСТЕР" alt="что в кадре" width="…" height="…">
      <div class="hero__veil"></div>
      … заголовок, подводка, кнопка …
      <p class="hero__cap">подпись к кадру</p>
    </div>
  </section>
У <video> НЕТ атрибута src: адрес лежит в data-src, скрипт качает файл целиком в blob.
Потоковый src при перемотке даёт range-запрос на каждый кадр и дёргается на телефоне.
Постер — отдельный <img> с настоящим alt, а не атрибут poster: так кадр виден краулеру и
попадает в поиск по картинкам. Само видео помечено aria-hidden="true" — оно декоративное.
Видео лежит под постером и проявляется поверх него только когда класс is-live встал:
  .hero__video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .6s}
  .hero.is-live .hero__video{opacity:1}

Скрипт — инлайновый, в конце <body>, ровно по этой схеме:
  <script>
  (()=>{const s=document.querySelector('[data-hero]');const v=s&&s.querySelector('.hero__video');
  if(!s||!v)return;const still=matchMedia('(prefers-reduced-motion: reduce)');
  let target=0,shown=-1,frame=0;
  const progress=()=>{const run=s.offsetHeight-innerHeight;
    return run<=0?0:Math.min(1,Math.max(0,-s.getBoundingClientRect().top/run));};
  const draw=()=>{frame=0;const dur=v.duration;if(!Number.isFinite(dur)||dur===0)return;
    const next=shown<0?target:shown+(target-shown)*.16;
    if(Math.abs(next-target)<.002){shown=target;}else{shown=next;frame=requestAnimationFrame(draw);}
    v.currentTime=shown*dur;};
  const tick=()=>{target=progress();s.classList.toggle('is-scrolled',target>.04);
    if(!still.matches&&!frame)frame=requestAnimationFrame(draw);};
  v.addEventListener('loadeddata',()=>{s.classList.add('is-live');tick();},{once:!0});
  fetch(v.dataset.src).then(r=>r.ok?r.blob():Promise.reject(r.status))
    .then(b=>{v.src=URL.createObjectURL(b);}).catch(()=>{v.src=v.dataset.src;});
  const unlock=()=>{v.play().then(()=>v.pause()).catch(()=>{});};
  addEventListener('pointerdown',unlock,{once:!0,passive:!0});
  addEventListener('touchstart',unlock,{once:!0,passive:!0});
  addEventListener('scroll',tick,{passive:!0});addEventListener('resize',tick,{passive:!0});tick();})();
  </script>

Почему каждая строка на месте — убрать любую значит сломать приём:
- Сглаживание \`shown+(target-shown)*.16\` обязательно: без него перемотка идёт рывками,
  потому что скролл приходит крупными шагами, а видео перерисовывается по ключевым кадрам.
- Порог \`<.002\` останавливает цикл rAF: иначе кадр считается вечно и греет батарею.
- \`play().then(pause)\` на первый тап обязателен: iOS не декодирует кадры для перемотки,
  пока человек ни разу не коснулся экрана, и видео стоит чёрным прямоугольником.
- Обработчики scroll и resize только ставят цель и будят один rAF — считать в них нельзя.
- При prefers-reduced-motion перемотки нет вовсе, человек видит постер и подписи.

Подпись \`.hero__cap\` — ОДНА и всегда видимая. Переключать несколько подписей по прогрессу
скролла запрещено: спрятанная под opacity:0 подпись без скриптов не видна человеку, и это
брак по правилу «всё видно без единого выполненного скрипта». Скролл двигает таймлайн
видео, а не текст.

Прятать без скриптов на этом экране разрешено ровно два элемента, и оба не текст:
само \`.hero__video\` (оно aria-hidden, декоративное — без скриптов человек видит постер) и
постер под классом состояния \`.hero.is-live .hero__poster\` (класс ставит скрипт, без него
постер остаётся на месте). Больше ничего.

Текст поверх видео — с затемняющей подложкой .hero__veil, контраст не ниже 4.5:1.`;

export function videoBlock(videos, { own = null } = {}) {
  if (own) {
    return `ВИДЕО ПЕРВОГО ЭКРАНА (снято или собрано для этого бизнеса, права у клиента):
  ${own.url}
     постер: ${own.poster}
     что в кадре: ${own.title}${own.seconds ? ` · ${own.seconds}с` : ''}

Как с ним обращаться:
- Ровно ОДНО видео на странице, и оно — первый экран. Второе видео запрещено:
  это мегабайты и расфокус.
- Видео прокручивается скроллом, автозапуска и loop НЕТ. Схема ниже обязательна.
- Видео декоративное: ни одного факта о бизнесе, который читается только из кадра.
- ПОДПИСИ — только то, что сказано в описании бизнеса. Кадр принадлежит клиенту, поэтому
  «наш цех» писать можно, но лишь если владелец про цех сказал. Чего в описании нет —
  того нет и в подписи: ни адреса, ни имени, ни года.

${SCRUB_RECIPE}`;
  }

  if (!videos.length) return '';
  const list = videos
    .map(
      (v, i) =>
        `  ${i + 1}. ${v.url}\n     постер: ${v.poster}\n     что в кадре: ${v.title} · ${v.width}×${v.height} · ${v.seconds}с`,
    )
    .join('\n');

  return `ВИДЕО (настоящая съёмка, лицензия Pexels — использовать разрешено):
${list}

Как с ним обращаться:
- Ровно ОДНО видео на страницу, и оно — первый экран или закреплённая сцена продукта.
  Второе видео на странице запрещено: это мегабайты и расфокус.
- Видео прокручивается скроллом по схеме ниже. Автозапуск по кругу (autoplay loop, без
  скрипта) допустим как замена ТОЛЬКО если сцена короче 10 секунд и она не первый экран.
- Видео декоративное: оно не несёт смысла, которого нет в тексте рядом. Ни одного факта
  о бизнесе, который читается только из видео.
- ПОДПИСИ НЕЙТРАЛЬНЫЕ: «так выглядит наливание мёда», а не «наша пасека» — съёмка чужая.
- В панели «SEO и GEO», в списке «допиши сам»: «Замени видео первого экрана на своё —
  сейчас стоит бесплатная съёмка из общего доступа».

${SCRUB_RECIPE}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const videos = await collectVideos(process.argv.slice(2).join(' '), { log: (m) => process.stderr.write(`[видео] ${m}\n`) });
  process.stdout.write(videos.length ? `${videoBlock(videos)}\n` : 'видео не набрано\n');
}
