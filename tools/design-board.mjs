#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DIRECTIONS } from './design-directions.mjs';

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
};

const hexes = (s) => (s.match(/#[0-9A-Fa-f]{6}/g) ?? []).map((h) => h.toUpperCase());
const families = (s) => [...new Set((s.match(/'([^']+)'/g) ?? []).map((f) => f.slice(1, -1)))];

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

function tokens(dir) {
  const list = hexes(dir.palette);
  const sorted = [...list].sort((a, b) => luminance(b) - luminance(a));
  const bg = sorted[0] ?? '#FFFFFF';
  const ink = sorted[sorted.length - 1] ?? '#111111';
  const accent = list.find((h) => h !== bg && h !== ink && luminance(h) > 0.08 && luminance(h) < 0.75) ?? ink;
  const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const rest = sorted.filter((h) => h !== bg && h !== ink && h !== accent && contrast(h, bg) >= 3.5);
  const muted = rest[rest.length - 1] ?? `color-mix(in srgb, ${ink} 68%, ${bg})`;
  const dark = luminance(bg) < 0.4;
  const fonts = families(dir.fonts);
  return { bg, ink, accent, muted, dark, display: fonts[0] ?? 'Georgia', text: fonts[fonts.length - 1] ?? 'system-ui', list };
}

function card(dir, index) {
  const t = tokens(dir);
  const c = CHARACTER[dir.key] ?? CHARACTER.swiss;
  const onAccent = luminance(t.accent) > 0.55 ? t.ink : '#FFFFFF';
  const scope = `.p-${dir.key}`;
  const btn = {
    ghost: `background:none;border-bottom:1px solid ${t.ink};color:${t.ink};padding:6px 0;border-radius:0`,
    solid: `background:${t.accent};color:${onAccent};padding:11px 22px;border:none;border-radius:${c.radius > 100 ? 999 : Math.min(c.radius, 8)}px`,
    round: `background:${t.accent};color:${onAccent};padding:12px 26px;border:none;border-radius:999px`,
    brutal: `background:${t.accent};color:${t.ink};padding:11px 22px;border:3px solid ${t.ink};box-shadow:4px 4px 0 ${t.ink};border-radius:0`,
  }[c.btn];

  const frame = {
    portrait: `aspect-ratio:3/4;background:${t.ink}14;border:1px solid ${t.ink}22`,
    wide: `aspect-ratio:4/3;background:${t.ink}12;border:${c.border === 'none' ? `1px solid ${t.ink}1a` : `${c.border} ${t.ink}`}`,
    soft: `aspect-ratio:4/3;background:${t.accent}26;border-radius:${c.radius}px;border:${c.border === 'none' ? 'none' : `${c.border} ${t.ink}`}`,
    product: `aspect-ratio:3/4;background:radial-gradient(60% 50% at 50% 55%, ${t.accent}66, transparent 70%),${t.ink};box-shadow:${c.shadow}`,
    oval: `aspect-ratio:3/4;background:${t.accent}33;border-radius:50% 50% 46% 46%`,
  }[c.frame];

  const style = `
${scope}{background:${t.bg};color:${t.ink};font-family:'${t.text}',system-ui,sans-serif;padding:26px 28px 30px;container-type:inline-size}
${scope} .nav{display:flex;justify-content:space-between;align-items:center;font-size:11px;letter-spacing:${c.capsTrack};text-transform:uppercase;color:${t.muted};padding-bottom:18px;border-bottom:1px solid ${t.ink}1f;margin-bottom:24px}
${scope} .nav b{font-family:'${t.display}',serif;font-size:14px;letter-spacing:0;color:${t.ink};font-weight:${c.frame === 'product' || c.upper ? 800 : 600}}
${scope} .hero{display:grid;grid-template-columns:${c.center ? '1fr' : '1.15fr .85fr'};gap:26px;align-items:center;${c.center ? 'text-align:center;justify-items:center' : ''}}
${scope} .eyebrow{font-size:10px;letter-spacing:${c.capsTrack};text-transform:uppercase;color:${t.accent};margin-bottom:12px;display:block}
${scope} h3{font-family:'${t.display}',serif;font-size:${c.upper ? '40px' : '36px'};line-height:${c.upper ? 0.94 : 1.04};margin:0 0 12px;font-weight:${c.frame === 'product' ? 400 : 600};${c.upper ? 'text-transform:uppercase;letter-spacing:-0.01em' : ''};color:${t.ink}}
${scope} p{font-size:13px;line-height:1.6;color:${t.muted};margin:0 0 18px;max-width:34ch}
${scope} .btn{display:inline-block;font-size:12px;letter-spacing:0.04em;font-weight:600;cursor:default;${btn}}
${scope} .frame{${frame};width:100%;${c.center ? 'max-width:200px;margin-top:6px;' : ''}display:grid;place-items:center;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:${t.dark ? '#ffffff88' : `${t.ink}66`}}
${scope} .swatches{display:flex;gap:6px;margin-top:26px;padding-top:18px;border-top:1px solid ${t.ink}1f}
${scope} .swatches i{width:26px;height:26px;border-radius:${c.radius > 100 ? 999 : 3}px;border:1px solid ${t.ink}1a}
${c.numbers ? `${scope} .eyebrow::before{content:'0${index + 1} / ';}` : ''}
${c.dropcap ? `${scope} p::first-letter{font-family:'${t.display}',serif;font-size:34px;float:left;line-height:.8;padding:4px 8px 0 0;color:${t.accent}}` : ''}`;

  const html = `<article class="card">
  <header class="meta">
    <div>
      <span class="idx">${String(index + 1).padStart(2, '0')}</span>
      <h2>${dir.name}</h2>
    </div>
    <code>DIRECTION=${dir.key}</code>
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
      <div class="frame">кадр</div>
    </div>
    <div class="swatches">${t.list.map((h) => `<i style="background:${h}"></i>`).join('')}</div>
  </div>
  <footer class="notes">
    <p><b>Шрифты.</b> ${dir.fonts}</p>
    <p><b>Характер.</b> ${dir.layout}</p>
    <p><b>Кому идёт.</b> ${dir.niches.join(' · ')}</p>
  </footer>
</article>`;

  return { style, html, fonts: [t.display, t.text, ...families(dir.fonts)] };
}

const cards = DIRECTIONS.map(card);
const fontQuery = [...new Set(cards.flatMap((c) => c.fonts))]
  .map((f) => `family=${f.replace(/ /g, '+')}:wght@300;400;600;700;800`)
  .join('&');

const page = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Доска дизайн-направлений</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${fontQuery}&display=swap" rel="stylesheet">
<style>
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
.meta code{font-size:11px;color:#8FD4A8;background:#0E0E10;border:1px solid #2A2A30;border-radius:5px;padding:4px 8px;white-space:nowrap}
.preview{border-block:1px solid #2A2A30}
.notes{padding:16px 20px 20px;display:grid;gap:7px}
.notes p{margin:0;font-size:12px;line-height:1.55;color:#9A9AA2}
.notes b{color:#D6D6DC;font-weight:600}
@media (max-width:900px){.grid{grid-template-columns:1fr}}
${cards.map((c) => c.style).join('\n')}
</style>
</head>
<body>
<div class="head">
  <h1>Доска дизайн-направлений</h1>
  <p>Каждая карточка — живой первый экран: настоящие шрифты, палитра и характер блоков этого направления. Тексты — плейсхолдеры, фактов о бизнесе на доске нет. Выбранный ключ уходит в генератор как <code>DIRECTION=</code>.</p>
</div>
<div class="grid">
${cards.map((c) => c.html).join('\n')}
</div>
</body>
</html>`;

const outDir = path.join('artifacts', 'design-board');
mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, 'index.html');
writeFileSync(file, `${page}\n`, 'utf8');
process.stdout.write(`${file}\nнаправлений: ${DIRECTIONS.length}\n`);
