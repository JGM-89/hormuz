import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Newspaper } from 'lucide-react';
import type { NewsItem } from '../types';

const RSS_FEEDS = [
  { url: 'https://news.google.com/rss/search?q=%22oil+prices%22+OR+%22crude+oil%22+OR+%22tanker+rates%22+OR+%22LNG+shipping%22+OR+%22OPEC%22&hl=en-US&gl=US&ceid=US:en', source: 'Google News' },
  { url: 'https://gcaptain.com/feed/', source: 'gCaptain' },
  { url: 'https://maritime-executive.com/feed', source: 'Maritime Executive' },
];

const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';

export default function NewsTicker() {
  const storeNews = useStore((s) => s.news);
  const [localNews, setLocalNews] = useState<NewsItem[]>([]);

  useEffect(() => {
    async function fetchFeeds() {
      const cutoff = Date.now() - 48 * 3600_000;
      const allItems: NewsItem[] = [];

      await Promise.allSettled(
        RSS_FEEDS.map(async ({ url, source }) => {
          try {
            const res = await fetch(`${RSS2JSON}${encodeURIComponent(url)}`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.status !== 'ok' || !data.items) return;
            for (const item of data.items) {
              const pubDate = new Date(item.pubDate).getTime();
              if (pubDate > cutoff) {
                allItems.push({
                  title: item.title,
                  link: item.link,
                  pubDate: item.pubDate,
                  source,
                });
              }
            }
          } catch { /* skip */ }
        })
      );

      allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
      const seen = new Set<string>();
      const deduped = allItems.filter(item => {
        const key = item.title.toLowerCase().slice(0, 60);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 20);

      if (deduped.length > 0) setLocalNews(deduped);
    }

    fetchFeeds();
    const interval = setInterval(fetchFeeds, 10 * 60_000);
    return () => clearInterval(interval);
  }, []);

  const news = localNews.length > 0 ? localNews : storeNews;
  if (news.length === 0) return null;

  const items = [...news, ...news];

  return (
    <div
      className="bg-base border-t border-border overflow-hidden h-7 flex items-center"
      role="marquee"
      aria-label="Maritime news headlines"
    >
      <div className="flex-shrink-0 bg-status-crit text-white text-[11px] font-bold uppercase tracking-widest px-3 h-full flex items-center gap-1.5 z-10">
        <Newspaper size={12} />
        LIVE FEED
      </div>
      <div className="overflow-hidden flex-1 relative">
        <div className="animate-ticker flex whitespace-nowrap hover:[animation-play-state:paused]">
          {items.map((item, i) => (
            <a
              key={`${item.link}-${i}`}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 text-xs text-text-secondary hover:text-accent transition-colors focus:outline-none focus:text-accent uppercase tracking-wide"
            >
              <span className="text-[11px] text-text-dim font-data tracking-wider">{item.source}</span>
              <span>{item.title}</span>
              <span className="text-border" aria-hidden="true">|</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
