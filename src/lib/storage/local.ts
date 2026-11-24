/**
 * Local-disk media storage. Stands in for a real object store (Vercel Blob,
 * S3, etc.) so the app is fully runnable without cloud credentials — swap
 * this module for a Blob-backed one before deploying anywhere with an
 * ephemeral or read-only filesystem (e.g. most serverless platforms).
 * Production should also serve these through signed, time-limited URLs per
 * the security principles; this local version intentionally does not, and
 * that gap is called out in README "Known limitations".
 */
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

const UPLOADS_DIR = join(process.cwd(), "public", "uploads");

export function savePhotoBuffer(buffer: Buffer): { storageKey: string; publicUrl: string } {
  if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });
  const filename = `${randomUUID()}.jpg`;
  writeFileSync(join(UPLOADS_DIR, filename), buffer);
  return { storageKey: filename, publicUrl: `/uploads/${filename}` };
}
