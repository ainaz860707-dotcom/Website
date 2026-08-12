---
type: handoff
feature: hero-video-mcp
status: ready-to-execute
date: 2026-08-12
next_agent_entrypoint: true
supersedes_context:
approved_decisions: [Р1, Р2, Р3]
---

# Передача агенту: генерация кадра и ролика через MCP higgsfield

> Точка входа для агента в НОВОЙ сессии, где владелец уже выполнил `/mcp` и вошёл в higgsfield.
> Порядок чтения: этот файл целиком → §Мандат → §Осталось → §Операционка.

## 0. TL;DR (30 секунд)

- **Задача.** Заменить стоковый ролик на первом экране примера `artifacts/core-probe/house-video/`
  на сгенерированный: сначала опорный кадр картинкой, показать владельцу, потом ролик из этого кадра.
- **Где мы.** Разведка закончена на 100%: промпт собран, модели и параметры сняты с CLI,
  цены подтверждены. Не сделано ровно одно — сама генерация, она требует входа в MCP.
- **Последнее.** CLI авторизован (workspace `Private`, plan `plus`, 110 кредитов), но на триале
  `generate create` отвечает `only_mcp_usage_on_trial_is_available`. Генерация — только MCP-каналом.
- **Самый важный вывод.** Вёрстка примера не трогается вообще: `000.html` ссылается на
  `media/house-aerial.mp4` и `media/house-aerial-poster.jpg` относительными путями — меняется
  содержимое файлов, не разметка.

## 1. Мандат (не пересматривать)

| # | Решение владельца | Смысл |
|---|---|---|
| Р1 | Генерация идёт через MCP, не через CLI | На триале CLI отказывает; вход выполняет владелец командой `/mcp` |
| Р2 | Бюджет прогона — 10 кредитов из 110 | Кадр 2 + ролик 8; больше не тратить без нового разрешения |
| Р3 | Вёрстка примера не меняется | Правится один файл в `media/`, HTML остаётся как есть |

## 2. Что уже СДЕЛАНО

- Промпт собран инструментом, не руками:
  `node tools/video-prompts.mjs --subject "modern two-storey country house with panoramic windows on a wooded plot" --light golden --camera drone --usage scroll-scrub`
- Параметры моделей сняты с живого CLI (имена не сочинялись):
  - `nano_banana_pro` (image): `prompt` (обязателен), `aspect_ratio` ∈ {…,16:9,…}, `resolution` ∈ {1k,2k,4k}, до 14 `image_references`.
  - `veo3_1_lite` (video): `prompt` (обязателен), `aspect_ratio` ∈ {16:9,9:16,auto}, `duration` ∈ {4,6,8} (по умолчанию 8), `start_image`, `end_image`, `generate_audio`.
- Цены подтверждены `generate cost` (бесплатный вызов, списания нет):
  кадр `nano_banana_pro` — **2 кредита**, ролик `veo3_1_lite` 8 с — **8 кредитов**. Итого 10 из 110.
- Техзадание под назначение `scroll-scrub`: 8–12 с, 16:9, один проход без кольцевания,
  вес до 6 МБ, одно непрерывное движение в одну сторону, контраст под текст низкий —
  нужна затемняющая подложка.

## 3. Что ОСТАЛОСЬ

- [ ] Шаг 1 — кадр: MCP higgsfield, модель `nano_banana_pro`, `aspect_ratio: 16:9`, `resolution: 2k`,
      промпт из §4. Сохранить в `artifacts/core-probe/house-video/media/house-aerial-frame.png`.
- [ ] Шаг 2 — **показать кадр владельцу и дождаться ответа.** Перегенерация кадра стоит 2 кредита,
      перегенерация ролика — 8; композиция утверждается на кадре.
- [ ] Шаг 3 — ролик: `veo3_1_lite`, `duration: 8`, `aspect_ratio: 16:9`, `generate_audio: false`,
      `start_image` — кадр из шага 1, тот же промпт.
- [ ] Шаг 4 — положить ролик в `artifacts/core-probe/house-video/media/house-aerial.mp4`,
      постер — первый кадр: `ffmpeg -ss 0 -frames:v 1 -i house-aerial.mp4 house-aerial-poster.jpg`.
      Постер обязан остаться 1280×720 либо атрибуты `width`/`height` в `000.html:275` правятся под факт.
- [ ] Шаг 5 — прогнать `node tools/check-page.mjs` по странице и проверить скраб глазами
      (`qa-user-tester`): `currentTime` должен доехать до конца ролика на прокрутке секции.
- [ ] Шаг 6 — снять строку из `second-brain/04_not-done/README.md` про генерацию видео,
      дописать замер в `second-brain/02_architecture/video-layer.md`.

## 4. Операционка и грабли

**Промпт (английский, хвост §12 обязателен, не редактировать вручную):**

```
modern two-storey country house with panoramic windows on a wooded plot, golden hour light,
low warm sun, long soft shadows, aerial drone flight over the location, smooth forward travel,
slight descent, no text, no signage, no logos, no readable brand marks, no faces,
no on-screen captions, photorealistic, cinematic, 4k
```

Грабли, на которые уже наступили:

- Сервер, дописанный в `.mcp.json` в уже открытой сессии, подхватывается только в НОВОЙ сессии.
- `higgsfield workspace list` при отсутствии выбранного workspace отвечает «No workspace selected» —
  это не «нет входа». Проверять вход по коду возврата `higgsfield auth token`, не печатая токен в чат.
- `generate cost` бесплатен и работает на триале — цена называется ДО генерации, всегда.
- Постер в `000.html` уже один раз уехал с выдуманными `width`/`height`; чекер это пропустил,
  нашлось глазами. Сверять атрибуты с реальным файлом.
- Разворот камеры внутри ролика ломает скраб: на обратном скролле сцена идёт не назад.
  Поэтому `drone` + «одно движение в одну сторону», а не `orbit`.

**Проверка:** `node tools/check-page.mjs artifacts/core-probe/house-video/000.html`, затем браузер.

## 5. Ссылки

- Скилл: `.claude/skills/hero-video/SKILL.md`
- Знание: `second-brain/02_architecture/video-layer.md`
- Правила тулинга Higgsfield: `.claude/CLAUDE.md`
- Страница-пример: `artifacts/core-probe/house-video/000.html`
- Реестр не-сделанного: `second-brain/04_not-done/README.md`
