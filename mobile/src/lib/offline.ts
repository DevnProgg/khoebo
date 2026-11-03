import { Platform } from 'react-native';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

export interface QueuedRequest {
  id: number;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body: unknown;
  auth: boolean;
}

interface CachedResponse {
  payload: string;
}

let databasePromise: Promise<SQLiteDatabase | null> | null = null;

async function getDatabase(): Promise<SQLiteDatabase | null> {
  if (Platform.OS === 'web') return null;
  if (!databasePromise) {
    databasePromise = openDatabaseAsync('khoebo-offline.db').then(async (database) => {
      await database.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS response_cache (
          cache_key TEXT PRIMARY KEY NOT NULL,
          payload TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS request_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          method TEXT NOT NULL,
          path TEXT NOT NULL,
          body TEXT,
          auth INTEGER NOT NULL,
          created_at INTEGER NOT NULL
        );
      `);
      return database;
    });
  }
  return databasePromise;
}

export function cacheKey(path: string): string {
  return `GET:${path}`;
}

export async function cacheResponse(key: string, value: unknown): Promise<void> {
  const database = await getDatabase();
  if (!database) return;
  await database.runAsync(
    `INSERT INTO response_cache (cache_key, payload, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    key,
    JSON.stringify(value),
    Date.now(),
  );
}

export async function getCachedResponse<T>(key: string): Promise<T | null> {
  const database = await getDatabase();
  if (!database) return null;
  const row = await database.getFirstAsync<CachedResponse>(
    'SELECT payload FROM response_cache WHERE cache_key = ?',
    key,
  );
  if (!row) return null;
  try {
    return JSON.parse(row.payload) as T;
  } catch {
    return null;
  }
}

export async function enqueueRequest(request: Omit<QueuedRequest, 'id'>): Promise<void> {
  const database = await getDatabase();
  if (!database) return;
  await database.runAsync(
    `INSERT INTO request_queue (method, path, body, auth, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    request.method,
    request.path,
    request.body === undefined ? null : JSON.stringify(request.body),
    request.auth ? 1 : 0,
    Date.now(),
  );
}

export async function getQueuedRequests(): Promise<QueuedRequest[]> {
  const database = await getDatabase();
  if (!database) return [];
  const rows = await database.getAllAsync<{
    id: number;
    method: QueuedRequest['method'];
    path: string;
    body: string | null;
    auth: number;
  }>('SELECT id, method, path, body, auth FROM request_queue ORDER BY id ASC');
  return rows.map((row) => ({
    id: row.id,
    method: row.method,
    path: row.path,
    body: row.body ? JSON.parse(row.body) : undefined,
    auth: row.auth === 1,
  }));
}

export async function removeQueuedRequest(id: number): Promise<void> {
  const database = await getDatabase();
  if (!database) return;
  await database.runAsync('DELETE FROM request_queue WHERE id = ?', id);
}

export async function getQueuedRequestCount(): Promise<number> {
  const database = await getDatabase();
  if (!database) return 0;
  const row = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM request_queue',
  );
  return row?.count ?? 0;
}
