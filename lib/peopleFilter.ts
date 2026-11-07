import api from './api';
import type { AidRecipientType } from './personAids';

/**
 * Criteria filter for recipients / wounded / martyrs / prisoners, evaluated on the
 * server by `aids.api.filter_people` (same semantics as the "Recipient Filterd"
 * doctype in the aids app: only submitted people and submitted aids count).
 */

export type DateOperator = '' | 'Between' | 'Before' | 'After' | 'On' | 'Not Between';

export interface AidCondition {
  aid_type?: string;
  operator: 'Received' | 'Not Received';
  date_operator?: DateOperator;
  from_date?: string;
  to_date?: string;
  min_times?: number;
  max_times?: number;
}

export interface PeopleFilter {
  /** Field criteria: select/link values and numeric ranges (as strings). */
  fields: Record<string, string>;
  aidConditions: AidCondition[];
}

export const EMPTY_FILTER: PeopleFilter = { fields: {}, aidConditions: [] };

export const activeFilterCount = (f: PeopleFilter) =>
  Object.values(f.fields).filter((v) => v !== '' && v != null).length + f.aidConditions.length;

export type FilterFieldKind = 'select' | 'branch' | 'masjed' | 'accommodation';

export interface FilterFieldDef {
  key: string;
  label: string;
  kind: FilterFieldKind;
  options?: string[];
}

const MARITAL = ['متزوجـ/ة', 'أعزب/عزباء', 'أرملـ/ة', 'مطلقـ/ة', 'مهجور/ة', 'متعدد الزوجات'];
const GENDER = ['ذكر', 'أنثى'];
const ADDRESS = ['شمال غزة', 'غرب غزة', 'شرق غزة', 'جنوب غزة', 'الوسطى', 'خانيونس', 'رفح'];
const APPROVAL = ['إيواء داخلي', 'إيواء خارجي'];
const APPROVED = ['معتمد', 'غير معتمد'];
const YES_NO = ['نعم', 'لا'];

const COMMON: FilterFieldDef[] = [
  { key: 'branch', label: 'الفرع', kind: 'branch' },
  { key: 'masjed', label: 'المسجد', kind: 'masjed' },
  { key: 'marital_status', label: 'الحالة الاجتماعية', kind: 'select', options: MARITAL },
  { key: 'nature_of_approval', label: 'طبيعة الإيواء', kind: 'select', options: APPROVAL },
  { key: 'accommodation_name', label: 'اسم الإيواء', kind: 'accommodation' },
];
const GENDER_FIELD: FilterFieldDef = {
  key: 'gender',
  label: 'الجنس',
  kind: 'select',
  options: GENDER,
};
const ADDRESS_FIELD: FilterFieldDef = {
  key: 'current_address',
  label: 'العنوان الحالي',
  kind: 'select',
  options: ADDRESS,
};

/** Fields offered per type (only fields that exist on that doctype). */
export const FILTER_FIELDS: Record<AidRecipientType, FilterFieldDef[]> = {
  Recipient: [
    ...COMMON,
    GENDER_FIELD,
    {
      key: 'ministry_of_public_work_approval',
      label: 'اعتماد وزارة الأشغال',
      kind: 'select',
      options: APPROVED,
    },
    { key: 'development_approval', label: 'اعتماد التنمية', kind: 'select', options: APPROVED },
    { key: 'west_gaza_approval', label: 'اعتماد غرب غزة', kind: 'select', options: APPROVED },
    {
      key: 'type_of_damage',
      label: 'نوع الضرر',
      kind: 'select',
      options: ['هدم كلي', 'جزئي غير صالح للسكن', 'جزئي بسيط', 'لا يوجد أضرار'],
    },
  ],
  Wounded: [
    ...COMMON,
    GENDER_FIELD,
    ADDRESS_FIELD,
    {
      key: 'type_of_injury',
      label: 'نوع الإصابة',
      kind: 'select',
      options: [
        'بتر',
        'شلل',
        'سقوط القدم/اليد',
        'فقدان العين',
        'إعاقة مزدوجة',
        'إصابات مركبة',
        'شظايا فقط',
        'كسر فقط',
      ],
    },
    {
      key: 'injury_level',
      label: 'درجة الإصابة',
      kind: 'select',
      options: ['بسيطة', 'متوسطة', 'شديدة'],
    },
    {
      key: 'natuer_of_injury',
      label: 'طبيعة الإصابة',
      kind: 'select',
      options: ['دائمة', 'مؤقتة'],
    },
  ],
  Martyrs: [
    ...COMMON,
    ADDRESS_FIELD,
    { key: 'he_has_orphans', label: 'له أيتام', kind: 'select', options: YES_NO },
  ],
  Prisoner: [
    ...COMMON,
    GENDER_FIELD,
    ADDRESS_FIELD,
    {
      key: 'patient_status',
      label: 'الحالة الصحية بعد الأسر',
      kind: 'select',
      options: ['مرض عضوي', 'مرض نفسي', 'معافى'],
    },
    { key: 'prisoner_aid', label: 'استفاد من منحة الأسرى', kind: 'select', options: YES_NO },
  ],
};

/** Types whose children's ages can be filtered (family members / orphans). */
export const HAS_CHILD_AGE: Record<AidRecipientType, boolean> = {
  Recipient: true,
  Martyrs: true,
  Wounded: false,
  Prisoner: false,
};

export const DATE_OPERATORS: { value: DateOperator; label: string }[] = [
  { value: '', label: 'أي وقت' },
  { value: 'Between', label: 'بين' },
  { value: 'Before', label: 'قبل' },
  { value: 'After', label: 'بعد' },
  { value: 'On', label: 'في يوم' },
  { value: 'Not Between', label: 'خارج الفترة' },
];

/** Which dates a date operator needs. */
export const datesFor = (op?: DateOperator) => ({
  from: op === 'Between' || op === 'Not Between' || op === 'After' || op === 'On',
  to: op === 'Between' || op === 'Not Between' || op === 'Before',
});

export interface FilteredPage {
  rows: Record<string, any>[];
  total: number;
}

/** One page of people matching `filter` (newest first). Online only. */
export async function fetchFilteredPeople(
  type: AidRecipientType,
  filter: PeopleFilter,
  opts: { fields: string[]; search?: string; start: number; limit: number }
): Promise<FilteredPage> {
  const fields = Object.fromEntries(
    Object.entries(filter.fields).filter(([, v]) => v !== '' && v != null)
  );
  const response = await api.post('/api/method/aids.api.filter_people', {
    recipient_type: type,
    filters: fields,
    aid_conditions: filter.aidConditions,
    fields: opts.fields,
    search: opts.search?.trim() || undefined,
    start: opts.start,
    page_length: opts.limit,
  });
  const data = response.data?.message;
  return { rows: Array.isArray(data?.rows) ? data.rows : [], total: Number(data?.total ?? 0) };
}
