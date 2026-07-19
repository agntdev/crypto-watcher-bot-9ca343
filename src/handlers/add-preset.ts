import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  registerMainMenuItem,
  inlineButton,
  inlineKeyboard,
} from "../toolkit/index.js";
import {
  getUserStore,
  getWatchStore,
  getIndexStore,
} from "../lib/store.js";

registerMainMenuItem({
  label: "➕ Add coin",
  data: "add_preset",
  order: 5,
});

const PRESETS = [
  { ticker: "BTC", name: "Bitcoin", coinId: "bitcoin" },
  { ticker: "ETH", name: "Ethereum", coinId: "ethereum" },
  { ticker: "TON", name: "Toncoin", coinId: "the-open-network" },
];

const composer = new Composer<Ctx>();

composer.callbackQuery("add_preset", async (ctx) => {
  await ctx.answerCallbackQuery();

  const userId = ctx.from?.id;
  if (!userId) return;

  const index = await getIndexStore().get(String(userId));
  const currentTickers = index?.tickers ?? [];

  const rows = PRESETS.map((p) => {
    const isWatched = currentTickers.includes(p.ticker);
    const label = isWatched ? `✅ ${p.ticker}` : `${p.ticker} — ${p.name}`;
    const data = isWatched
      ? `preset:${p.ticker}:remove`
      : `preset:${p.ticker}:add`;
    return [inlineButton(label, data)];
  });

  rows.push([inlineButton("⌨️ Type a ticker", "watchlist:add_custom")]);
  rows.push([inlineButton("⬅️ Back to menu", "menu:main")]);

  await ctx.editMessageText("Pick a coin to add to your watchlist:", {
    reply_markup: inlineKeyboard(rows),
  });
});

composer.callbackQuery(/^preset:(\w+):(add|remove)$/, async (ctx) => {
  const match = ctx.match;
  if (!match) return;

  const ticker = match[1].toUpperCase();
  const action = match[2];
  const userId = ctx.from?.id;
  if (!userId) return;

  await ctx.answerCallbackQuery();

  const preset = PRESETS.find((p) => p.ticker === ticker);
  if (!preset) {
    await ctx.editMessageText("Unknown coin. Try again.");
    return;
  }

  const userStore = getUserStore();
  const watchStore = getWatchStore();
  const indexStore = getIndexStore();

  if (action === "add") {
    const watchItem = {
      ticker: preset.ticker,
      friendly_name: preset.name,
      coin_id: preset.coinId,
      user_id: userId,
      threshold_alerts: [] as Array<{
        threshold: number;
        direction: "above" | "below";
      }>,
      percent_move_alerts: [{ percent: 5, lookback_hours: 1 }],
      cooldown_until: null,
      last_price: null,
      last_price_at: null,
    };

    await watchStore.set(`${userId}:${preset.ticker}`, watchItem);

    const index = (await indexStore.get(String(userId))) ?? { tickers: [] };
    if (!index.tickers.includes(preset.ticker)) {
      index.tickers.push(preset.ticker);
      await indexStore.set(String(userId), index);
    }

    const user = await userStore.get(String(userId));
    if (!user) {
      await userStore.set(String(userId), {
        telegram_id: userId,
        display_name: ctx.from?.first_name ?? "User",
        quiet_hours: null,
        summary_time: null,
        notification_prefs: { alerts: true, summary: true },
      });
    }

    await ctx.editMessageText(
      `✅ ${preset.name} (${preset.ticker}) added to your watchlist.`,
      {
        reply_markup: inlineKeyboard([
          [inlineButton("➕ Add another", "add_preset")],
          [inlineButton("📋 View watchlist", "watchlist:show")],
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      },
    );
  } else {
    await watchStore.delete(`${userId}:${preset.ticker}`);

    const index = await indexStore.get(String(userId));
    if (index) {
      index.tickers = index.tickers.filter((t) => t !== preset.ticker);
      await indexStore.set(String(userId), index);
    }

    await ctx.editMessageText(
      `❌ ${preset.name} (${preset.ticker}) removed from your watchlist.`,
      {
        reply_markup: inlineKeyboard([
          [inlineButton("➕ Add coin", "add_preset")],
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      },
    );
  }
});

export default composer;
