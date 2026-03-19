import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const database = await SQLite.openDatabaseAsync('aid.db');
    await initSchema(database);
    db = database;
    return database;
  })();
  return initPromise;
}

async function initSchema(database: SQLite.SQLiteDatabase) {
  await database.runAsync('PRAGMA busy_timeout = 5000');
  await database.runAsync('PRAGMA journal_mode = WAL');
  await database.runAsync('PRAGMA synchronous = NORMAL');
  await database.runAsync(
    `CREATE TABLE IF NOT EXISTS recipients (
      name TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at TEXT,
      synced INTEGER DEFAULT 1,
      created_locally INTEGER DEFAULT 0
    )`
  );
  await database.runAsync(
    `CREATE TABLE IF NOT EXISTS aids (
      name TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at TEXT,
      synced INTEGER DEFAULT 1,
      created_locally INTEGER DEFAULT 0
    )`
  );
  await database.runAsync(
    'CREATE INDEX IF NOT EXISTS idx_recipients_synced ON recipients(synced, created_locally)'
  );
  await database.runAsync(
    'CREATE INDEX IF NOT EXISTS idx_aids_synced ON aids(synced, created_locally)'
  );
}

export interface RecipientRow {
  name: string;
  data: string;
  created_at: string | null;
  synced: number;
  created_locally: number;
}

export interface AidRow {
  name: string;
  data: string;
  created_at: string | null;
  synced: number;
  created_locally: number;
}

/** Insert or replace a recipient. */
export async function upsertRecipient(record: Record<string, any>) {
  const database = await getDb();
  const name =
    record.name ?? record.id ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const data = JSON.stringify(record);
  const created_at = record.creation ?? record.created_at ?? new Date().toISOString();
  const synced = record.synced === true || record.created_locally !== true ? 1 : 0;
  const created_locally = record.created_locally === true ? 1 : 0;

  await database.runAsync(
    `INSERT OR REPLACE INTO recipients (name, data, created_at, synced, created_locally)
     VALUES (?, ?, ?, ?, ?)`,
    name,
    data,
    created_at,
    synced,
    created_locally
  );
}

/** Insert or replace an AID record. */
export async function upsertAid(record: Record<string, any>) {
  const database = await getDb();
  const name = record.name ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const data = JSON.stringify(record);
  const created_at = new Date().toISOString();
  const synced = record.synced === true || record.created_locally !== true ? 1 : 0;
  const created_locally = record.created_locally === true ? 1 : 0;

  await database.runAsync(
    `INSERT OR REPLACE INTO aids (name, data, created_at, synced, created_locally)
     VALUES (?, ?, ?, ?, ?)`,
    name,
    data,
    created_at,
    synced,
    created_locally
  );
}

/** Bulk upsert recipients. Uses runAsync to avoid prepareAsync NullPointerException on Android. */
export async function bulkUpsertRecipients(records: Record<string, any>[]) {
  if (records.length === 0) return;
  const database = await getDb();
  const sql = `INSERT OR REPLACE INTO recipients (name, data, created_at, synced, created_locally) VALUES (?, ?, ?, ?, ?)`;
  for (const r of records) {
    const name = r.name ?? r.id ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const data = JSON.stringify(r);
    const created_at = r.creation ?? r.created_at ?? new Date().toISOString();
    const synced = r.synced === true || r.created_locally !== true ? 1 : 0;
    const created_locally = r.created_locally === true ? 1 : 0;
    await database.runAsync(sql, name, data, created_at, synced, created_locally);
  }
}

/** Bulk upsert AIDs. Uses runAsync to avoid prepareAsync NullPointerException on Android. */
export async function bulkUpsertAids(records: Record<string, any>[]) {
  if (records.length === 0) return;
  const database = await getDb();
  const sql = `INSERT OR REPLACE INTO aids (name, data, created_at, synced, created_locally) VALUES (?, ?, ?, ?, ?)`;
  for (const r of records) {
    const name = r.name ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const data = JSON.stringify(r);
    const created_at = r.creation ?? r.aid_date ?? new Date().toISOString();
    const synced = r.synced === true || r.created_locally !== true ? 1 : 0;
    const created_locally = r.created_locally === true ? 1 : 0;
    await database.runAsync(sql, name, data, created_at, synced, created_locally);
  }
}

/** Get all recipients as plain objects. */
export async function getAllRecipients(): Promise<Record<string, any>[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<RecipientRow>(
    'SELECT data FROM recipients ORDER BY created_at DESC'
  );
  return rows.map((row: RecipientRow) => JSON.parse(row.data));
}

