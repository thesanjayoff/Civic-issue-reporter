/**
 * Offline report queue. Drafts are saved to IndexedDB on submit failure (or
 * when the browser is already offline) and flushed on the next 'online'
 * event — deliberately not the Background Sync API, which isn't reliably
 * supported on iOS Safari, a browser this app has to work on.
 */
import { openDB, type IDBPDatabase } from "idb";
import type { CreateReportInput } from "@/lib/reports/create";

const DB_NAME = "ooru-kural-offline";
const DB_VERSION = 1;
const STORE = "queued-reports";

export interface QueuedReport {
  id: string; // client-generated, stable across retries
  payload: CreateReportInput;
  queuedAt: string;
  lastError?: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function queueReport(payload: CreateReportInput, lastError?: string): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const entry: QueuedReport = { id, payload, queuedAt: new Date().toISOString(), lastError };
  await db.put(STORE, entry);
  return id;
}

export async function listQueuedReports(): Promise<QueuedReport[]> {
  const db = await getDb();
  return db.getAll(STORE);
}

export async function removeQueuedReport(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, id);
}

export async function queuedReportCount(): Promise<number> {
  const db = await getDb();
  return db.count(STORE);
}
