#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DIRECTIONS, motionOf } from './design-directions.mjs';

const PACE = {
  тихое: { ease: 'cubic-bezier(.22,.61,.36,1)', fast: 420, cycle: 9, lift: 'translateY(-2px)' },
  строгое: { ease: 'cubic-bezier(.2,0,0,1)', fast: 160, cycle: 7, lift: 'translateY(-1px)' },
  тёплое: { ease: 'cubic-bezier(.34,1.56,.64,1)', fast: 320, cycle: 6, lift: 'translateY(-3px) scale(1.02)' },
};

const CHARACTER = {
  gallery: { radius: 0, border: 'none', shadow: 'none', capsTrack: '0.2em', btn: 'ghost', frame: 'portrait' },
  editorial: { radius: 0, border: 'none', shadow: 'none', capsTrack: '0.14em', btn: 'ghost', frame: 'wide', dropcap: true },
  swiss: { radius: 0, border: '1px solid', shadow: 'none', capsTrack: '0.06em', btn: 'solid', frame: 'wide', numbers: true },
  organic: { radius: 26, border: 'none', shadow: '0 18px 40px -24px rgba(62,86,65,.5)', capsTrack: '0.08em', btn: 'round', frame: 'soft' },
  brutal: { radius: 0, border: '3px solid', shadow: '6px 6px 0', capsTrack: '0.02em', btn: 'brutal', frame: 'wide' },
  luxe: { radius: 0, border: '1px solid', shadow: 'none', capsTrack: '0.18em', btn: 'ghost', frame: 'wide', center: true },
  clinical: { radius: 14, border: 'none', shadow: '0 8px 20px -14px rgba(14,71,73,.45)', capsTrack: '0.1em', btn: 'solid', frame: 'soft' },
  industrial: { radius: 0, border: '2px solid', shadow: 'none', capsTrack: '0.1em', btn: 'solid', frame: 'wide', numbers: true, upper: true },
  productstage: { radius: 4, border: 'none', shadow: '0 30px 60px -30px rgba(0,0,0,.8)', capsTrack: '0.08em', btn: 'solid', frame: 'product', upper: true },
  illustrated: { radius: 24, border: '3px solid', shadow: '0 10px 0 -2px', capsTrack: '0.04em', btn: 'round', frame: 'soft' },
  pastel: { radius: 999, border: 'none', shadow: '0 20px 46px -28px rgba(74,37,69,.45)', capsTrack: '0.12em', btn: 'round', frame: 'oval', center: true },
  quietstructure: { radius: 28, border: 'none', shadow: '0 34px 64px -38px rgba(20,23,26,.45)', capsTrack: '0.16em', btn: 'round', frame: 'soft' },
  warmluxe: { radius: 2, border: 'none', shadow: 'none', capsTrack: '0.22em', btn: 'ghost', frame: 'wide', numbers: true },
};

