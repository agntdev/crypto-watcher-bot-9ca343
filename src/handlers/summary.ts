import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  registerMainMenuItem,
  inlineButton,
  inlineKeyboard,
} from "../toolkit/index.js";
import { getIndexStore, getUserStore, getWatchStore } from "../lib/store.js";
import { getMultiplePrices, formatPrice } from "../lib/price-api.js";
import { now } from "../lib/clock.js";

registerMainMenuItem({
  label: "📈 Summary",
  data: "summary:show",
  order: 20,
});

const composer = new Composer<Ctx>();

composer.command("summary", async (ctx) => {
  await showSummary(ctx);
});

composer.callbackQuery("summary:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showSummary(ctx);
});

async function showSummary(ctx: Ctx) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const userStore = getUserStore();
  const indexStore = getIndexStore();
  const watchStore = getWatchStore();

  const index = await indexStore.get(String(userId));
  const tickers = index?.tickers ?? [];

  if (tickers.length === 0) {
    await ctx.reply(
      "Your watchlist is empty.\n\nTap ➕ Add coin to see a summary.",
      {
        reply_markup: inlineKeyboard([
          [inlineButton("➕ Add coin", "add_preset")],
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      },
    );
    return;
  }

  const user = await userStore.get(String(userId));
  const quietHours = user?.quiet_hours;
  if (quietHours) {
    const currentHour = now().getHours();
    const { start, end } = quietHours;
    const inQuiet =
      start <= end
        ? currentHour >= start && currentHour < end
        : currentHour >= start || currentHour < end;
    if (inQuiet) {
      await ctx.reply(
        "It's quiet hours right now. Summary will resume when quiet hours end.",
        {
          reply_markup: inlineKeyboard([
            [inlineButton("⚙️ Change quiet hours", "settings:show")],
            [inlineButton("⬅️ Back to menu", "menu:main")],
          ]),
        },
      );
      return;
    }
  }

  try {
    const prices = await getMultiplePrices(tickers);

    if (prices.length === 0) {
      await ctx.reply("Couldn't fetch price data. Try again later.", {
        reply_markup: inlineKeyboard([
          [inlineButton("🔄 Retry", "summary:show")],
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      });
      return;
    }

    const watchStoreInstance = watchStore;
    const lines: string[] = [];
    const movers: Array<{ ticker: string; change: number }> = [];

    for (const p of prices) {
      const arrow = p.change_24h >= 0 ? "📈" : "📉";
      const sign = p.change_24h >= 0 ? "+" : "";
      lines.push(
        `${arrow} ${p.ticker}: $${formatPrice(p.price_usd)} (${sign}${p.change_24h.toFixed(2)}%)`,
      );
      movers.push({ ticker: p.ticker, change: p.change_24h });

      const item = await watchStoreInstance.get(`${userId}:${p.ticker}`);
      if (item) {
        item.last_price = p.price_usd;
        item.last_price_at = Date.now();
        await watchStoreInstance.set(`${userId}:${p.ticker}`, item);
      }
    }

    movers.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    const topMover = movers[0];
    if (topMover && topMover.change !== 0) {
      const dir = topMover.change > 0 ? "up" : "down";
      lines.push(
        `\nBiggest mover: ${topMover.ticker} ${dir} ${Math.abs(topMover.change).toFixed(2)}%`,
      );
    }

    const text = `Price summary:\n\n${lines.join("\n")}`;

    await ctx.reply(text, {
      reply_markup: inlineKeyboard([
        [inlineButton("🔄 Refresh", "summary:show")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
  } catch {
    await ctx.reply("Couldn't fetch price data. Try again in a moment.", {
      reply_markup: inlineKeyboard([
        [inlineButton("🔄 Retry", "summary:show")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
  }
}

export default composer;
