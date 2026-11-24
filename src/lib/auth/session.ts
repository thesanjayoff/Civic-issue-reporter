/**
 * Minimal pseudonymous device identity. No login is required to file a
 * report — per the privacy principle ("collect the minimum personal data"),
 * we identify a browser/installed-PWA by a signed, random device id cookie,
 * never by phone number or precise identity. A `users` row (with an email/
 * phone hash, a role, reputation) is optional and only created when someone
 * explicitly creates an account (e.g. to become a verified volunteer).
 */
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { getEnv } from "@/lib/env";
import { db } from "@/lib/db/client";
import { devices } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

const COOKIE_NAME = "ok_device";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 5; // 5 years — this is a pseudonymous device id, not a login session

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().SESSION_SECRET);
}

async function signDeviceToken(deviceId: string): Promise<string> {
  return new SignJWT({ deviceId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

async function verifyDeviceToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return typeof payload.deviceId === "string" ? payload.deviceId : null;
  } catch {
    return null;
  }
}

/**
 * Reads the device id from the signed cookie, creating both a fresh id and
 * its `devices` row on first visit. Call only from a Server Component,
 * Server Action, or Route Handler (needs cookie write access).
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(COOKIE_NAME)?.value;
  const verified = existing ? await verifyDeviceToken(existing) : null;

  if (verified) {
    await db.update(devices).set({ lastSeenAt: sql`now()` }).where(eq(devices.id, verified));
    return verified;
  }

  const deviceId = randomUUID();
  await db.insert(devices).values({ id: deviceId });
  const token = await signDeviceToken(deviceId);
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
  return deviceId;
}

/** Read-only variant for contexts that can't write cookies (e.g. during static rendering) — returns null if no valid cookie exists yet. */
export async function peekDeviceId(): Promise<string | null> {
  const jar = await cookies();
  const existing = jar.get(COOKIE_NAME)?.value;
  if (!existing) return null;
  return verifyDeviceToken(existing);
}
