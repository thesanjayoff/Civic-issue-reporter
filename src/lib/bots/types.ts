/**
 * Messaging-bot intake. Scope is intentionally limited: these webhooks
 * acknowledge an incoming message and reply with a link to the web report
 * form, rather than running the full multi-step report flow (photo, pin
 * placement, category, blur tool) inside a chat turn — that would need a
 * real per-chat conversation-state machine, which is out of scope for this
 * build. See README "Known limitations / messaging bots" for what a real
 * implementation would still need (verified WhatsApp Business/Telegram
 * credentials, which this environment doesn't have, and conversation-state
 * storage).
 */
export interface NormalizedIntakeMessage {
  platform: "whatsapp" | "telegram";
  chatId: string;
  text: string | null;
  hasPhoto: boolean;
  hasLocation: boolean;
  location: { lat: number; lon: number } | null;
}
