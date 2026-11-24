import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 chars"),
  CLASSIFIER_MODEL: z.string().optional().default(""),
  AI_GATEWAY_API_KEY: z.string().optional().default(""),
  VOICE_PROVIDER: z.enum(["bhashini", "sarvam", "browser"]).optional().default("browser"),
  BHASHINI_API_KEY: z.string().optional().default(""),
  SARVAM_API_KEY: z.string().optional().default(""),
  WHATSAPP_BUSINESS_TOKEN: z.string().optional().default(""),
  TELEGRAM_BOT_TOKEN: z.string().optional().default(""),
  OPEN311_ENABLED: z
    .string()
    .optional()
    .default("false")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Lazily validated server-side env. Never import this from client components. */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration:\n${parsed.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n")}`
    );
  }
  cached = parsed.data;
  return cached;
}
