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
