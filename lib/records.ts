import type { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type React from 'react';
import { create } from 'zustand';

import api from './api';
import { clearRecordsCache, RECORDS_CACHE_PREFIX } from './recordsCache';

/**
 * Online-first access to the "people records" doctypes of the `aids` Frappe app
 * (Wounded, Martyrs, Prisoner). Unlike aids/recipients these are not synced into SQLite;
 * the last successful first page, opened documents and counts are cached in AsyncStorage
 * so screens can show something instantly and while offline.
 */

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type RecordTypeKey = 'wounded' | 'martyrs' | 'prisoners';

export interface FieldDef {
  key: string;
  label: string;
}

export interface BadgeDef {
  key: string;
  /** Text before the value, e.g. "أيتام:". */
  prefix?: string;
  /** Text after the value, e.g. "أفراد". */
  suffix?: string;
}

export interface RecordTypeConfig {
  key: RecordTypeKey;
  doctype: string;
  label: string;
  singular: string;
  icon: IconName;
  color: string;
  /** Fields fetched for list cards. */
  listFields: string[];
  /** Secondary line on the list card. */
  subtitle: FieldDef;
  /** Chips on the list card, in order; empty values are skipped. */
  badges: BadgeDef[];
  /** Grouped fields on the details screen. */
  sections: { title: string; icon: IconName; fields: FieldDef[] }[];
}

const COMMON_FIELDS: FieldDef[] = [
  { key: 'id_no', label: 'رقم الهوية' },
  { key: 'branch', label: 'الفرع' },
  { key: 'masjed', label: 'المسجد' },
  { key: 'jawwal_no', label: 'رقم جوال' },
  { key: 'ooredoo_no', label: 'رقم أوريدو' },
  { key: 'marital_status', label: 'الحالة الاجتماعية' },
  { key: 'current_address', label: 'العنوان الحالي' },
  { key: 'current_address_details', label: 'تفاصيل العنوان' },
  { key: 'nature_of_approval', label: 'طبيعة الإيواء' },
  { key: 'accommodation_name', label: 'اسم الإيواء' },
];

const BANK_FIELDS: FieldDef[] = [
  { key: 'type_of_bank', label: 'نوع الحساب البنكي' },
  { key: 'bank_account', label: 'رقم الحساب' },
];

export const RECORD_TYPES: Record<RecordTypeKey, RecordTypeConfig> = {
  wounded: {
    key: 'wounded',
    doctype: 'Wounded',
    label: 'الجرحى',
    singular: 'جريح',
    icon: 'bandage-outline',
    color: '#EF4444',
    listFields: [
      'name',
      'full_name',
      'id_no',
      'branch',
      'jawwal_no',
      'number_of_family_members',
      'type_of_injury',
      'injury_level',
      'docstatus',
    ],
    subtitle: { key: 'branch', label: 'الفرع' },
    badges: [
      { key: 'type_of_injury' },
      { key: 'injury_level', prefix: 'إصابة' },
      { key: 'number_of_family_members', suffix: 'أفراد' },
    ],
    sections: [
      {
        title: 'البيانات الشخصية',
        icon: 'person-outline',
        fields: [
          ...COMMON_FIELDS,
          { key: 'gender', label: 'الجنس' },
          { key: 'number_of_family_members', label: 'عدد أفراد الأسرة' },
        ],
      },
      {
        title: 'بيانات الإصابة',
        icon: 'bandage-outline',
        fields: [
          { key: 'type_of_injury', label: 'نوع الإصابة' },
          { key: 'injury_level', label: 'درجة الإصابة' },
          { key: 'natuer_of_injury', label: 'طبيعة الإصابة' },
          { key: 'injury_type', label: 'تفصيل الإصابة' },
          { key: 'amputation_place', label: 'مكان البتر' },
          { key: 'amputation_level', label: 'مستوى البتر' },
          { key: 'amputation_type', label: 'نوع البتر' },
          { key: 'is_there_an_artificial_limb', label: 'هل يوجد طرف صناعي' },
          { key: 'type_of_paralysis', label: 'نوع الشلل' },
          { key: 'movement_ability', label: 'القدرة على الحركة' },
          { key: 'side', label: 'الجهة' },
          { key: 'shot_place', label: 'مكان الإصابة بالشظايا' },
          { key: 'number_of_shots', label: 'عدد الشظايا' },
          { key: 'shots_effect', label: 'أثر الشظايا' },
          { key: 'shot_side', label: 'جهة الشظايا' },
          { key: 'number_of_eye_loss', label: 'عدد العيون المفقودة' },
          { key: 'eye_side', label: 'جهة العين' },
          { key: 'is_the_eye_empty', label: 'هل تجويف العين فارغ' },
          { key: 'does_he_use_a_prosthetic_eye', label: 'يستخدم عين صناعية' },
          { key: 'does_he_use_a_prop', label: 'يستخدم أداة مساعدة' },
          { key: 'did_it_need_surgery', label: 'احتاج عملية جراحية' },
          { key: 'is_he_still_receiving_treatment', label: 'ما زال يتلقى العلاج' },
          { key: 'general_requirements', label: 'الاحتياجات العامة' },
          { key: 'injury_details', label: 'تفاصيل الإصابة' },
        ],
      },
      { title: 'البيانات البنكية', icon: 'wallet-outline', fields: BANK_FIELDS },
    ],
  },
  martyrs: {
    key: 'martyrs',
    doctype: 'Martyrs',
    label: 'الشهداء',
    singular: 'شهيد',
    icon: 'flower-outline',
    color: '#A855F7',
    listFields: [
      'name',
      'full_name',
      'id_no',
      'branch',
      'jawwal_no',
      'family_members_count',
      'date_of_martyrdom',
      'orphans_number',
      'docstatus',
    ],
    subtitle: { key: 'branch', label: 'الفرع' },
    badges: [
      { key: 'date_of_martyrdom', prefix: 'استشهد' },
      { key: 'orphans_number', prefix: 'أيتام:' },
      { key: 'family_members_count', suffix: 'أفراد' },
    ],
    sections: [
      {
        title: 'بيانات الشهيد',
        icon: 'person-outline',
        fields: [
          ...COMMON_FIELDS,
          { key: 'date_of_birth', label: 'تاريخ الميلاد' },
          { key: 'date_of_martyrdom', label: 'تاريخ الاستشهاد' },
          { key: 'occupation', label: 'المهنة' },
          { key: 'affiliation', label: 'الانتماء' },
          { key: 'family_members_count', label: 'عدد أفراد الأسرة' },
          { key: 'he_has_orphans', label: 'له أيتام' },
          { key: 'orphans_number', label: 'عدد الأيتام' },
        ],
      },
      {
        title: 'بيانات الزوجة',
        icon: 'people-circle-outline',
        fields: [
          { key: 'wife_full_name', label: 'الاسم الكامل' },
          { key: 'wife_id_no', label: 'رقم الهوية' },
          { key: 'wife_date_of_birth', label: 'تاريخ الميلاد' },
          { key: 'wife_jawwal_no', label: 'رقم الجوال' },
          { key: 'wife_occupation', label: 'المهنة' },
          { key: 'wife_marital_status', label: 'الحالة الاجتماعية' },
          { key: 'status_of_wife', label: 'حالة الزوجة' },
          { key: 'death_date', label: 'تاريخ الوفاة' },
          { key: 'widows_address', label: 'عنوان الأرملة' },
        ],
      },
      {
        title: 'بيانات الوصي',
        icon: 'shield-checkmark-outline',
        fields: [
          { key: 'guardian_full_name', label: 'الاسم الكامل' },
          { key: 'guardianid_no', label: 'رقم الهوية' },
          { key: 'relationship', label: 'صلة القرابة' },
          { key: 'guardian_jawwal_no', label: 'رقم الجوال' },
          { key: 'guardians_address', label: 'العنوان' },
        ],
      },
      { title: 'البيانات البنكية', icon: 'wallet-outline', fields: BANK_FIELDS },
    ],
  },
  prisoners: {
    key: 'prisoners',
    doctype: 'Prisoner',
    label: 'الأسرى',
    singular: 'أسير',
    icon: 'lock-closed-outline',
    color: '#3B82F6',
    listFields: [
      'name',
      'full_name',
      'id_no',
      'branch',
      'jawwal_no',
      'number_of_family_members',
      'date_of_captivity',
      'date_of_release',
      'patient_status',
      'docstatus',
    ],
    subtitle: { key: 'branch', label: 'الفرع' },
    badges: [
      { key: 'date_of_captivity', prefix: 'أسر' },
      { key: 'date_of_release', prefix: 'إفراج' },
      { key: 'patient_status' },
    ],
    sections: [
      {
        title: 'بيانات الأسير',
        icon: 'person-outline',
        fields: [
          ...COMMON_FIELDS,
          { key: 'gender', label: 'الجنس' },
          { key: 'date_of_birth', label: 'تاريخ الميلاد' },
          { key: 'number_of_family_members', label: 'عدد أفراد الأسرة' },
        ],
      },
      {
        title: 'بيانات الأسر',
        icon: 'lock-closed-outline',
        fields: [
          { key: 'date_of_captivity', label: 'تاريخ الأسر' },
          { key: 'date_of_release', label: 'تاريخ الإفراج' },
          { key: 'patient_status', label: 'الحالة الصحية بعد الأسر' },
          { key: 'prisoner_aid', label: 'استفاد من منحة الأسرى' },
          { key: 'amount', label: 'القيمة المالية' },
        ],
      },
      {
        title: 'بيانات الزوجة',
        icon: 'people-circle-outline',
        fields: [
          { key: 'wife_full_name', label: 'الاسم الكامل' },
          { key: 'wife_id_no', label: 'رقم الهوية' },
          { key: 'wife_date_of_birth', label: 'تاريخ الميلاد' },
        ],
      },
      { title: 'البيانات البنكية', icon: 'wallet-outline', fields: BANK_FIELDS },
    ],
  },
};

export const RECORD_TYPE_KEYS: RecordTypeKey[] = ['wounded', 'martyrs', 'prisoners'];

export const isRecordTypeKey = (v: unknown): v is RecordTypeKey =>
  typeof v === 'string' && v in RECORD_TYPES;

// Cancelled documents (docstatus 2) are hidden everywhere.
const NOT_CANCELLED = [['docstatus', '<', 2]];

/** One page of records, newest first. `search` matches full name or ID number. */
export async function fetchRecords(
  type: RecordTypeKey,
  opts: { search?: string; limit: number; start: number }
): Promise<Record<string, any>[]> {
  const cfg = RECORD_TYPES[type];
  const term = opts.search?.trim();
  const response = await api.get('/api/method/frappe.client.get_list', {
    params: {
      doctype: cfg.doctype,
      fields: JSON.stringify(cfg.listFields),
      filters: JSON.stringify(NOT_CANCELLED),
      or_filters: term
        ? JSON.stringify([
            ['full_name', 'like', `%${term}%`],
            ['id_no', 'like', `%${term}%`],
          ])
        : undefined,
      order_by: 'creation desc',
      limit_start: opts.start,
      limit_page_length: opts.limit,
    },
  });
  const data = response.data?.message;
  return Array.isArray(data) ? data : [];
}

/** Total (non-cancelled) count for a record type. */
export async function fetchRecordCount(type: RecordTypeKey): Promise<number> {
  const response = await api.get('/api/method/frappe.client.get_count', {
    params: { doctype: RECORD_TYPES[type].doctype, filters: JSON.stringify(NOT_CANCELLED) },
  });
  return Number(response.data?.message ?? 0);
}

/** Counts for all record types; a failed type (offline, no permission) yields null. */
export async function fetchAllRecordCounts(): Promise<Record<RecordTypeKey, number | null>> {
  const results = await Promise.allSettled(RECORD_TYPE_KEYS.map(fetchRecordCount));
  return Object.fromEntries(
    RECORD_TYPE_KEYS.map((k, i) => {
      const r = results[i];
      return [k, r.status === 'fulfilled' ? r.value : null];
    })
  ) as Record<RecordTypeKey, number | null>;
}

/** Full document. */
export async function fetchRecord(type: RecordTypeKey, name: string): Promise<Record<string, any>> {
  const doctype = encodeURIComponent(RECORD_TYPES[type].doctype);
  const response = await api.get(`/api/resource/${doctype}/${encodeURIComponent(name)}`);
  return response.data?.data ?? response.data;
}

// ─── Cache ────────────────────────────────────────────────────────────────────
export interface Cached<T> {
  data: T;
  savedAt: string;
}

const CACHE_PREFIX = RECORDS_CACHE_PREFIX;
const listKey = (type: RecordTypeKey) => `${CACHE_PREFIX}list:${type}`;
const docKey = (type: RecordTypeKey, name: string) => `${CACHE_PREFIX}doc:${type}:${name}`;
const COUNTS_KEY = `${CACHE_PREFIX}counts`;

async function readCache<T>(key: string): Promise<Cached<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Cached<T>) : null;
  } catch {
    return null;
  }
}

