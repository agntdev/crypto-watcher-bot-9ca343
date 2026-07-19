const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

const TICKER_TO_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  TON: "the-open-network",
};

const ID_TO_INFO: Record<string, { ticker: string; name: string }> = {
  bitcoin: { ticker: "BTC", name: "Bitcoin" },
  ethereum: { ticker: "ETH", name: "Ethereum" },
  "the-open-network": { ticker: "TON", name: "Toncoin" },
};

export interface PriceData {
  ticker: string;
  name: string;
  price_usd: number;
  change_24h: number;
}

export async function getPrice(ticker: string): Promise<PriceData | null> {
  const upper = ticker.toUpperCase();
  const coinId = TICKER_TO_ID[upper];
  if (!coinId) return null;

  const res = await fetch(
    `${COINGECKO_BASE}/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`,
  );
  if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);

  const data = (await res.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
  const coinData = data[coinId];
  if (!coinData?.usd) return null;

  const info = ID_TO_INFO[coinId];
  return {
    ticker: info?.ticker ?? upper,
    name: info?.name ?? upper,
    price_usd: coinData.usd,
    change_24h: coinData.usd_24h_change ?? 0,
  };
}

export async function getMultiplePrices(tickers: string[]): Promise<PriceData[]> {
  const coinIds = tickers
    .map((t) => TICKER_TO_ID[t.toUpperCase()])
    .filter((id): id is string => Boolean(id));

  if (coinIds.length === 0) return [];

  const res = await fetch(
    `${COINGECKO_BASE}/simple/price?ids=${coinIds.join(",")}&vs_currencies=usd&include_24hr_change=true`,
  );
  if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);

  const data = (await res.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;

  return coinIds.map((id) => {
    const coinData = data[id];
    const info = ID_TO_INFO[id];
    return {
      ticker: info?.ticker ?? id.toUpperCase(),
      name: info?.name ?? id,
      price_usd: coinData?.usd ?? 0,
      change_24h: coinData?.usd_24h_change ?? 0,
    };
  });
}

export async function searchCoin(
  query: string,
): Promise<Array<{ id: string; ticker: string; name: string }>> {
  const res = await fetch(`${COINGECKO_BASE}/search?query=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);

  const data = (await res.json()) as {
    coins?: Array<{ id: string; symbol?: string; name?: string }>;
  };
  return (data.coins ?? []).slice(0, 5).map((c) => ({
    id: c.id,
    ticker: c.symbol?.toUpperCase() ?? c.id.toUpperCase(),
    name: c.name ?? c.id,
  }));
}

export function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (price >= 1) return price.toFixed(2);
  return price.toFixed(4);
}
