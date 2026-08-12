#!/usr/bin/env node
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_PROFILE = path.join(homedir(), 'Library', 'Caches', 'ms-playwright-mcp', 'mcp-chrome-2d32ba4');

const AD_DOMAINS = /temu\.com|aliexpress|joom\.com|wildberries|ozon\.ru|shein|alibaba/i;

export function ownerProfileDir() {
  return process.env.REFERENCE_BROWSER_PROFILE ?? DEFAULT_PROFILE;
}

export async function withOwnerBrowser(fn, { profileDir = ownerProfileDir() } = {}) {
  const { chromium } = await import('playwright');
  let context;
  try {
    context = await chromium.launchPersistentContext(profileDir, { channel: 'chrome', headless: true });
  } catch (e) {
    throw new Error(
      `браузер с сессией владельца не поднялся: ${e.message}\nзакрой окно этого профиля (kill -TERM по главному pid Chrome) и повтори`
    );
  }
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    return await fn(page);
  } finally {
    await context.close();
  }
}

export async function mobbinSites(page, { styles, categories = null, pages = 2 } = {}) {
  await page.goto('https://mobbin.com/discover/sites/latest', { waitUntil: 'domcontentloaded' });
  const collected = [];
  for (let pageIndex = 0; pageIndex < pages; pageIndex += 1) {
    const batch = await page.evaluate(
      async ({ styles: s, categories: c, pageIndex: i }) => {
        const body = {
          searchRequestId: crypto.randomUUID(),
          pageIndex: i,
          searchQuery: { contentType: 'sites', type: 'filters', activeFilterTags: [], categories: c, styles: s, sortBy: 'popularity' },
        };
        const res = await fetch('/api/search/fetch-search-page-sites', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (json?.error) return { error: json.error.message ?? 'unknown' };
        return { items: (json?.value?.data ?? []).map((d) => ({ name: d.name, tagline: d.tagline, url: d.url })) };
      },
      { styles, categories, pageIndex }
    );
    if (batch.error) throw new Error(`Mobbin: «${batch.error}» — сессия владельца потеряна`);
    if (!batch.items?.length) break;
    collected.push(...batch.items);
  }
  return collected.map((s) => ({ ...s, source: 'mobbin' }));
}

export async function pinterestSites(page, { query, pages = 2 } = {}) {
  await page.goto(`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded' });
  const seen = new Map();
  let bookmarks = [];

  for (let i = 0; i < pages; i += 1) {
    const batch = await page.evaluate(
      async ({ query: q, bookmarks: bm }) => {
        const sourceUrl = `/search/pins/?q=${encodeURIComponent(q)}`;
        const data = {
          options: {
            query: q, scope: 'pins', appliedProductFilters: '---', domains: null, user: null, seoDrawerEnabled: false,
            applied_unified_filters: null, auto_correction_disabled: false, filter_genai: false, journey_depth: null,
            source_id: null, source_module_id: null, source_url: sourceUrl, static_feed: false,
            selected_one_bar_modules: null, query_pin_sigs: null, page_size: null, gated: null, price_max: null,
            price_min: null, query_image_pins: null, request_params: null, top_pin_ids: null, article: null,
            corpus: null, filters: null, rs: 'direct_navigation', bookmarks: bm,
          },
          context: {},
        };
        const csrf = document.cookie.split('; ').find((c) => c.startsWith('csrftoken='))?.split('=')[1] ?? '';
        const res = await fetch('/resource/BaseSearchResource/get/', {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'x-csrftoken': csrf,
            'x-requested-with': 'XMLHttpRequest',
            'x-app-version': 'a1b2c3d',
          },
          body: `source_url=${encodeURIComponent(sourceUrl)}&data=${encodeURIComponent(JSON.stringify(data))}`,
          credentials: 'include',
        });
        if (!res.ok) return { error: `HTTP ${res.status}` };
        const json = await res.json();
        return {
          items: (json?.resource_response?.data?.results ?? []).map((p) => ({
            name: p.grid_title ?? p.title ?? null,
            url: p.link ?? null,
            domain: p.domain ?? null,
            dominantColor: p.dominant_color ?? null,
          })),
          bookmarks: json?.resource_response?.bookmark ? [json.resource_response.bookmark] : [],
        };
      },
      { query, bookmarks }
    );
    if (batch.error) throw new Error(`Pinterest: ${batch.error} — сессия владельца потеряна`);
    for (const item of batch.items ?? []) {
      if (!item.url || AD_DOMAINS.test(item.domain ?? '') || AD_DOMAINS.test(item.url)) continue;
      try {
        const origin = new URL(item.url).origin;
        if (!seen.has(origin)) seen.set(origin, { ...item, url: origin, source: 'pinterest' });
      } catch {
        continue;
      }
    }
    bookmarks = batch.bookmarks ?? [];
    if (!bookmarks.length) break;
  }
  return [...seen.values()];
}

const AWWWARDS_SKIP =
  /awwwards\.com|instagram\.com|facebook\.com|twitter\.com|x\.com|linkedin\.com|youtube\.com|tiktok\.com|pinterest\.|vimeo\.com|behance\.net|dribbble\.com|google\.|gstatic\.com|w3\.org|schema\.org|apple\.com|adobe\.com/i;

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export async function awwwardsSites({ category = null, pages = 1 } = {}) {
  const seen = new Map();

  for (let i = 1; i <= pages; i += 1) {
    const url = `https://www.awwwards.com/websites/${category ? `${category}/` : ''}${i > 1 ? `?page=${i}` : ''}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`Awwwards: HTTP ${res.status} на ${url}`);
    const html = await res.text();

    for (const [, href] of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
      if (AWWWARDS_SKIP.test(href)) continue;
      try {
        const origin = new URL(href).origin;
        if (!seen.has(origin)) seen.set(origin, { url: origin, source: 'awwwards', category });
      } catch {
        continue;
      }
    }
  }

  return [...seen.values()];
}

export async function dribbbleShots({ query, limit = 12 } = {}) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ userAgent: UA });
    const url = query
      ? `https://dribbble.com/search/shots/popular/${encodeURIComponent(query)}`
      : 'https://dribbble.com/shots/popular/web-design';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3500);

    const shots = await page.evaluate(
      (max) =>
        [...document.querySelectorAll('img')]
          .filter((img) => /cdn\.dribbble\.com\/userupload\//.test(img.currentSrc || img.src || ''))
          .slice(0, max)
          .map((img) => ({
            image: (img.currentSrc || img.src).replace(/\?.*$/, ''),
            title: img.alt?.trim() || null,
            shot:
              img.closest('a')?.href ??
              img.closest('li, article, div[class*="shot"]')?.querySelector('a[href*="/shots/"]')?.href ??
              null,
          })),
      limit
    );

    return shots
      .filter((s) => s.image)
      .map((s) => ({ ...s, thumb: `${s.image}?resize=800x600&vertical=center`, source: 'dribbble' }));
  } finally {
    await browser.close();
  }
}

