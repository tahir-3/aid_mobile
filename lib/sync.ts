import { getDoctypeList, getDoctypeListPaginated, insertDoc } from './api';
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
} from './db';

export { getRecipientsPaginated, getRecipientsCount, getAidsPaginated, getAidsCount };

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

/**
 * Pull only records created AFTER lastSyncDate. Uses creation field from Frappe.
 * Frappe expects YYYY-MM-DD HH:MM:SS and we use > (not >=) to avoid re-fetching same records.
 * For first sync (no lastSyncDate), does full pull.
 */
async function pullIncrementalRecipients(
  lastSyncDate: string | null,
  onProgress?: (progress: number, message: string) => void
): Promise<number> {
  const filters = lastSyncDate
    ? { creation: ['>', toFrappeCreationFilter(lastSyncDate)] }
    : {};
  onProgress?.(0, 'جاري جلب المستفيدين الجدد...');
  const records = await getDoctypeListPaginated(
    'Recipient',
    ["*"],
    filters,
    2000,
    (page, count) => {
      if (count > 0) onProgress?.(50, `جاري تحميل المستفيدين... (صفحة ${page + 1})`);
    }
  );

  if (records.length > 0) {
    await bulkUpsertRecipients(records);
  }
  return records.length;
}

/**
 * Pull only AIDs created AFTER lastSyncDate.
 * Uses same Frappe format: creation > YYYY-MM-DD HH:MM:SS
 */
async function pullIncrementalAids(
  lastSyncDate: string | null,
  onProgress?: (progress: number, message: string) => void
): Promise<number> {
  const filters = lastSyncDate
    ? { creation: ['>', toFrappeCreationFilter(lastSyncDate)] }
    : {};
  onProgress?.(50, 'جاري جلب المساعدات الجديدة...');
  const records = await getDoctypeListPaginated(
    'AID',
    AID_FIELDS,
    filters,
    2000,
    (page, count) => {
      if (count > 0) onProgress?.(75, `جاري تحميل المساعدات... (صفحة ${page + 1})`);
    }
  );

  if (records.length > 0) {
    await bulkUpsertAids(records);
  }
  return records.length;
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
export const performIncrementalPull = async (
  onProgress?: (progress: number, message: string) => void
) => {
  await migrateFromAsyncStorageIfNeeded();
  const lastSync = await storage.getItem(STORAGE_KEYS.LAST_SYNC);
  const [recipientCount, aidCount] = await Promise.all([
    pullIncrementalRecipients(lastSync, onProgress),
    pullIncrementalAids(lastSync, onProgress),
  ]);
  await syncSmallDoctypes(onProgress);
  await storage.saveItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
  onProgress?.(100, 'تم التحميل بنجاح!');

  return { recipientCount, aidCount };
};

/**
 * Full initial sync: pulls all Recipient and AID records (paginated), plus small doctypes.
 * Use only for first-time sync or reset. Prefer performIncrementalPull for normal sync.
 */
export const performInitialSync = async (
  onProgress?: (progress: number, message: string) => void
) => {
  return performIncrementalPull(onProgress);
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
    recipient: serverRecipient,
    branch: local.branch,
    aid_type: local.aid_type,
    organization_name: local.organization_name,
    aid_date: local.aid_date,
    eligibility_status: local.eligibility_status,
    nature_of_aid: local.nature_of_aid,
  };
};

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

  for (const local of unsyncedAids) {
    try {
      const doc = toFrappeAid(local, recipientIdMap);
      const created = await insertDoc('AID', doc);
      const serverName = created?.name;
      if (!serverName) {
        errors.push(`AID ${local.name}: لم يُرجع الخادم معرفاً`);
        continue;
      }
      await updateAid(local.name, {
        name: serverName,
        synced: true,
        created_locally: false,
      });
      syncedAids++;
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
      errors.push(`AID ${local.name}: ${msg}`);
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