/** Get recipients paginated with optional search. Fetches 20 by 20 for performance. */
export async function getRecipientsPaginated(
  limit: number,
  offset: number,
  search?: string
): Promise<Record<string, any>[]> {
  const database = await getDb();
  let sql = 'SELECT data FROM recipients';
  const params: (string | number)[] = [];

  if (search?.trim()) {
    const term = '%' + search.trim() + '%';
    sql += ' WHERE data LIKE ?';
    params.push(term);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = await database.getAllAsync<RecipientRow>(sql, ...params);
  return rows.map((row: RecipientRow) => JSON.parse(row.data));
}

/** Get total recipients count with optional search. */
export async function getRecipientsCount(search?: string): Promise<number> {
  const database = await getDb();
  let sql = 'SELECT COUNT(*) as cnt FROM recipients';
  const params: string[] = [];

  if (search?.trim()) {
    sql += ' WHERE data LIKE ?';
    params.push('%' + search.trim() + '%');
  }

  const row = await database.getFirstAsync<{ cnt: number }>(sql, ...params);
  return row?.cnt ?? 0;
}

/** Get all AIDs as plain objects. */
export async function getAllAids(): Promise<Record<string, any>[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<AidRow>('SELECT data FROM aids ORDER BY created_at DESC');
  return rows.map((row: AidRow) => JSON.parse(row.data));
}

/** Get AIDs paginated with optional search and category filter. */
export async function getAidsPaginated(
  limit: number,
  offset: number,
  opts?: { search?: string; categoryField?: string; categoryValue?: string }
): Promise<Record<string, any>[]> {
  const database = await getDb();
  let sql = 'SELECT data FROM aids';
  const params: (string | number)[] = [];
  const conditions: string[] = [];

  if (opts?.search?.trim()) {
    conditions.push('data LIKE ?');
    params.push('%' + opts.search.trim() + '%');
  }

  const safeFields = ['nature_of_aid', 'eligibility_status'];
  if (opts?.categoryField && opts?.categoryValue && safeFields.includes(opts.categoryField)) {
    conditions.push("json_extract(data, '$." + opts.categoryField + "') = ?");
    params.push(opts.categoryValue);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = await database.getAllAsync<AidRow>(sql, ...params);
  return rows.map((row: AidRow) => JSON.parse(row.data));
}

/** Get total AIDs count with optional search and category filter. */
export async function getAidsCount(opts?: {
  search?: string;
  categoryField?: string;
  categoryValue?: string;
}): Promise<number> {
  const database = await getDb();
  let sql = 'SELECT COUNT(*) as cnt FROM aids';
  const params: string[] = [];
  const conditions: string[] = [];

  if (opts?.search?.trim()) {
    conditions.push('data LIKE ?');
    params.push('%' + opts.search.trim() + '%');
  }

  const safeFields = ['nature_of_aid', 'eligibility_status'];
  if (opts?.categoryField && opts?.categoryValue && safeFields.includes(opts.categoryField)) {
    conditions.push("json_extract(data, '$." + opts.categoryField + "') = ?");
    params.push(opts.categoryValue);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  const row = await database.getFirstAsync<{ cnt: number }>(sql, ...params);
  return row?.cnt ?? 0;
}

/** Get unsynced recipients. */
export async function getUnsyncedRecipients(): Promise<Record<string, any>[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<RecipientRow>(
    'SELECT data FROM recipients WHERE synced = 0 OR created_locally = 1'
  );
  return rows.map((row: RecipientRow) => JSON.parse(row.data));
}

/** Get unsynced AIDs. */
export async function getUnsyncedAids(): Promise<Record<string, any>[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<AidRow>(
    'SELECT data FROM aids WHERE synced = 0 OR created_locally = 1'
  );
  return rows.map((row: AidRow) => JSON.parse(row.data));
}

/** Update a recipient (e.g. after server sync). Handles name change when local->server. */
export async function updateRecipient(nameOrId: string, updates: Partial<Record<string, any>>) {
  const database = await getDb();
  const row = await database.getFirstAsync<RecipientRow>(
    'SELECT * FROM recipients WHERE name = ?',
    nameOrId
  );
  if (!row) return;
  const current = JSON.parse(row.data);
  const merged = { ...current, ...updates };
  const newName = merged.name ?? merged.id ?? nameOrId;

  if (newName !== nameOrId) {
    // If the name changed (local ID -> server name), update all references in 'aids' table
    await database.runAsync('DELETE FROM recipients WHERE name = ?', nameOrId);
    await database.runAsync(
      "UPDATE aids SET data = json_set(data, '$.recipient', ?) WHERE json_extract(data, '$.recipient') = ?",
      newName,
      nameOrId
    );
  }
  await upsertRecipient(merged);
}

/** Update an AID record (e.g. after server sync). Handles name change when local->server. */
export async function updateAid(name: string, updates: Partial<Record<string, any>>) {
  const database = await getDb();
  const row = await database.getFirstAsync<AidRow>('SELECT * FROM aids WHERE name = ?', name);
  if (!row) return;
  const current = JSON.parse(row.data);
  const merged = { ...current, ...updates };
  const newName = merged.name ?? name;
  if (newName !== name) {
    await database.runAsync('DELETE FROM aids WHERE name = ?', name);
  }
  await upsertAid(merged);
}

/** Replace all recipients (used for full sync). */
export async function replaceAllRecipients(records: Record<string, any>[]) {
  const database = await getDb();
  await database.runAsync('DELETE FROM recipients');
  await bulkUpsertRecipients(records);
}

/** Replace all AIDs (used for full sync). */
export async function replaceAllAids(records: Record<string, any>[]) {
  const database = await getDb();
  await database.runAsync('DELETE FROM aids');
  await bulkUpsertAids(records);
}
