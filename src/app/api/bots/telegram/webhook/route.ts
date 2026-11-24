import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { parseTelegramUpdate, sendTelegramMessage } from "@/lib/bots/telegram";
import { appendAudit } from "@/lib/audit/log";

/**
 * Acknowledges incoming Telegram messages and replies with a link to the web
 * report flow — it does not run the full report-capture flow inside the
 * chat. See src/lib/bots/types.ts for why, and README "Known limitations".
 */
export async function POST(req: Request) {
  const env = getEnv();
  if (!env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: "telegram_not_configured" }, { status: 404 });
  }

  const update = await req.json().catch(() => null);
  const message = update ? parseTelegramUpdate(update) : null;
  if (!message) return NextResponse.json({ ok: true });

  await appendAudit({
    actorType: "citizen",
    action: "bot_message_received",
    entityType: "bot_message",
    payload: { platform: "telegram", hasPhoto: message.hasPhoto, hasLocation: message.hasLocation },
  });

  const reportUrl = new URL("/en/report", req.url).toString();
  const reply = message.hasLocation
    ? `Thanks — to finish filing this with a photo and category, please continue here: ${reportUrl}`
    : `To report a civic issue, please open this link and follow the steps (photo, location, category): ${reportUrl}`;

  try {
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, message.chatId, reply);
  } catch (err) {
    console.error("Telegram reply failed", err);
  }

  return NextResponse.json({ ok: true });
}
