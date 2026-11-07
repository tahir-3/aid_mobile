import { bulkInsertAids, getDoctypeCount, getDoctypeList, insertDoc } from './api';
import { frappeMessage } from './apiError';
import { storage } from './storage';
import {
  bulkUpsertRecipients,
  bulkUpsertAids,
  getUnsyncedRecipients,
  getUnsyncedAids,
  updateRecipient,
  updateAid,
  getAllRecipients,
  getAllAids,
  getRecipientsPaginated,
  getRecipientsCount,
  getAidsPaginated,
  getAidsCount,
  getDashboardStats,
} from './db';

export {
  getRecipientsPaginated,
  getRecipientsCount,
  getAidsPaginated,
  getAidsCount,
  getDashboardStats,
};
export type { DashboardStats, LabelCount } from './db';

// Storage keys for each doctype
export const STORAGE_KEYS = {
  RECIPIENTS: 'data_Recipient',
  ACCOMMODATION: 'data_Accommodation',
  AID_RECIPIENT_MASJED: 'data_Aid_Recipient_Masjed',
  AID_RECIPIENT_BRANCH: 'data_Aid_Recipient_Branch',
  AID: 'data_AID',
  AID_TYPE: 'data_AID_Type',
  AID_ORGANIZATION: 'data_AID_Organization',
  ACCOMMODATION_PROJECT: 'data_Accommodation_Project',
  ACCOMMODATION_Branch_Project: 'data_Accommodation_Branch_Project',
  LAST_SYNC: 'last_sync_timestamp',
};

const AID_FIELDS = [
  'name',
  'creation',
  'recipient_type',
  'recipient',
  'branch',
  'aid_type',
  'organization_name',
  'aid_date',
  'eligibility_status',
  'nature_of_aid',
];

const SMALL_DOCTYPES = [
  {
    key: STORAGE_KEYS.ACCOMMODATION,
    doctype: 'Accommodation',
    fields: ['name', 'representative_name'],
    label: 'السكن',
  },
  {
    key: STORAGE_KEYS.AID_RECIPIENT_MASJED,
    doctype: 'AID Recipient Masjed',
    fields: ['name', 'branch'],
    label: 'مساجد المستفيدين',
  },
  {
    key: STORAGE_KEYS.AID_RECIPIENT_BRANCH,
    doctype: 'AID Recipient Branch',
    fields: ['name'],
    label: 'فروع المستفيدين',
  },
  {
    key: STORAGE_KEYS.AID_TYPE,
    doctype: 'AID Type',
    fields: ['name'],
    label: 'أنواع المساعدات',
  },
  {
    key: STORAGE_KEYS.AID_ORGANIZATION,
    doctype: 'AID Organization',
    fields: ['name'],
    label: 'المنظمات',
  },
  {
    key: STORAGE_KEYS.ACCOMMODATION_PROJECT,
    doctype: 'Accommodation Project',
    fields: ['name'],
    label: 'مشاريع الاياءات',
  },
  {
    key: STORAGE_KEYS.ACCOMMODATION_Branch_Project,
    doctype: 'Branch Project',
    fields: ['name'],
    label: 'مشاريع الشعبة',
  },
];

