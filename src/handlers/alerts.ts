import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getUserStore, getWatchStore, getIndexStore } from "../lib/store.js";
import { getMultiplePrices } from "../lib/price-api.js";
import { now } from "../lib/clock.js";

const COM_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

const composer = new Composer<Ctx>();

composer.callbackQuery("alerts:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;

  const index = await getIndexStore().get(String(userId));
  const tickers = index?.tickers ?? [];

  if (tickers.length === 0) {
    await ctx.editMessageText(
      "No alerts — your watchlist is empty.\n\nAdd coins first, then set alert rules.",
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
    const alertCount =
      (item?.threshold_alerts?.length ?? 0) +
      (item?.percent_move_alerts?.length ?? 0);
    const label =
      alertCount > 0
        ? `${name} (${ticker}) — ${alertCount} rule${alertCount === 1 ? "" : "s"}`
        : `${name} (${ticker})`;
    rows.push([inlineButton(label, `alerts:manage:${ticker}`)]);
  }

  rows.push([inlineButton("⬅️ Back to menu", "menu:main")]);

  await ctx.editMessageText("Alert rules for your watchlist:", {
    reply_markup: inlineKeyboard(rows),
  });
});

composer.callbackQuery(/^alerts:manage:(\w+)$/, async (ctx) => {
  const match = ctx.match;
  if (!match) return;

  const ticker = match[1].toUpperCase();
  const userId = ctx.from?.id;
  if (!userId) return;

  await ctx.answerCallbackQuery();

  const item = await getWatchStore().get(`${userId}:${ticker}`);
  const name = item?.friendly_name ?? ticker;

  const lines: string[] = [`Alert rules for ${name} (${ticker}):`];

  if (item?.threshold_alerts?.length) {
    lines.push("\nThreshold alerts:");
    for (const rule of item.threshold_alerts) {
      lines.push(
        `  ${rule.direction === "above" ? "↑" : "↓"} $${rule.threshold}`,
      );
    }
  }

  if (item?.percent_move_alerts?.length) {
    lines.push("\nPercent move alerts:");
    for (const rule of item.percent_move_alerts) {
      lines.push(`  ${rule.percent}% in ${rule.lookback_hours}h`);
    }
  }

  if (
    (!item?.threshold_alerts?.length || item.threshold_alerts.length === 0) &&
    (!item?.percent_move_alerts?.length || item.percent_move_alerts.length === 0)
  ) {
    lines.push("\nNo alert rules set.");
  }

  await ctx.editMessageText(lines.join("\n"), {
    reply_markup: inlineKeyboard([
      [inlineButton("⬆️ Add threshold", `alerts:add_threshold:${ticker}`)],
      [
        inlineButton(
          "📊 Add percent move",
          `alerts:add_percent:${ticker}`,
        ),
      ],
      [inlineButton("🗑 Clear all rules", `alerts:clear:${ticker}`)],
      [inlineButton("⬅️ Back to alerts", "alerts:show")],
    ]),
  });
});

composer.callbackQuery(/^alerts:add_threshold:(\w+)$/, async (ctx) => {
  const match = ctx.match;
  if (!match) return;

  const ticker = match[1].toUpperCase();
  const userId = ctx.from?.id;
  if (!userId) return;

  await ctx.answerCallbackQuery();

  await ctx.editMessageText(
    `Set a threshold alert for ${ticker}.\n\nWhen the price goes above or below a level, you'll get notified.\n\nType the price level (e.g. 50000):`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("❌ Cancel", `alerts:manage:${ticker}`)],
      ]),
    },
  );

  ctx.session.step = "adding_threshold" as never;
  ctx.session.temp = { ticker };
});

composer.callbackQuery(/^alerts:add_percent:(\w+)$/, async (ctx) => {
  const match = ctx.match;
  if (!match) return;

  const ticker = match[1].toUpperCase();
  const userId = ctx.from?.id;
  if (!userId) return;

  await ctx.answerCallbackQuery();

  const watchStore = getWatchStore();
  const item = await watchStore.get(`${userId}:${ticker}`);
  if (item) {
    item.percent_move_alerts = [
      ...(item.percent_move_alerts ?? []),
      { percent: 5, lookback_hours: 1 },
    ];
    await watchStore.set(`${userId}:${ticker}`, item);
  }

  await ctx.editMessageText(
    `✅ Added a 5% move alert for ${ticker}. You'll be notified when the price moves 5% within 1 hour.`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to alerts", "alerts:show")],
      ]),
    },
  );
});

composer.callbackQuery(/^alerts:clear:(\w+)$/, async (ctx) => {
  const match = ctx.match;
  if (!match) return;

  const ticker = match[1].toUpperCase();
  const userId = ctx.from?.id;
  if (!userId) return;

  await ctx.answerCallbackQuery();

  const watchStore = getWatchStore();
  const item = await watchStore.get(`${userId}:${ticker}`);
  if (item) {
    item.threshold_alerts = [];
    item.percent_move_alerts = [];
    await watchStore.set(`${userId}:${ticker}`, item);
  }

  await ctx.editMessageText(`All alert rules for ${ticker} cleared.`, {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to alerts", "alerts:show")],
    ]),
  });
});

export async function checkAlerts(userId: number): Promise<void> {
  const userStore = getUserStore();
  const user = await userStore.get(String(userId));
  if (!user?.notification_prefs?.alerts) return;

  const quietHours = user.quiet_hours;
  if (quietHours) {
    const currentHour = now().getHours();
    const { start, end } = quietHours;
    const inQuiet =
      start <= end
        ? currentHour >= start && currentHour < end
        : currentHour >= start || currentHour < end;
    if (inQuiet) return;
  }

  const index = await getIndexStore().get(String(userId));
  const tickers = index?.tickers ?? [];
  if (tickers.length === 0) return;

  try {
    const prices = await getMultiplePrices(tickers);
    const watchStore = getWatchStore();

    for (const p of prices) {
      const item = await watchStore.get(`${userId}:${p.ticker}`);
      if (!item) continue;

      const currentTime = now().getTime();
      if (item.cooldown_until && currentTime < item.cooldown_until) continue;

      let alerted = false;

      for (const rule of item.threshold_alerts ?? []) {
        if (
          (rule.direction === "above" && p.price_usd > rule.threshold) ||
          (rule.direction === "below" && p.price_usd < rule.threshold)
        ) {
          alerted = true;
          break;
        }
      }

      if (!alerted) {
        for (const rule of item.percent_move_alerts ?? []) {
          if (
            item.last_price &&
            item.last_price_at &&
            currentTime - item.last_price_at <
              rule.lookback_hours * 60 * 60 * 1000
          ) {
            const change =
              ((p.price_usd - item.last_price) / item.last_price) * 100;
            if (Math.abs(change) >= rule.percent) {
              alerted = true;
              break;
            }
          }
        }
      }

      if (alerted) {
        item.cooldown_until = currentTime + COM_COOLDOWN_MS;
        await watchStore.set(`${userId}:${p.ticker}`, item);
      }

      item.last_price = p.price_usd;
      item.last_price_at = currentTime;
      await watchStore.set(`${userId}:${p.ticker}`, item);
    }
  } catch {
    // API failure — skip alert check silently
  }
}

export default composer;
