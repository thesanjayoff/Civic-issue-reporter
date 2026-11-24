import type { NormalizedIntakeMessage } from "./types";

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
    photo?: unknown[];
    location?: { latitude: number; longitude: number };
  };
}

export function parseTelegramUpdate(update: TelegramUpdate): NormalizedIntakeMessage | null {
  const message = update.message;
  if (!message) return null;
  return {
    platform: "telegram",
    chatId: String(message.chat.id),
    text: message.text ?? null,
    hasPhoto: Boolean(message.photo?.length),
    hasLocation: Boolean(message.location),
    location: message.location ? { lat: message.location.latitude, lon: message.location.longitude } : null,
  };
}

/** Real Telegram Bot API call — untested against a live bot in this environment (no TELEGRAM_BOT_TOKEN configured here). */
export async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) {
    throw new Error(`Telegram sendMessage failed: HTTP ${res.status}`);
  }
}
