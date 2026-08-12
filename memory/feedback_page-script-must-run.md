---
name: feedback_page-script-must-run
description: "Страница проверяется не только чекером, но и отсутствием pageerror в браузере — имена окна (top, name, status) роняют весь скрипт молча."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4b9f929e-deca-4cbc-b7ae-7b3733dce6f4
  modified: 2026-08-12T17:37:07.027Z
---

Готовую страницу-артефакт мало прогнать через `tools/check-page.mjs` — нужен запуск в браузере
с подпиской на `pageerror`. `const top = …` бросает `Identifier 'top' has already been declared`
(`top` = `window.top`), и скрипт не выполняется целиком: нет появлений, липкой шапки,
переключений.

**Почему:** чекер ловит скрытие контента вне класса `js`; при упавшем скрипте класс `js`
не ставится вовсе, всё видно, и проверка остаётся зелёной. Дефект виден только прокруткой.

**How to apply:** после каждой сборки страницы — `page.on('pageerror', …)` через локальный
playwright (`node_modules/playwright`, импорт по абсолютному пути, CommonJS: `import pw from …;
const { chromium } = pw`), плюс замер вычисленных стилей на нескольких позициях скролла.
Запрещённые имена верхнего уровня: `top`, `name`, `status`, `length`, `origin`, `parent`, `self`,
`event`. Связано с [[feedback_css-recipe-must-be-measured]].
