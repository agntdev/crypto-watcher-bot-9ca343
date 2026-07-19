import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  registerMainMenuItem,
  inlineButton,
  inlineKeyboard,
} from "../toolkit/index.js";
import { getIndexStore } from "../lib/store.js";
import { getMultiplePrices, formatPrice } from "../lib/price-api.js";

registerMainMenuItem({ label: "📊 Price", data: "price:show", order: 10 });

const composer = new Composer<Ctx>();

composer.command("price", async (ctx) => {
  await showPrices(ctx);
});

composer.callbackQuery("price:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showPrices(ctx);
});

async function showPrices(ctx: Ctx) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const index = await getIndexStore().get(String(userId));
  const tickers = index?.tickers ?? [];

  if (tickers.length === 0) {
    await ctx.reply(
      "Your watchlist is empty.\n\nTap ➕ Add coin to track prices.",
      {
        reply_markup: inlineKeyboard([
          [inlineButton("➕ Add coin", "add_preset")],
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      },
    );
    return;
  }

  try {
    const prices = await getMultiplePrices(tickers);

    if (prices.length === 0) {
      await ctx.reply("Couldn't fetch prices. Try again later.", {
        reply_markup: inlineKeyboard([
          [inlineButton("🔄 Retry", "price:show")],
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      });
      return;
    }

    const lines = prices.map((p) => {
      const arrow = p.change_24h >= 0 ? "📈" : "📉";
      const sign = p.change_24h >= 0 ? "+" : "";
      return `${arrow} ${p.ticker}: $${formatPrice(p.price_usd)} (${sign}${p.change_24h.toFixed(2)}%)`;
    });

    const text = `Current prices:\n\n${lines.join("\n")}`;

    const rows = prices.map((p) => [
      inlineButton(`${p.ticker} details`, `price:detail:${p.ticker}`),
    ]);
    rows.push([inlineButton("🔄 Refresh", "price:show")]);
    rows.push([inlineButton("⬅️ Back to menu", "menu:main")]);

    await ctx.reply(text, { reply_markup: inlineKeyboard(rows) });
  } catch {
    await ctx.reply("Couldn't fetch price data. Try again in a moment.", {
      reply_markup: inlineKeyboard([
        [inlineButton("🔄 Retry", "price:show")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
  }
}

export default composer;
