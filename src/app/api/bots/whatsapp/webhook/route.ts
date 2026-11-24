import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { parseWhatsAppPayload, sendWhatsAppMessage } from "@/lib/bots/whatsapp";
import { appendAudit } from "@/lib/audit/log";

/** Meta's webhook verification handshake (hub.challenge echo). */
export async function GET(req: NextRequest) {
  const env = getEnv();
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && env.WHATSAPP_VERIFY_TOKEN && token === env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "verification_failed" }, { status: 403 });
}

/** See src/lib/bots/types.ts: acknowledges and links to the web flow, doesn't run it inside the chat. */
export async function POST(req: Request) {
  const env = getEnv();
  if (!env.WHATSAPP_BUSINESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    return NextResponse.json({ error: "whatsapp_not_configured" }, { status: 404 });
  }

  const payload = await req.json().catch(() => null);
  const message = payload ? parseWhatsAppPayload(payload) : null;
  if (!message) return NextResponse.json({ ok: true });

  await appendAudit({
    actorType: "citizen",
    action: "bot_message_received",
    entityType: "bot_message",
    payload: { platform: "whatsapp", hasPhoto: message.hasPhoto, hasLocation: message.hasLocation },
  });

  const reportUrl = new URL("/en/report", req.url).toString();
  const reply = `To report a civic issue, please open this link and follow the steps (photo, location, category): ${reportUrl}`;

  try {
    await sendWhatsAppMessage(env.WHATSAPP_BUSINESS_TOKEN, env.WHATSAPP_PHONE_NUMBER_ID, message.chatId, reply);
  } catch (err) {
    console.error("WhatsApp reply failed", err);
  }

  return NextResponse.json({ ok: true });
}
