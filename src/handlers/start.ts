import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  registerMainMenuItem,
  mainMenuKeyboard,
  inlineButton,
  inlineKeyboard,
} from "../toolkit/index.js";
import {
  getUserStore,
  getWatchStore,
  getIndexStore,
} from "../lib/store.js";
import { searchCoin } from "../lib/price-api.js";

registerMainMenuItem({ label: "📊 Price", data: "price:show", order: 10 });
registerMainMenuItem({
  label: "📋 Watchlist",
  data: "watchlist:show",
  order: 15,
});
registerMainMenuItem({
  label: "📈 Summary",
  data: "summary:show",
  order: 20,
});
registerMainMenuItem({
  label: "⚙️ Settings",
  data: "settings:show",
  order: 30,
});

const composer = new Composer<Ctx>();

const WELCOME = "👋 Welcome! Tap a button below to get started.";

composer.command("start", async (ctx) => {
  await ctx.reply(WELCOME, { reply_markup: mainMenuKeyboard() });
});

composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(WELCOME, { reply_markup: mainMenuKeyboard() });
});

composer.on("message:text", async (ctx, next) => {
  const step = ctx.session.step;
  const text = ctx.message.text.trim();

  if (!step) {
    return next();
  }

  if (step === "adding_custom_ticker") {
    ctx.session.step = undefined;
    ctx.session.temp = undefined;

    const ticker = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!ticker || ticker.length < 2 || ticker.length > 10) {
      await ctx.reply("Invalid ticker. Use 2–10 letters (e.g. SOL, DOGE).", {
        reply_markup: inlineKeyboard([
          [inlineButton("⌨️ Try again", "watchlist:add_custom")],
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      });
      return;
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const watchStore = getWatchStore();
    const existing = await watchStore.get(`${userId}:${ticker}`);
    if (existing) {
      await ctx.reply(`${ticker} is already on your watchlist.`, {
        reply_markup: inlineKeyboard([
          [inlineButton("📋 View watchlist", "watchlist:show")],
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      });
      return;
    }

    try {
      const results = await searchCoin(ticker);
      const match = results.find(
        (r) => r.ticker === ticker || r.id.toLowerCase() === ticker.toLowerCase(),
      );

      const coinId = match?.id ?? ticker.toLowerCase();
      const coinName = match?.name ?? ticker;

      await watchStore.set(`${userId}:${ticker}`, {
        ticker,
        friendly_name: coinName,
        coin_id: coinId,
        user_id: userId,
        threshold_alerts: [],
        percent_move_alerts: [{ percent: 5, lookback_hours: 1 }],
        cooldown_until: null,
        last_price: null,
        last_price_at: null,
      });

      const indexStore = getIndexStore();
      const index = (await indexStore.get(String(userId))) ?? { tickers: [] };
      if (!index.tickers.includes(ticker)) {
        index.tickers.push(ticker);
        await indexStore.set(String(userId), index);
      }

      const userStore = getUserStore();
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

      await ctx.reply(`✅ ${coinName} (${ticker}) added to your watchlist.`, {
        reply_markup: inlineKeyboard([
          [inlineButton("➕ Add another", "add_preset")],
          [inlineButton("📋 View watchlist", "watchlist:show")],
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      });
    } catch {
      await ctx.reply(
        `Added ${ticker} to your watchlist (couldn't verify coin data).`,
        {
          reply_markup: inlineKeyboard([
            [inlineButton("➕ Add another", "add_preset")],
            [inlineButton("⬅️ Back to menu", "menu:main")],
          ]),
        },
      );
    }
    return;
  }

  if (step === "setting_quiet_start") {
    ctx.session.step = undefined;
    const hour = parseInt(text, 10);
    if (isNaN(hour) || hour < 0 || hour > 23) {
      await ctx.reply("Please enter a number between 0 and 23.", {
        reply_markup: inlineKeyboard([
          [inlineButton("⚙️ Back to settings", "settings:show")],
        ]),
      });
      return;
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const store = getUserStore();
    const user = await store.get(String(userId));
    if (user) {
      user.quiet_hours = { start: hour, end: (hour + 8) % 24 };
      await store.set(String(userId), user);
    }

    await ctx.reply(
      `🌙 Quiet hours set: ${hour}:00 – ${(hour + 8) % 24}:00.\nYou won't receive alerts during this window.`,
      {
        reply_markup: inlineKeyboard([
          [inlineButton("⚙️ Settings", "settings:show")],
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      },
    );
    return;
  }

  if (step === "setting_summary_time") {
    ctx.session.step = undefined;
    const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(text);
    if (!timeMatch) {
      await ctx.reply("Please enter a valid time (e.g. 08:00).", {
        reply_markup: inlineKeyboard([
          [inlineButton("⚙️ Back to settings", "settings:show")],
        ]),
      });
      return;
    }

    const hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      await ctx.reply("Invalid time. Hour 0–23, minute 0–59.", {
        reply_markup: inlineKeyboard([
          [inlineButton("⚙️ Back to settings", "settings:show")],
        ]),
      });
      return;
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const store = getUserStore();
    const user = await store.get(String(userId));
    if (user) {
      user.summary_time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      await store.set(String(userId), user);
    }

    await ctx.reply(
      `⏰ Morning summary set for ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}.`,
      {
        reply_markup: inlineKeyboard([
          [inlineButton("⚙️ Settings", "settings:show")],
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      },
    );
    return;
  }
});

export default composer;
