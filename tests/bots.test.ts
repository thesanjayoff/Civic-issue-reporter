import { describe, it, expect } from "vitest";
import { parseTelegramUpdate } from "@/lib/bots/telegram";
import { parseWhatsAppPayload } from "@/lib/bots/whatsapp";

describe("parseTelegramUpdate", () => {
  it("extracts text, chat id, and location from a Telegram update", () => {
    const parsed = parseTelegramUpdate({
      message: { chat: { id: 123 }, text: "pothole here", location: { latitude: 13.05, longitude: 80.2 } },
    });
    expect(parsed).toEqual({
      platform: "telegram",
      chatId: "123",
      text: "pothole here",
      hasPhoto: false,
      hasLocation: true,
      location: { lat: 13.05, lon: 80.2 },
    });
  });

  it("returns null when there is no message", () => {
    expect(parseTelegramUpdate({})).toBeNull();
  });

  it("detects a photo attachment", () => {
    const parsed = parseTelegramUpdate({ message: { chat: { id: 1 }, photo: [{}, {}] } });
    expect(parsed?.hasPhoto).toBe(true);
  });
});

describe("parseWhatsAppPayload", () => {
  it("extracts the sender, text, and location from a Cloud API webhook payload", () => {
    const parsed = parseWhatsAppPayload({
      entry: [{ changes: [{ value: { messages: [{ from: "919876543210", text: { body: "garbage not collected" } }] } }] }],
    });
    expect(parsed).toEqual({
      platform: "whatsapp",
      chatId: "919876543210",
      text: "garbage not collected",
      hasPhoto: false,
      hasLocation: false,
      location: null,
    });
  });

  it("returns null for a payload with no messages (e.g. a status update)", () => {
    expect(parseWhatsAppPayload({ entry: [{ changes: [{ value: {} }] }] })).toBeNull();
  });
});