/** Convert ISO date to Frappe-compatible format: YYYY-MM-DD HH:MM:SS */
function toFrappeCreationFilter(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

type ProgressFn = (progress: number, message: string) => void;

/** First chunk is small so lists fill instantly; the rest downloads in bigger chunks. */
const FIRST_CHUNK = 20;
const CHUNK = 500;

/**
 * Pull records created after `lastSyncDate` (all records on first sync) in chunks,
 * newest first. Every chunk is written to SQLite immediately and `onChunk` fires,
 * so screens can show data while the rest is still downloading.
 */
async function pullChunked(
  doctype: string,
  fields: string[],
  lastSyncDate: string | null,
  upsert: (records: Record<string, any>[]) => Promise<void>,
  onLoaded: (loaded: number) => void,
  onChunk?: () => void
): Promise<number> {
  const filters = lastSyncDate ? { creation: ['>', toFrappeCreationFilter(lastSyncDate)] } : {};
  let start = 0;
  let size = FIRST_CHUNK;
  let loaded = 0;

  while (true) {
    const batch = await getDoctypeList(doctype, fields, filters, {
      limit: size,
      limit_start: start,
    });
    const records = Array.isArray(batch) ? batch : [];
    if (records.length > 0) {
      await upsert(records);
      loaded += records.length;
      onLoaded(loaded);
      onChunk?.();
    }
    // Short page = last page. A page LARGER than asked means an old backend that
    // ignores paging and returned everything at once — also done.
    if (records.length !== size) break;
    start += size;
    size = CHUNK;
  }
  return loaded;
}

/** Number of records to download, or null when the server can't tell. */
async function countToPull(doctype: string, lastSyncDate: string | null): Promise<number | null> {
  try {
    const filters = lastSyncDate ? { creation: ['>', toFrappeCreationFilter(lastSyncDate)] } : {};
    return await getDoctypeCount(doctype, filters);
  } catch {
    return null;
  }
}

/**
 * Sync small lookup tables (full pull each time - they're small).
 */
async function syncSmallDoctypes(onProgress?: (progress: number, message: string) => void) {
  for (let i = 0; i < SMALL_DOCTYPES.length; i++) {
    const { key, doctype, fields, label } = SMALL_DOCTYPES[i];
    onProgress?.(85 + Math.round((i / SMALL_DOCTYPES.length) * 10), `جاري تحميل ${label}...`);
    try {
      const data = await getDoctypeList(doctype, fields);
      const records = Array.isArray(data) ? data : [];
      await storage.saveItem(key, records);
    } catch (error) {
      console.warn(`Failed to sync ${doctype}:`, error);
    }
  }
}

/** One-time migration: move Recipient/AID from AsyncStorage to SQLite. */
async function migrateFromAsyncStorageIfNeeded() {
  try {
    const [oldRecipients, oldAids] = await Promise.all([
      storage.getItem(STORAGE_KEYS.RECIPIENTS),
      storage.getItem(STORAGE_KEYS.AID),
    ]);
    const recipients = Array.isArray(oldRecipients) ? oldRecipients : [];
    const aids = Array.isArray(oldAids) ? oldAids : [];
    if (recipients.length > 0) {
      await bulkUpsertRecipients(recipients);
      await storage.removeItem(STORAGE_KEYS.RECIPIENTS);
    }
    if (aids.length > 0) {
      await bulkUpsertAids(aids);
      await storage.removeItem(STORAGE_KEYS.AID);
    }
  } catch (e) {
    console.warn('Migration from AsyncStorage skipped:', e);
  }
}

/**
 * Performs incremental pull: only fetches records created after last sync.
 * Small lookup tables are fully refreshed. Recipient and AID use creation filter.
 *
 * @param onProgress - Optional callback (0–100, message)
 */
export const performIncrementalPull = async (onProgress?: ProgressFn, onChunk?: () => void) => {
  await migrateFromAsyncStorageIfNeeded();
  const lastSync = await storage.getItem(STORAGE_KEYS.LAST_SYNC);
  const startedAt = new Date().toISOString();

  onProgress?.(0, 'جاري تحميل البيانات...');
  const [recipientTotal, aidTotal] = await Promise.all([
    countToPull('Recipient', lastSync),
    countToPull('AID', lastSync),
  ]);
  const loaded = { recipients: 0, aids: 0 };
  const report = () => {
    const total = (recipientTotal ?? 0) + (aidTotal ?? 0);
    const done = loaded.recipients + loaded.aids;
    const pct = total > 0 ? Math.min(90, Math.round((done / total) * 90)) : 45;
    const of = (n: number, t: number | null) => (t != null ? `${n}/${t}` : `${n}`);
    onProgress?.(
      pct,
      `جاري التحميل: ${of(loaded.recipients, recipientTotal)} مستفيد، ${of(loaded.aids, aidTotal)} مساعدة`
    );
  };

  // Both run concurrently so the first 20 of each type appear almost at once.
  const [recipientCount, aidCount] = await Promise.all([
    pullChunked(
      'Recipient',
      ['*'],
      lastSync,
      bulkUpsertRecipients,
      (n) => {
        loaded.recipients = n;
        report();
      },
      onChunk
    ),
    pullChunked(
      'AID',
      AID_FIELDS,
      lastSync,
      bulkUpsertAids,
      (n) => {
        loaded.aids = n;
        report();
      },
      onChunk
    ),
  ]);
  await syncSmallDoctypes(onProgress);
  // Only now is the pull complete; an interrupted pull is resumed from scratch
  // (upserts are idempotent). Use the start time so records created meanwhile are kept.
  await storage.saveItem(STORAGE_KEYS.LAST_SYNC, startedAt);
  onProgress?.(100, 'تم التحميل بنجاح!');

  return { recipientCount, aidCount };
};

/**
 * Full initial sync: pulls all Recipient and AID records (paginated), plus small doctypes.
 * Use only for first-time sync or reset. Prefer performIncrementalPull for normal sync.
 */
export const performInitialSync = async (onProgress?: ProgressFn, onChunk?: () => void) => {
  return performIncrementalPull(onProgress, onChunk);
};

/**
 * Retrieves synced data. Recipient and AID come from SQLite; others from AsyncStorage.
 */
export const getSyncedData = async (key: string): Promise<any[]> => {
  if (key === STORAGE_KEYS.RECIPIENTS) return getAllRecipients();
  if (key === STORAGE_KEYS.AID) return getAllAids();
  return (await storage.getItem(key)) || [];
};

/**
 * Returns when the last sync happened.
 */
export const getLastSyncTime = async (): Promise<string | null> => {
  return storage.getItem(STORAGE_KEYS.LAST_SYNC);
};

// ─── Push unsynced data to server ─────────────────────────────────────────────

export interface SyncResult {
  success: boolean;
  syncedRecipients: number;
  syncedAids: number;
  pulledRecipients: number;
  pulledAids: number;
  errors: string[];
}

const toFrappeRecipient = (local: Record<string, any>): Record<string, any> => {
  const doc: Record<string, any> = {
    full_name: (local.full_name || '').trim(),
    id_no: (local.id_no || '').trim(),
    branch: local.branch || undefined,
    masjed: local.masjed || undefined,
    number_of_family_members: parseInt(String(local.number_of_family_members), 10) || 0,
    marital_status: (local.marital_status || '').replace(/ـ/g, '').trim(),
    gender: local.gender || undefined,
    nature_of_approval: local.nature_of_approval || undefined,
    accommodation_name: local.accommodation_name || undefined,
    address: (local.address || '').trim(),
    jawwal_no: (local.jawwal_no || '').trim(),
  };
  if (local.wife_full_name) doc.wife_full_name = local.wife_full_name.trim();
  if (local.wife_id_no) doc.wife_id_no = local.wife_id_no.trim();
  if (local.wife_date_of_birth) doc.wife_date_of_birth = local.wife_date_of_birth;
  return doc;
};

const toFrappeAid = (
  local: Record<string, any>,
  recipientIdMap: Map<string, string>
): Record<string, any> => {
  const recipientValue = local.recipient;
  const serverRecipient = recipientIdMap.get(recipientValue) ?? recipientValue;
  return {
    // AID.recipient is a Dynamic Link on recipient_type; older local rows have none.
    recipient_type: local.recipient_type ?? 'Recipient',
    recipient: serverRecipient,
    branch: local.branch,
    aid_type: local.aid_type,
    organization_name: local.organization_name,
    aid_date: local.aid_date,
    eligibility_status: local.eligibility_status,
    nature_of_aid: local.nature_of_aid,
  };
};

const AID_PUSH_BATCH = 50;

/** True when the server doesn't know the called method (older backend). */
const isMissingMethod = (err: any) => {
  const status = err?.response?.status;
  const text = JSON.stringify(err?.response?.data ?? '');
  return status === 404 || /Failed to get method|not whitelisted/i.test(text);
};

const frappeErrorText = (err: any): string =>
  frappeMessage(err?.response?.data) ?? err?.message ?? String(err);

/**
 * Pushes all local unsynced Recipients and AIDs to Frappe.
 * Recipients are synced first; AIDs reference them by server name.
 * Uses SQLite for storage.
 */
export const pushUnsyncedToServer = async (): Promise<SyncResult> => {
  const errors: string[] = [];
  let syncedRecipients = 0;
  let syncedAids = 0;
  const recipientIdMap = new Map<string, string>();

  const unsyncedRecipients = await getUnsyncedRecipients();
  const unsyncedAids = await getUnsyncedAids();

  for (const local of unsyncedRecipients) {
    try {
      const doc = toFrappeRecipient(local);
      const created = await insertDoc('Recipient', doc);
      const serverName = created?.name;
      if (!serverName) {
        errors.push(`Recipient ${local.id || local.full_name}: لم يُرجع الخادم معرفاً`);
        continue;
      }
      recipientIdMap.set(local.id, serverName);
      recipientIdMap.set(local.name || local.id, serverName);
      await updateRecipient(local.name ?? local.id, {
        name: serverName,
        id: serverName,
        synced: true,
        created_locally: false,
      });
      syncedRecipients++;
    } catch (err: any) {
      let msg = err?.message || String(err);
      if (err.response?.data) {
        const data = err.response.data;
        if (data._server_messages) {
          try {
            const msgs = JSON.parse(data._server_messages);
            msg = msgs.map((m: any) => m.message || m).join(', ');
          } catch {}
        } else if (data.message) {
          msg = data.message;
        }
      }
      errors.push(`Recipient ${local.full_name}: ${msg}`);
    }
  }

  // AIDs: bulk endpoint in batches; falls back to one request per AID on backends
  // without `aids.api.bulk_insert_aids`.
  const markAidSynced = (localName: string, serverName: string) =>
    updateAid(localName, { name: serverName, synced: true, created_locally: false });

  let bulkSupported = true;
  for (let i = 0; i < unsyncedAids.length; i += AID_PUSH_BATCH) {
    const batch = unsyncedAids.slice(i, i + AID_PUSH_BATCH);
    if (bulkSupported) {
      try {
        const rows = batch.map((local) => ({
          client_id: local.name,
          ...toFrappeAid(local, recipientIdMap),
        }));
        const results = await bulkInsertAids(rows);
        for (const r of results) {
          if (r.name) {
            await markAidSynced(r.client_id, r.name);
            syncedAids++;
          } else {
            errors.push(`AID ${r.client_id}: ${r.error ?? 'خطأ غير معروف'}`);
          }
        }
        continue;
      } catch (err: any) {
        if (!isMissingMethod(err)) {
          errors.push(`AID (${batch.length}): ${frappeErrorText(err)}`);
          continue;
        }
        bulkSupported = false; // old backend → per-document below
      }
    }

    for (const local of batch) {
      try {
        const created = await insertDoc('AID', toFrappeAid(local, recipientIdMap));
        if (!created?.name) {
          errors.push(`AID ${local.name}: لم يُرجع الخادم معرفاً`);
          continue;
        }
        await markAidSynced(local.name, created.name);
        syncedAids++;
      } catch (err: any) {
        errors.push(`AID ${local.name}: ${frappeErrorText(err)}`);
      }
    }
  }

  if (syncedRecipients > 0 || syncedAids > 0) {
    await storage.saveItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
  }

  return {
    success: errors.length === 0,
    syncedRecipients,
    syncedAids,
    pulledRecipients: 0,
    pulledAids: 0,
    errors,
  };
};

/**
 * Full sync: 1) Push unsynced local data to server. 2) Pull only new records (creation > last_sync).
 * Always pulls on Sync Now to get server-side changes.
 */
export const syncWithFrappe = async (
  pullAfterPush = true,
  onPullProgress?: (progress: number, message: string) => void
): Promise<SyncResult> => {
  const result = await pushUnsyncedToServer();
  if (pullAfterPush) {
    const { recipientCount, aidCount } = await performIncrementalPull(onPullProgress);
    result.pulledRecipients = recipientCount;
    result.pulledAids = aidCount;
  }
  return result;
};
