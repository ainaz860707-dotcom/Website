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

export function videoBlock(videos) {
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
- Тег строго такой: <video src="…" poster="…" muted playsinline preload="metadata"
  width="…" height="…"></video>. Атрибуты muted и playsinline обязательны, иначе на телефоне
  видео не запустится и покажет чёрный прямоугольник.
- Автозапуск по кругу — только если сцена короче 10 секунд: добавь autoplay loop.
  Иначе видео прокручивается скроллом: currentTime ставится по прогрессу прокрутки
  закреплённой секции, инлайновым скриптом на 10–15 строк. Это тот самый приём, где
  продукт наливается по мере чтения.
- Скролл-прокрутка видео пишется на requestAnimationFrame с ограничением: не чаще кадра,
  без обработчика scroll напрямую. Вне экрана скрипт не работает.
- Постер обязателен и стоит в атрибуте poster: пока видео качается, человек видит кадр,
  а не пустоту.
- Текст поверх видео — только с затемняющей подложкой, контраст не ниже 4.5:1.
- Видео декоративное: оно не несёт смысла, которого нет в тексте рядом. Ни одного факта
  о бизнесе, который читается только из видео.
- ПОДПИСИ НЕЙТРАЛЬНЫЕ: «так выглядит наливание мёда», а не «наша пасека» — съёмка чужая.
- При prefers-reduced-motion видео не запускается: показывается постер.`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const videos = await collectVideos(process.argv.slice(2).join(' '), { log: (m) => process.stderr.write(`[видео] ${m}\n`) });
  process.stdout.write(videos.length ? `${videoBlock(videos)}\n` : 'видео не набрано\n');
}
