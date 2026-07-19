import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  registerMainMenuItem,
  inlineButton,
  inlineKeyboard,
} from "../toolkit/index.js";
import { getWatchStore, getIndexStore } from "../lib/store.js";

registerMainMenuItem({
  label: "📋 Watchlist",
  data: "watchlist:show",
  order: 15,
});

const composer = new Composer<Ctx>();

composer.callbackQuery("watchlist:show", async (ctx) => {
  await ctx.answerCallbackQuery();

  const userId = ctx.from?.id;
  if (!userId) return;

  const index = await getIndexStore().get(String(userId));
  const tickers = index?.tickers ?? [];

  if (tickers.length === 0) {
    await ctx.editMessageText(
      "Your watchlist is empty.\n\nTap ➕ Add coin to get started.",
      {
        reply_markup: inlineKeyboard([
          [inlineButton("➕ Add coin", "add_preset")],
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      },
    );
    return;
  }

  const watchStore = getWatchStore();
  const rows: ReturnType<typeof inlineButton>[][] = [];
  for (const ticker of tickers) {
    const item = await watchStore.get(`${userId}:${ticker}`);
    const name = item?.friendly_name ?? ticker;
    rows.push([
      inlineButton(`${name} (${ticker})`, `watchlist:detail:${ticker}`),
      inlineButton("🗑", `watchlist:confirm_remove:${ticker}`),
    ]);
  }

  rows.push([inlineButton("➕ Add coin", "add_preset")]);
  rows.push([inlineButton("⬅️ Back to menu", "menu:main")]);

  const plural = tickers.length === 1 ? "" : "s";
  await ctx.editMessageText(
    `Your watchlist (${tickers.length} coin${plural}):`,
    { reply_markup: inlineKeyboard(rows) },
  );
});

composer.callbackQuery(/^watchlist:confirm_remove:(\w+)$/, async (ctx) => {
  const match = ctx.match;
  if (!match) return;

  const ticker = match[1].toUpperCase();
  const userId = ctx.from?.id;
  if (!userId) return;

  await ctx.answerCallbackQuery();

  const item = await getWatchStore().get(`${userId}:${ticker}`);
  const name = item?.friendly_name ?? ticker;

  await ctx.editMessageText(
    `Remove ${name} (${ticker}) from your watchlist?`,
    {
      reply_markup: inlineKeyboard([
        [
          inlineButton("✅ Yes", `watchlist:remove:${ticker}`),
          inlineButton("❌ No", "watchlist:show"),
        ],
      ]),
    },
  );
});

composer.callbackQuery(/^watchlist:remove:(\w+)$/, async (ctx) => {
  const match = ctx.match;
  if (!match) return;

  const ticker = match[1].toUpperCase();
  const userId = ctx.from?.id;
  if (!userId) return;

  await ctx.answerCallbackQuery();

  await getWatchStore().delete(`${userId}:${ticker}`);

  const index = await getIndexStore().get(String(userId));
  if (index) {
    index.tickers = index.tickers.filter((t) => t !== ticker);
    await getIndexStore().set(String(userId), index);
  }

  await ctx.editMessageText(`❌ ${ticker} removed from your watchlist.`, {
    reply_markup: inlineKeyboard([
      [inlineButton("➕ Add coin", "add_preset")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.callbackQuery("watchlist:add_custom", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "adding_custom_ticker";
  await ctx.editMessageText(
    "Type the ticker symbol (e.g. SOL, DOGE, XRP):",
    {
      reply_markup: inlineKeyboard([
        [inlineButton("❌ Cancel", "menu:main")],
      ]),
    },
  );
});

export default composer;
