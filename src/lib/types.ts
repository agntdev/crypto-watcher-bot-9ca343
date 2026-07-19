export interface UserData {
  telegram_id: number;
  display_name: string;
  quiet_hours: { start: number; end: number } | null;
  summary_time: string | null;
  notification_prefs: { alerts: boolean; summary: boolean };
}

export interface WatchItem {
  ticker: string;
  friendly_name: string;
  coin_id: string;
  user_id: number;
  threshold_alerts: Array<{ threshold: number; direction: "above" | "below" }>;
  percent_move_alerts: Array<{ percent: number; lookback_hours: number }>;
  cooldown_until: number | null;
  last_price: number | null;
  last_price_at: number | null;
}

export interface UserIndex {
  tickers: string[];
}
