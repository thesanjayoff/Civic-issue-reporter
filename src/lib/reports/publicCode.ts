import { randomBytes } from "crypto";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid misreads when read aloud or copied

export function generatePublicCode(): string {
  const bytes = randomBytes(7);
  let code = "";
  for (const b of bytes) code += CODE_CHARS[b % CODE_CHARS.length];
  return `OK-${code}`;
}
