import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  registerMainMenuItem,
  inlineButton,
  inlineKeyboard,
} from "../toolkit/index.js";
import { getUserStore } from "../lib/store.js";

registerMainMenuItem({
  label: "⚙️ Settings",
  data: "settings:show",
  order: 30,
});

const composer = new Composer<Ctx>();

composer.command("settings", async (ctx) => {
  await showSettings(ctx);
});

composer.callbackQuery("settings:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showSettings(ctx);
});

async function showSettings(ctx: Ctx) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const store = getUserStore();
  const user = await store.get(String(userId));

  if (!user) {
    await store.set(String(userId), {
      telegram_id: userId,
      display_name: ctx.from?.first_name ?? "User",
      quiet_hours: null,
      summary_time: null,
      notification_prefs: { alerts: true, summary: true },
    });
  }

  const fresh = await store.get(String(userId));
  const quietStr = fresh?.quiet_hours
    ? `${fresh.quiet_hours.start}:00 – ${fresh.quiet_hours.end}:00`
    : "Not set";
  const summaryStr = fresh?.summary_time ?? "Not set";
  const alertsStr = fresh?.notification_prefs?.alerts ? "On" : "Off";
  const summaryPrefStr = fresh?.notification_prefs?.summary ? "On" : "Off";

  const text =
    `Your settings:\n\n` +
    `Quiet hours: ${quietStr}\n` +
    `Morning summary: ${summaryStr}\n` +
    `Price alerts: ${alertsStr}\n` +
    `Daily summary: ${summaryPrefStr}`;

  const kb = inlineKeyboard([
    [inlineButton("🌙 Quiet hours", "settings:quiet")],
    [inlineButton("⏰ Summary time", "settings:summary_time")],
    [
      inlineButton(
        `🔔 Alerts: ${fresh?.notification_prefs?.alerts ? "On" : "Off"}`,
        "settings:toggle_alerts",
      ),
    ],
    [
      inlineButton(
        `📅 Summary: ${fresh?.notification_prefs?.summary ? "On" : "Off"}`,
        "settings:toggle_summary",
      ),
    ],
    [inlineButton("⬅️ Back to menu", "menu:main")],
  ]);

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { reply_markup: kb });
  } else {
    await ctx.reply(text, { reply_markup: kb });
  }
}

composer.callbackQuery("settings:quiet", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "setting_quiet_start";
  await ctx.reply("What hour do quiet hours start? (0–23, e.g. 22 for 10 PM)", {
    reply_markup: {
      force_reply: true,
      input_field_placeholder: "Enter hour (0–23)…",
    },
  });
});

composer.callbackQuery("settings:summary_time", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "setting_summary_time";
  await ctx.reply(
    "What time should the morning summary arrive? (e.g. 08:00)",
    {
      reply_markup: {
        force_reply: true,
        input_field_placeholder: "Enter time (HH:MM)…",
      },
    },
  );
});

composer.callbackQuery("settings:toggle_alerts", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;

  const store = getUserStore();
  const user = await store.get(String(userId));
  if (user) {
    user.notification_prefs.alerts = !user.notification_prefs.alerts;
    await store.set(String(userId), user);
  }

  await showSettings(ctx);
});

composer.callbackQuery("settings:toggle_summary", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;

  const store = getUserStore();
  const user = await store.get(String(userId));
  if (user) {
    user.notification_prefs.summary = !user.notification_prefs.summary;
    await store.set(String(userId), user);
  }

  await showSettings(ctx);
});

export default composer;
