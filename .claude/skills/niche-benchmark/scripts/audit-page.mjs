#!/usr/bin/env node
const urls = process.argv.slice(2);
if (!urls.length) {
  process.stderr.write('использование: node audit-page.mjs <url> [<url> ...]\n');
  process.exit(1);
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

function text(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function meta(html, name) {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0] ?? '';
  return tag.match(/content=["']([^"']*)["']/i)?.[1] ?? '';
}

function cityHits(body, city) {
  if (!city) return null;
  const stem = city.slice(0, Math.max(4, city.length - 2));
  return (body.match(new RegExp(stem, 'gi')) || []).length;
}

const city = process.env.CITY ?? '';

for (const url of urls) {
  process.stdout.write(`\n=== ${url}\n`);
  let html = '';
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (!res.ok) {
      process.stdout.write(`  недоступно: HTTP ${res.status}\n`);
      continue;
    }
    html = await res.text();
  } catch (e) {
    process.stdout.write(`  недоступно: ${e.message}\n`);
    continue;
  }

  const body = text(html);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '';
  const desc = meta(html, 'description');
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => text(m[1]));
  const h2n = (html.match(/<h2[\s>]/gi) || []).length;

  const ld = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  const types = new Set();
  let faqCount = 0;
  for (const m of ld) {
    try {
      const walk = (node) => {
        if (Array.isArray(node)) return node.forEach(walk);
        if (!node || typeof node !== 'object') return;
        if (node['@type']) [].concat(node['@type']).forEach((t) => types.add(t));
        if (node['@type'] === 'FAQPage' && Array.isArray(node.mainEntity)) faqCount += node.mainEntity.length;
        Object.values(node).forEach(walk);
      };
      walk(JSON.parse(m[1].trim()));
    } catch {
      types.add('битый JSON-LD');
    }
  }

  const details = (html.match(/<details[\s>]/gi) || []).length;
  const scripts = (html.match(/<script[\s>]/gi) || []).length;
  const external = new Set([...html.matchAll(/(?:src|href)=["']https?:\/\/([^/"']+)/gi)].map((m) => m[1]));
  const bodyNoScript = text(html.replace(/<script[\s\S]*?<\/script>/gi, ''));

  process.stdout.write(`  title (${title.length}): ${title}\n`);
  process.stdout.write(`  description (${desc.length}): ${desc || '— нет —'}\n`);
  process.stdout.write(`  h1 (${h1s.length}): ${h1s[0] ?? '— нет —'}\n`);
  process.stdout.write(`  h2: ${h2n}\n`);
  process.stdout.write(`  JSON-LD типы: ${types.size ? [...types].join(', ') : '— нет —'}\n`);
  process.stdout.write(`  вопросов в FAQPage: ${faqCount || 0}${details ? ` · <details> на странице: ${details}` : ''}\n`);
  if (city) process.stdout.write(`  упоминаний города «${city}»: ${cityHits(body, city)}\n`);
  process.stdout.write(`  объём текста: ${bodyNoScript.length} знаков\n`);
  process.stdout.write(`  тегов script: ${scripts} · внешних доменов: ${external.size}\n`);
  if (bodyNoScript.length < 500) {
    process.stdout.write('  ⚠ текста без скриптов почти нет — контент рисуется скриптом, нейросети его не прочтут\n');
  }
}