const hexes = (s) => (s.match(/#[0-9A-Fa-f]{6}/g) ?? []).map((h) => h.toUpperCase());
const families = (s) => [...new Set((s.match(/'([^']+)'/g) ?? []).map((f) => f.slice(1, -1)))];

const saturation = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const l = (max + min) / 2;
  return (max - min) / (l > 0.5 ? 2 - max - min : max + min);
};

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

function tokens(dir) {
  const list = hexes(dir.palette);
  const sorted = [...list].sort((a, b) => luminance(b) - luminance(a));
  const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const bg = list[0] && saturation(list[0]) < 0.5 ? list[0] : (sorted[0] ?? '#FFFFFF');
  const dark = luminance(bg) < 0.4;
  const ink = [...list].sort((a, b) => contrast(b, bg) - contrast(a, bg))[0] ?? (dark ? '#FFFFFF' : '#111111');
  const accent =
    list.filter((h) => h !== bg && h !== ink && contrast(h, bg) >= 1.6).sort((a, b) => saturation(b) - saturation(a))[0] ?? ink;
  const rest = sorted.filter((h) => h !== bg && h !== ink && h !== accent && contrast(h, bg) >= 3.5);
  const muted = rest[dark ? 0 : rest.length - 1] ?? `color-mix(in srgb, ${ink} 68%, ${bg})`;
  const fonts = families(dir.fonts);
  return { bg, ink, accent, muted, dark, display: fonts[0] ?? 'Georgia', text: fonts[fonts.length - 1] ?? 'system-ui', list };
}

const GRAIN = {
  gallery: [0, 0.85],
  swiss: [0, 0.85],
  clinical: [0.04, 0.9],
  quietstructure: [0.045, 0.9],
  pastel: [0.05, 0.85],
  warmluxe: [0.06, 0.95],
  productstage: [0.07, 0.8],
  editorial: [0.08, 0.8],
  luxe: [0.08, 0.75],
  illustrated: [0.09, 0.7],
  organic: [0.11, 0.6],
  industrial: [0.13, 0.5],
  brutal: [0.15, 0.45],
};

function grainLayer(key) {
  const [opacity, frequency] = GRAIN[key] ?? [0.04, 0.8];
  if (!opacity) return null;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='${frequency}' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='160' height='160' filter='url(#g)'/></svg>`;
  return { opacity, url: `url("data:image/svg+xml,${encodeURIComponent(svg)}")` };
}

function card(dir, index) {
  const t = tokens(dir);
  const c = CHARACTER[dir.key] ?? CHARACTER.swiss;
  const motion = motionOf(dir.key);
  const grain = grainLayer(dir.key);
  const p = PACE[motion.pace] ?? PACE.тёплое;
  const selfMoving = motion.preset !== 'interface';
  const onAccent = luminance(t.accent) > 0.55 ? t.ink : '#FFFFFF';
  const scope = `.p-${dir.key}`;
  const btn = {
    ghost: `background:none;border-bottom:1px solid ${t.ink};color:${t.ink};padding:6px 0;border-radius:0`,
    solid: `background:${t.accent};color:${onAccent};padding:11px 22px;border:none;border-radius:${c.radius > 100 ? 999 : Math.min(c.radius, 8)}px`,
    round: `background:${t.accent};color:${onAccent};padding:12px 26px;border:none;border-radius:999px`,
    brutal: `background:${t.accent};color:${onAccent};padding:11px 22px;border:3px solid ${t.ink};box-shadow:4px 4px 0 ${t.ink};border-radius:0`,
  }[c.btn];

  const frame = {
    portrait: `aspect-ratio:3/4;background:${t.ink}14;border:1px solid ${t.ink}22`,
    wide: `aspect-ratio:4/3;background:${t.ink}12;border:${c.border === 'none' ? `1px solid ${t.ink}1a` : `${c.border} ${t.ink}`}`,
    soft: `aspect-ratio:4/3;background:${t.accent}26;border-radius:${c.radius}px;border:${c.border === 'none' ? 'none' : `${c.border} ${t.ink}`}`,
    product: `aspect-ratio:3/4;background:radial-gradient(60% 50% at 50% 55%, ${t.accent}66, transparent 70%),${t.ink};box-shadow:${c.shadow}`,
    oval: `aspect-ratio:3/4;background:${t.accent}33;border-radius:50% 50% 46% 46%`,
  }[c.frame];

  const style = `
${scope}{background:${t.bg};color:${t.ink};font-family:'${t.text}',system-ui,sans-serif;padding:26px 28px 30px;container-type:inline-size;position:relative;isolation:isolate}
${grain ? `${scope}::before{content:'';position:absolute;inset:0;pointer-events:none;z-index:2;opacity:${grain.opacity};background-image:${grain.url}}` : ''}
${scope} .nav{display:flex;justify-content:space-between;align-items:center;font-size:11px;letter-spacing:${c.capsTrack};text-transform:uppercase;color:${t.muted};padding-bottom:18px;border-bottom:1px solid ${t.ink}1f;margin-bottom:24px}
${scope} .nav b{font-family:'${t.display}',serif;font-size:14px;letter-spacing:0;color:${t.ink};font-weight:${c.frame === 'product' || c.upper ? 800 : 600}}
${scope} .hero{display:grid;grid-template-columns:${c.center ? '1fr' : '1.15fr .85fr'};gap:26px;align-items:center;${c.center ? 'text-align:center;justify-items:center' : ''}}
${scope} .eyebrow{font-size:10px;letter-spacing:${c.capsTrack};text-transform:uppercase;color:${t.accent};margin-bottom:12px;display:block}
${scope} h3{font-family:'${t.display}',serif;font-size:${c.upper ? '40px' : '36px'};line-height:${c.upper ? 0.94 : 1.04};margin:0 0 12px;font-weight:${c.frame === 'product' ? 400 : 600};${c.upper ? 'text-transform:uppercase;letter-spacing:-0.01em' : ''};color:${t.ink}}
${scope} p{font-size:13px;line-height:1.6;color:${t.muted};margin:0 0 18px;max-width:34ch}
${scope} .btn{display:inline-block;font-size:12px;letter-spacing:0.04em;font-weight:600;cursor:default;position:relative;z-index:3;${btn}}
${scope} .frame{${frame};width:100%;${c.center ? 'max-width:200px;margin-top:6px;' : ''}position:relative;overflow:hidden;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:${t.dark ? '#ffffff88' : `${t.ink}66`}}
${scope} .frame i{position:absolute;inset:0;display:grid;place-items:center;font-style:normal}
${scope} .frame i + i{background:repeating-linear-gradient(135deg,${t.accent}2e 0 10px,transparent 10px 20px),${t.accent}1f;opacity:0;transition:opacity ${p.fast}ms ${p.ease}${selfMoving ? `;animation:boardswap ${p.cycle}s ${p.ease} infinite alternate` : ''}}
${scope} .frame:hover i + i{opacity:1${selfMoving ? ';animation:none' : ''}}
${scope} .frame::after{content:'${selfMoving ? 'два кадра сменяются сами' : 'кадры меняются по наведению'}';position:absolute;left:0;right:0;bottom:0;padding:6px 8px;font-size:9px;letter-spacing:.1em;background:${t.dark ? '#00000066' : '#ffffffb3'};transform:translateY(100%);transition:transform ${p.fast}ms ${p.ease}}
${scope} .frame:hover::after{transform:translateY(0)}
${scope} .btn{transition:transform ${p.fast}ms ${p.ease},opacity ${p.fast}ms ${p.ease}}
${scope} .btn:hover{transform:${p.lift}}
${selfMoving
      ? `${scope} .nav b,${scope} h3,${scope} p,${scope} .btn,${scope} .frame{animation:boardin ${Math.round(p.fast * 1.6)}ms ${p.ease} both}
${scope} h3{animation-delay:80ms}
${scope} p{animation-delay:${Math.round(p.fast * 0.5)}ms}
${scope} .btn{animation-delay:${Math.round(p.fast * 0.8)}ms}
${scope} .frame{animation-delay:${Math.round(p.fast * 0.3)}ms}`
      : ''}
${scope} .swatches{display:flex;gap:6px;margin-top:26px;padding-top:18px;border-top:1px solid ${t.ink}1f}
${scope} .swatches i{width:26px;height:26px;border-radius:${c.radius > 100 ? 999 : 3}px;border:1px solid ${t.ink}1a}
${c.numbers ? `${scope} .eyebrow::before{content:'0${index + 1} / ';}` : ''}
${c.dropcap ? `${scope} p::first-letter{font-family:'${t.display}',serif;font-size:34px;float:left;line-height:.8;padding:4px 8px 0 0;color:${t.accent}}` : ''}`;

  const html = `<article class="card">
  <header class="meta">
    <div>
      <span class="idx">Вариант ${index + 1}</span>
      <h2>${dir.name}</h2>
    </div>
  </header>
  <div class="preview p-${dir.key}">
    <div class="nav"><b>Название дела</b><span>услуги · о нас · контакты</span></div>
    <div class="hero">
      <div>
        <span class="eyebrow">Город</span>
        <h3>Заголовок<br>первого экрана</h3>
        <p>Одна фраза подводки — ровно та длина, которая встанет на живой странице этого направления.</p>
        <span class="btn">Оставить заявку</span>
      </div>
      <div class="frame"><i>кадр 1</i><i>кадр 2</i></div>
    </div>
    <div class="swatches">${t.list.map((h) => `<i style="background:${h}"></i>`).join('')}</div>
  </div>
  <footer class="notes">
    <p><b>Шрифты.</b> ${dir.fonts}</p>
    <p><b>Характер.</b> ${dir.layout}</p>
    <p><b>Поверхность.</b> ${dir.surface}</p>
    <p><b>Движение.</b> ${motion.note} — пресет «${motion.preset}», ритм ${motion.pace}</p>
    <p><b>Кому идёт.</b> ${dir.niches.join(' · ')}</p>
    <p class="key">${dir.key}</p>
  </footer>
</article>`;

  return { style, html, fonts: [t.display, t.text, ...families(dir.fonts)] };
}

const FAMILY = {
  gallery: 'тихое',
  editorial: 'тихое',
  luxe: 'тихое',
  pastel: 'тихое',
  clinical: 'тихое',
  swiss: 'строгое',
  industrial: 'строгое',
  brutal: 'строгое',
  organic: 'тёплое',
  illustrated: 'тёплое',
  productstage: 'тёплое',
  quietstructure: 'тихое',
  warmluxe: 'тихое',
};

const ANCHOR = { тихое: 'editorial', строгое: 'swiss', тёплое: 'organic' };

export function pickThree(input, skip = []) {
  const text = input.toLowerCase();
  const pool = DIRECTIONS.filter((d) => !skip.includes(d.key));
  const hits = pool.filter((d) => d.niches.some((n) => text.includes(n.slice(0, 5))));
  const chosen = hits.slice(0, 2);
  const anchorOf = (family) =>
    pool.find((d) => d.key === ANCHOR[family]) ?? pool.find((d) => FAMILY[d.key] === family);
  const missing = Object.keys(ANCHOR)
    .filter((family) => !chosen.some((d) => FAMILY[d.key] === family))
    .map(anchorOf);
  for (const d of [...missing, ...hits.slice(2), ...pool]) {
    if (chosen.length === 3) break;
    if (d && !chosen.includes(d)) chosen.push(d);
  }
  return chosen;
}

const args = process.argv.slice(2);
const flag = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3).split(',').map((v) => v.trim()).filter(Boolean) : [];
};
const skip = flag('skip');
const keys = flag('keys');
const brief = args.filter((a) => !a.startsWith('--')).join(' ').trim();
const byKeys = keys.map((k) => DIRECTIONS.find((d) => d.key === k)).filter(Boolean);
const selection = byKeys.length ? byKeys : brief ? pickThree(brief, skip) : DIRECTIONS;
const cards = selection.map(card);
const fontQuery = [...new Set(cards.flatMap((c) => c.fonts))]
  .map((f) => `family=${f.replace(/ /g, '+')}:wght@300;400;600;700;800`)
  .join('&');

const embed = args.includes('--embed');

async function inlineFonts(query) {
  const UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
  const res = await fetch(`https://fonts.googleapis.com/css2?${query}&display=swap`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Google Fonts: HTTP ${res.status}`);
  const css = await res.text();
  const blocks = [...css.matchAll(/\/\*\s*([a-z-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)];
  if (!blocks.length) throw new Error('в CSS Google Fonts не нашлось блоков @font-face с подписью подмножества');
  const wanted = blocks
    .filter(([, subset]) => subset === 'latin' || subset === 'cyrillic')
    .map(([, , block]) => block)
    .join('\n');
  const urls = [...new Set([...wanted.matchAll(/url\((https:\/\/[^)]+\.woff2)\)/g)].map((m) => m[1]))];
  const data = new Map();
  await Promise.all(
    urls.map(async (u) => {
      const font = await fetch(u, { headers: { 'User-Agent': UA } });
      if (!font.ok) throw new Error(`шрифт ${u}: HTTP ${font.status}`);
      data.set(u, Buffer.from(await font.arrayBuffer()).toString('base64'));
    })
  );
  const inlined = wanted.replace(/url\((https:\/\/[^)]+\.woff2)\)/g, (m, u) =>
    data.has(u) ? `url(data:font/woff2;base64,${data.get(u)})` : m
  );
  return { css: inlined, count: urls.length, bytes: inlined.length };
}

const inlined = embed ? await inlineFonts(fontQuery) : null;
if (inlined) process.stdout.write(`шрифты вшиты: файлов ${inlined.count}, ${Math.round(inlined.bytes / 1024)} КБ base64\n`);

const styleBlock = `<style>
${inlined ? inlined.css : ''}
*{box-sizing:border-box}
body{margin:0;background:#0E0E10;color:#EDEDED;font:15px/1.6 ui-sans-serif,system-ui,sans-serif;padding:48px 32px 80px}
.head{max-width:1180px;margin:0 auto 40px}
.head h1{font-size:30px;margin:0 0 10px;letter-spacing:-0.01em}
.head p{color:#9A9AA2;margin:0;max-width:70ch}
.grid{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(440px,1fr));gap:26px}
.card{background:#17171A;border:1px solid #2A2A30;border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
.meta{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:18px 20px 14px}
.meta h2{font-size:15px;margin:4px 0 0;font-weight:600;line-height:1.35}
.idx{font-size:11px;color:#6E6E78;letter-spacing:.14em}
.idx{display:block;margin-bottom:2px}
.head .brief{color:#D6D6DC;margin:0 0 14px;font-size:15px}
.head .what{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin:22px 0 18px}
.head .what div{background:#17171A;border:1px solid #2A2A30;border-radius:10px;padding:14px 16px}
.head .what b{display:block;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#8FD4A8;margin-bottom:7px}
.head .what div:last-child b{color:#E0A88F}
.head .what span{font-size:13px;line-height:1.6;color:#9A9AA2}
.head .ask{color:#EDEDED;font-weight:600}
.notes .key{font-size:10px;color:#4E4E58;letter-spacing:.1em;margin-top:3px}
.preview{border-block:1px solid #2A2A30}
.notes{padding:16px 20px 20px;display:grid;gap:7px}
.notes p{margin:0;font-size:12px;line-height:1.55;color:#9A9AA2}
.notes b{color:#D6D6DC;font-weight:600}
@media (max-width:900px){.grid{grid-template-columns:1fr}}
@keyframes boardswap{0%,42%{opacity:0}58%,100%{opacity:1}}
@keyframes boardin{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
${cards.map((c) => c.style).join('\n')}
@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none !important;transition:none !important}.preview .frame i + i{opacity:0 !important}}
</style>`;

const bodyBlock = `<div class="head">
  <h1>${brief ? 'Три варианта дизайна' : 'Все дизайн-направления'}</h1>
  ${brief ? `<p class="brief">Под задачу: «${brief}»</p>` : ''}
  <p>Каждая карточка — живой первый экран будущей страницы: настоящие шрифты, настоящая палитра, настоящий характер блоков. Тексты на карточках — заглушки, фактов о бизнесе здесь нет.</p>
  <div class="what">
    <div><b>Выбор меняет</b><span>шрифты и их размер · палитру · воздух и ритм · форму кнопок и карточек · характер движения</span></div>
    <div><b>Выбор не меняет</b><span>факты о бизнесе — только сказанное вами · состав секций страницы · тексты · SEO-разметку и находимость</span></div>
  </div>
  <p class="ask">Назовите номер варианта — этого достаточно.</p>
</div>
<div class="grid">
${cards.map((c) => c.html).join('\n')}
</div>`;

const title = brief ? `Три варианта дизайна — ${brief}` : 'Все дизайн-направления';

const page = embed
  ? `<title>${title}</title>\n${styleBlock}\n${bodyBlock}\n`
  : `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${fontQuery}&display=swap" rel="stylesheet">
${styleBlock}
</head>
<body>
${bodyBlock}
</body>
</html>`;

const outDir = path.join('artifacts', 'design-board');
mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, embed ? 'artifact.html' : 'index.html');
writeFileSync(file, `${page}\n`, 'utf8');
process.stdout.write(
  `${file}\n${brief ? `три варианта под задачу: ${selection.map((d, i) => `${i + 1}) ${d.name}`).join(' · ')}` : `весь каталог: ${selection.length}`}\n`
);
