/**
 * Fetches maritime news RSS feeds and returns recent headlines.
 * Uses built-in fetch + simple XML regex parsing (no dependency needed).
 */

const RSS_FEEDS = [
  { url: 'https://news.google.com/rss/search?q=%22strait+of+hormuz%22&hl=en-US&gl=US&ceid=US:en', source: 'Google News' },
  { url: 'https://gcaptain.com/feed/', source: 'gCaptain' },
  { url: 'https://maritime-executive.com/feed', source: 'Maritime Executive' },
];

let cachedNews = [];
let lastFetchTime = 0;
const CACHE_TTL = 10 * 60_000; // 10 minutes

function extractItems(xml, source) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = block.match(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/)?.[1] || block.match(/<title>(.*?)<\/title>/)?.[1] || '';
    const link = block.match(/<link>(.*?)<\/link>/)?.[1] || '';
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';

    if (title) {
      items.push({
        title: title.replace(/<[^>]+>/g, '').trim(),
        link: link.trim(),
        pubDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        source,
      });
    }
  }
  return items;
}

export async function fetchNews() {
  const now = Date.now();
  if (cachedNews.length > 0 && now - lastFetchTime < CACHE_TTL) {
    return cachedNews;
  }

  const allItems = [];
  const cutoff = Date.now() - 48 * 3600_000; // last 48 hours

  await Promise.allSettled(
    RSS_FEEDS.map(async ({ url, source }) => {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'HormuzTracker/1.0' },
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) return;
        const xml = await res.text();
        const items = extractItems(xml, source);
        for (const item of items) {
          if (new Date(item.pubDate).getTime() > cutoff) {
            allItems.push(item);
          }
        }
      } catch (err) {
        console.warn(`[RSS] Failed to fetch ${source}: ${err.message}`);
      }
    })
  );

  // Sort newest first, dedupe by title similarity, limit to 20
  allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
  const seen = new Set();
  cachedNews = allItems.filter(item => {
    const key = item.title.toLowerCase().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 20);

  lastFetchTime = now;
  console.log(`[RSS] Fetched ${cachedNews.length} headlines`);
  return cachedNews;
}
