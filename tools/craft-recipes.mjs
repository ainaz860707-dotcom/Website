export const CRAFT_RECIPES = {
  'liquid-glass': {
    name: 'Liquid glass поверх видео',
    source: 'https://motionsites.ai/?prompt=equilibrium (бесплатный промт, снят 2026-08-12)',
    body: `ПРИЁМ «LIQUID GLASS» — стеклянные элементы поверх видео.

Откуда: бесплатный промт «Equilibrium» из каталога motionsites.ai. Взята ТОЛЬКО техника.
Ни одного слова, названия, пункта меню и заголовка оттуда на страницу не переносится:
тексты там принадлежат чужому бизнесу, а факты о нашем берутся лишь из описания выше (§12).
Шрифты и палитра — из арт-дирекшена выше, а НЕ из промта-источника.

CSS-класс — дословно, это проверенный рецепт:
  .liquid-glass{background:rgba(255,255,255,.01);background-blend-mode:luminosity;
    -webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);border:none;
    box-shadow:inset 0 1px 1px rgba(255,255,255,.1);position:relative;overflow:hidden}
  .liquid-glass::before{content:'';position:absolute;inset:0;border-radius:inherit;padding:1.4px;
    background:linear-gradient(180deg,rgba(255,255,255,.45) 0%,rgba(255,255,255,.15) 20%,
      rgba(255,255,255,0) 40%,rgba(255,255,255,0) 60%,rgba(255,255,255,.15) 80%,
      rgba(255,255,255,.45) 100%);
    -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
    -webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}

Где применять — только там, где под элементом действительно движется видео:
- плавающая капсула навигации поверх первого экрана;
- вторичная кнопка первого экрана (главная кнопка остаётся сплошной заливкой акцентом,
  иначе на светлом кадре она теряется);
- подпись к кадру.

Границы приёма, нарушение = брак:
- Стекло НЕ применяется к блокам на обычном фоне: без движущегося кадра под ним
  \`backdrop-filter\` даёт грязное пятно вместо стекла.
- Контраст текста на стекле считается по самому светлому кадру видео и не ниже 4.5:1.
  Не дотягивает — под текст ставится затемняющая подложка, а не осветляется шрифт.
- \`backdrop-filter\` поддержан не везде: базовый фон элемента обязан читаться и без него,
  поэтому у капсулы есть собственная полупрозрачная заливка, а не только блюр.
- Стеклянных элементов на первом экране не больше трёх: приём держится на редкости.`,
  },
  'bento-media': {
    name: 'Бенто из карточек-кадров, зерно и бегущая лента',
    source: 'https://motionsites.ai/?prompt=max-reed-portfolio (бесплатный промт, снят 2026-08-12)',
    body: `ПРИЁМ «БЕНТО ИЗ КАДРОВ» — сетка карточек разного веса, где фон карточки это кадр.

Откуда: бесплатный промт «Max Reed Portfolio» из каталога motionsites.ai. Взята ТОЛЬКО техника
раскладки и три CSS-рецепта. Ни одного слова, имени, цифры, отзыва и пункта меню оттуда на
страницу не переносится: там факты чужого бизнеса, а факты нашего берутся лишь из описания
выше (§12). Шрифты и палитра — из арт-дирекшена выше, а НЕ из промта-источника.

Раскладка — одна секция на странице, не больше:
  .bento{display:grid;gap:var(--space-4);grid-template-columns:repeat(3,1fr)}
  .bento__cell{position:relative;overflow:hidden;border-radius:var(--radius-lg);
    min-height:clamp(220px,26vw,340px);display:flex;flex-direction:column;justify-content:space-between}
  .bento__cell--wide{grid-column:span 2}
  .bento__cell--tall{grid-row:span 2}
  .bento__shot{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0}
  .bento__cell>*:not(.bento__shot){position:relative;z-index:2}
  .bento__cell::before{content:'';position:absolute;inset:0;z-index:1;
    background:linear-gradient(180deg,rgba(0,0,0,.15) 0%,rgba(0,0,0,.72) 100%)}
  @media (max-width:900px){.bento{grid-template-columns:repeat(2,1fr)}}
  @media (max-width:600px){.bento{grid-template-columns:1fr}
    .bento__cell--wide,.bento__cell--tall{grid-column:auto;grid-row:auto}}

Фон карточки — <img class="bento__shot" alt="" width height loading="lazy" decoding="async">,
то есть ПОСТЕР, а не третье <video>. Видео на странице ровно столько, сколько разрешено блоком
про видео выше; карточка с кадром весит десятки килобайт вместо мегабайта и не трогает LCP.

Микро-метка карточки — прописные, разрядка, кегль из лестницы, не мельче 11px:
  .bento__label{text-transform:uppercase;letter-spacing:.22em;font-size:var(--text-xs);
    opacity:.7;margin:0}

Зерно поверх плоской заливки — дословно, проверенный рецепт:
  .noise{position:relative}
  .noise::after{content:'';position:absolute;inset:0;pointer-events:none;opacity:.55;
    mix-blend-mode:soft-light;background-size:240px 240px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")}

Бегущая лента — дословно, вместе с растворением краёв:
  .marquee{overflow:hidden;
    -webkit-mask-image:linear-gradient(to right,transparent,#000 8%,#000 92%,transparent);
    mask-image:linear-gradient(to right,transparent,#000 8%,#000 92%,transparent)}
  .marquee__row{display:flex;width:max-content;gap:var(--space-3);
    animation:marquee-left 22s linear infinite}
  .marquee__row--back{animation-name:marquee-right;animation-duration:26s}
  @keyframes marquee-left{from{transform:translateX(0)}to{transform:translateX(-50%)}}
  @keyframes marquee-right{from{transform:translateX(-50%)}to{transform:translateX(0)}}
  @media (prefers-reduced-motion:reduce){.marquee__row{animation:none}}
Содержимое ряда дублируется в разметке дважды подряд, иначе на середине будет разрыв.

Границы приёма, нарушение = брак:
- Бенто на странице одно, лента одна. Две сетки подряд превращают страницу в склад плиток.
- Текст на карточке лежит поверх затемнения ::before и читается с контрастом не ниже 4.5:1
  по самому светлому месту кадра; не дотягивает — темнее подложка, а не светлее шрифт.
- В ленте едут кадры или короткие слова из описания бизнеса. Сочинённых логотипов клиентов,
  наград и названий брендов в ленте нет — это выдуманный факт (§12).
- Пустая карточка ради ритма запрещена: в каждой ячейке либо кадр, либо содержательный текст.`,
  },
};

export function craftBlock(keys) {
  const list = String(keys ?? '')
    .split(/[,\s]+/)
    .filter(Boolean);
  if (!list.length) return { block: '', used: [] };

  const unknown = list.filter((k) => !CRAFT_RECIPES[k]);
  if (unknown.length) throw new Error(`неизвестный приём: ${unknown.join(', ')}`);

  return {
    block: list.map((k) => CRAFT_RECIPES[k].body).join('\n\n'),
    used: list.map((k) => `${CRAFT_RECIPES[k].name} ← ${CRAFT_RECIPES[k].source}`),
  };
}
