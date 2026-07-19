# Crypto Watcher Bot — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A private Telegram bot for tracking crypto price alerts with customizable thresholds, percent-move triggers, and cooldowns. Users manage watchlists via inline buttons or typed tickers, receive smart alerts, and set quiet hours. The bot owner gets anonymized usage metrics and an alerts leaderboard.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- individual crypto watchers
- non-technical Telegram users

## Success criteria

- Users can add/remove crypto tickers to their private watchlist
- Alerts trigger reliably with configured thresholds/percent-moves
- Cooldowns prevent repeated alerts during oscillations
- Owner receives daily aggregated metrics without personal data exposure

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Onboarding and main menu
- **/price** (command, actor: user, command: /price) — Check price of specific ticker or full watchlist
  - inputs: ticker symbol
  - outputs: current price data
- **/summary** (command, actor: user, command: /summary) — Request immediate price summary
- **/settings** (command, actor: user, command: /settings) — Configure quiet hours, summary time, and alert preferences
- **/help** (command, actor: user, command: /help) — Show usage tips
- **Add preset coin** (button, actor: user, callback: add_preset) — Add Bitcoin/Ethereum/Toncoin to watchlist

## Flows

### Onboarding
_Trigger:_ /start

1. Show preset coin buttons
2. Display watchlist management instructions
3. Offer quick tour of commands

_Data touched:_ User

### Watchlist management
_Trigger:_ inline button or /price command

1. Validate ticker input
2. Add/remove watch items
3. Edit alert rules

_Data touched:_ Watch item, User

### Alert triggering
_Trigger:_ Price update event

1. Check all user alert rules
2. Send alert if conditions met
3. Apply cooldown to prevent repeats

_Data touched:_ Watch item, Alert rule

### Morning summary
_Trigger:_ Scheduled daily time

1. Check user's quiet hours
2. Generate price summary and movers
3. Send if outside quiet hours

_Data touched:_ User, Watch item

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **User** _(retention: persistent)_ — Telegram user with private preferences and watchlist
  - fields: telegram_id, display_name, quiet_hours, summary_time, notification_prefs
- **Watch item** _(retention: persistent)_ — Crypto ticker with alert rules and cooldown metadata
  - fields: ticker, friendly_name, threshold_alerts, percent_move_alerts, cooldown_until
- **Global presets** _(retention: session)_ — Common coin buttons (BTC, ETH, TON)
  - fields: ticker, display_name
- **Owner dashboard** _(retention: persistent)_ — Aggregated metrics and alert leaderboard
  - fields: active_users, total_watch_items, top_alerts

## Integrations

- **Telegram** (required) — Bot API messaging and user interactions
- **Price feed API** (required) — Market price data with retries
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- View aggregated user counts
- Request current alert leaderboard
- Access daily summary metrics

## Notifications

- Price alerts with change details
- Daily morning summaries
- Owner metrics updates

## Permissions & privacy

- All user data is private and isolated
- Owner only sees aggregated metrics
- No personal data in alert leaderboard

## Edge cases

- Unknown ticker input handling
- Price feed failures with retries
- Alert triggering during quiet hours
- Multiple alert rules firing simultaneously

## Required tests

- Verify alert cooldowns prevent repeated notifications
- Test summary delivery during/after quiet hours
- Validate preset button watchlist management

## Assumptions

- Default 1-hour lookback for percent-move alerts
- 6-hour cooldown for threshold alerts
- Morning summary skipped if inside quiet hours
