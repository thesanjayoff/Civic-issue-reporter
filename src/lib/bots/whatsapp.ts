import type { NormalizedIntakeMessage } from "./types";

interface WhatsAppWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from: string;
          text?: { body: string };
          image?: unknown;
          location?: { latitude: number; longitude: number };
        }>;
      };
    }>;
  }>;
}

export function parseWhatsAppPayload(payload: WhatsAppWebhookPayload): NormalizedIntakeMessage | null {
  const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return null;
  return {
    platform: "whatsapp",
    chatId: message.from,
    text: message.text?.body ?? null,
    hasPhoto: Boolean(message.image),
    hasLocation: Boolean(message.location),
    location: message.location ? { lat: message.location.latitude, lon: message.location.longitude } : null,
  };
}

/** Real WhatsApp Cloud API call — untested against a live Business account in this environment (no WHATSAPP_BUSINESS_TOKEN configured here). */
export async function sendWhatsAppMessage(businessToken: string, phoneNumberId: string, to: string, text: string): Promise<void> {
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${businessToken}` },
    body: JSON.stringify({ messaging_product: "whatsapp", to, text: { body: text } }),
  });
  if (!res.ok) {
    throw new Error(`WhatsApp sendMessage failed: HTTP ${res.status}`);
  }
}