export async function cosmosCaptions(page, { slug, scrolls = 4 } = {}) {
  await page.addInitScript(() => {
    window.__cosmosItems = [];
    const original = window.fetch;
    window.fetch = async function (...args) {
      const res = await original.apply(this, args);
      try {
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;
        if (/graphql/.test(String(url))) {
          const json = await res.clone().json();
          const items = json?.data?.categoryElements?.items;
          if (Array.isArray(items)) {
            for (const item of items) {
              window.__cosmosItems.push({ caption: item?.generatedCaption?.text ?? null, source: item?.source?.url ?? null });
            }
          }
        }
      } catch {}
      return res;
    };
  });

  await page.goto(`https://www.cosmos.so/explore/${slug}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  for (let i = 0; i < scrolls; i += 1) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.4));
    await page.waitForTimeout(1400);
  }

  const items = await page.evaluate(() => window.__cosmosItems ?? []);
  return items
    .map((i) => (i.caption ?? '').replace(/<\/?n>/g, '').trim())
    .filter(Boolean);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [what, ...rest] = process.argv.slice(2);
  const arg = rest.join(' ');

  if (what === 'awwwards' || what === 'dribbble') {
    const out =
      what === 'awwwards'
        ? await awwwardsSites({ category: arg || null })
        : await dribbbleShots({ query: arg || null });
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
    process.exit(0);
  }

  const result = await withOwnerBrowser(async (page) => {
    if (what === 'mobbin') return mobbinSites(page, { styles: [arg || 'Photography'] });
    if (what === 'pinterest') return pinterestSites(page, { query: arg || 'wedding photographer website' });
    if (what === 'cosmos') return cosmosCaptions(page, { slug: arg || 'weddings' });
    throw new Error(
      'использование: node reference-sources.mjs <awwwards|dribbble|mobbin|pinterest|cosmos> <аргумент>'
    );
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