async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    const entry: Cached<T> = { data, savedAt: new Date().toISOString() };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch (e) {
    console.warn('Failed to write records cache:', e);
  }
}

/** Cached first page (no search) of a record type. */
export const getCachedRecords = (type: RecordTypeKey) =>
  readCache<Record<string, any>[]>(listKey(type));
export const setCachedRecords = (type: RecordTypeKey, data: Record<string, any>[]) =>
  writeCache(listKey(type), data);

export const getCachedRecord = (type: RecordTypeKey, name: string) =>
  readCache<Record<string, any>>(docKey(type, name));
export const setCachedRecord = (type: RecordTypeKey, name: string, data: Record<string, any>) =>
  writeCache(docKey(type, name), data);

export const getCachedRecordCounts = () =>
  readCache<Record<RecordTypeKey, number | null>>(COUNTS_KEY);

/**
 * Live counts, falling back per type to the last cached value when a request fails.
 * Successful results are written back to the cache.
 */
export async function fetchRecordCountsWithCache(): Promise<Record<RecordTypeKey, number | null>> {
  const [live, cached] = await Promise.all([fetchAllRecordCounts(), getCachedRecordCounts()]);
  const merged = Object.fromEntries(
    RECORD_TYPE_KEYS.map((k) => [k, live[k] ?? cached?.data[k] ?? null])
  ) as Record<RecordTypeKey, number | null>;
  if (RECORD_TYPE_KEYS.some((k) => live[k] !== null)) await writeCache(COUNTS_KEY, merged);
  return merged;
}

export { clearRecordsCache };

// ─── Create ───────────────────────────────────────────────────────────────────
/** Insert a new record (saved as a draft, docstatus 0). Online only. */
export async function createRecord(
  type: RecordTypeKey,
  doc: Record<string, any>
): Promise<Record<string, any>> {
  const doctype = encodeURIComponent(RECORD_TYPES[type].doctype);
  const response = await api.post(`/api/resource/${doctype}`, doc);
  const created = response.data?.data ?? response.data;
  useRecordsChanges.getState().bump(type);
  return created;
}

/** Per-type counter bumped when records are created, so lists can reload. */
export const useRecordsChanges = create<{
  versions: Record<RecordTypeKey, number>;
  bump: (type: RecordTypeKey) => void;
}>((set) => ({
  versions: { wounded: 0, martyrs: 0, prisoners: 0 },
  bump: (type) => set((s) => ({ versions: { ...s.versions, [type]: s.versions[type] + 1 } })),
}));
