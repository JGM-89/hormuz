/**
 * Fetches Brent crude oil price from Yahoo Finance.
 */

let cachedPrice = null;
let lastFetchTime = 0;
const CACHE_TTL = 15 * 60_000; // 15 minutes

export async function fetchOilPrice() {
  const now = Date.now();
  if (cachedPrice && now - lastFetchTime < CACHE_TTL) {
    return cachedPrice;
  }

  try {
    // Yahoo Finance v8 API for Brent Crude (BZ=F)
    const res = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/BZ=F?interval=1d&range=5d',
      {
        headers: {
          'User-Agent': 'HormuzTracker/1.0',
        },
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!res.ok) throw new Error(`Yahoo Finance: ${res.status}`);

    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result) throw new Error('No chart data');

    const meta = result.meta;
    const closes = result.indicators?.quote?.[0]?.close || [];
    const currentPrice = meta.regularMarketPrice;
    const previousClose = closes.length >= 2 ? closes[closes.length - 2] : currentPrice;
    const change = currentPrice - previousClose;
    const changePercent = previousClose ? (change / previousClose) * 100 : 0;

    cachedPrice = {
      symbol: 'BZ=F',
      name: 'Brent Crude',
      price: Math.round(currentPrice * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      timestamp: Date.now(),
    };

    lastFetchTime = now;
    console.log(`[Market] Brent Crude: $${cachedPrice.price} (${cachedPrice.change >= 0 ? '+' : ''}${cachedPrice.changePercent}%)`);
    return cachedPrice;
  } catch (err) {
    console.warn(`[Market] Failed to fetch oil price: ${err.message}`);
    return cachedPrice; // return stale data if available
  }
}
