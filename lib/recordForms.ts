import type { RecordTypeKey } from './records';

/**
 * "Add new" form definitions for Wounded / Martyrs / Prisoner.
 * Select options mirror the doctype JSON in the `aids` Frappe app; required fields
 * match the doctype `reqd` flags (full_name, id_no, branch, masjed, jawwal_no).
 */

export type FormFieldKind =
  | 'text'
  | 'multiline'
  | 'id' // 9-digit national ID
  | 'phone'
  | 'int'
  | 'date'
  | 'select'
  | 'branch'
  | 'masjed' // filtered by the selected branch
  | 'accommodation';

export interface FormFieldDef {
  key: string;
  label: string;
  kind: FormFieldKind;
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

export interface FormSectionDef {
  title: string;
  fields: FormFieldDef[];
}

const MARITAL = ['متزوجـ/ة', 'أعزب/عزباء', 'أرملـ/ة', 'مطلقـ/ة', 'مهجور/ة', 'متعدد الزوجات'];
const GENDER = ['ذكر', 'أنثى'];
const ADDRESS = ['شمال غزة', 'غرب غزة', 'شرق غزة', 'جنوب غزة', 'الوسطى', 'خانيونس', 'رفح'];
const YES_NO = ['نعم', 'لا'];
const APPROVAL = ['إيواء خارجي', 'إيواء داخلي'];
const BANK = ['محفظة', 'بنك'];

const BASIC: FormFieldDef[] = [
  { key: 'full_name', label: 'الاسم الكامل', kind: 'text', required: true },
  { key: 'id_no', label: 'رقم الهوية', kind: 'id', required: true },
  { key: 'jawwal_no', label: 'رقم الجوال', kind: 'phone', required: true },
  { key: 'branch', label: 'الفرع', kind: 'branch', required: true },
  { key: 'masjed', label: 'المسجد', kind: 'masjed', required: true },
];

const ADDRESS_SECTION: FormSectionDef = {
  title: 'العنوان والإيواء',
  fields: [
    { key: 'current_address', label: 'العنوان الحالي', kind: 'select', options: ADDRESS },
    { key: 'current_address_details', label: 'تفاصيل العنوان', kind: 'multiline' },
    { key: 'nature_of_approval', label: 'طبيعة الإيواء', kind: 'select', options: APPROVAL },
    { key: 'accommodation_name', label: 'اسم الإيواء', kind: 'accommodation' },
  ],
};

const BANK_SECTION: FormSectionDef = {
  title: 'البيانات البنكية',
  fields: [
    { key: 'type_of_bank', label: 'نوع الحساب البنكي', kind: 'select', options: BANK },
    { key: 'bank_account', label: 'رقم الحساب', kind: 'text' },
  ],
};

export const RECORD_FORMS: Record<RecordTypeKey, FormSectionDef[]> = {
  wounded: [
    {
      title: 'البيانات الأساسية',
      fields: [
        ...BASIC,
        { key: 'ooredoo_no', label: 'رقم أوريدو', kind: 'phone' },
        { key: 'gender', label: 'الجنس', kind: 'select', options: GENDER },
        { key: 'marital_status', label: 'الحالة الاجتماعية', kind: 'select', options: MARITAL },
        { key: 'number_of_family_members', label: 'عدد أفراد الأسرة', kind: 'int' },
      ],
    },
    {
      title: 'بيانات الإصابة',
      fields: [
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
        {
          key: 'did_it_need_surgery',
          label: 'احتاج عملية جراحية',
          kind: 'select',
          options: YES_NO,
        },
        {
          key: 'is_he_still_receiving_treatment',
          label: 'ما زال يتلقى العلاج',
          kind: 'select',
          options: YES_NO,
        },
        {
          key: 'movement_ability',
          label: 'القدرة على الحركة',
          kind: 'select',
          options: ['حركة كاملة', 'حركة جزئية', 'غير قادر على الحركة'],
        },
        { key: 'injury_details', label: 'تفاصيل الإصابة', kind: 'multiline' },
      ],
    },
    ADDRESS_SECTION,
    BANK_SECTION,
  ],
  martyrs: [
    {
      title: 'بيانات الشهيد',
      fields: [
        ...BASIC,
        { key: 'date_of_birth', label: 'تاريخ الميلاد', kind: 'date' },
        { key: 'date_of_martyrdom', label: 'تاريخ الاستشهاد', kind: 'date' },
        { key: 'marital_status', label: 'الحالة الاجتماعية', kind: 'select', options: MARITAL },
        { key: 'occupation', label: 'المهنة', kind: 'text' },
        { key: 'family_members_count', label: 'عدد أفراد الأسرة', kind: 'int' },
        { key: 'he_has_orphans', label: 'له أيتام', kind: 'select', options: YES_NO },
        { key: 'orphans_number', label: 'عدد الأيتام', kind: 'int' },
      ],
    },
    {
      title: 'بيانات الزوجة',
      fields: [
        { key: 'wife_full_name', label: 'اسم الزوجة', kind: 'text' },
        { key: 'wife_id_no', label: 'رقم هوية الزوجة', kind: 'id' },
        { key: 'wife_jawwal_no', label: 'جوال الزوجة', kind: 'phone' },
        { key: 'wife_date_of_birth', label: 'تاريخ ميلاد الزوجة', kind: 'date' },
        {
          key: 'status_of_wife',
          label: 'حالة الزوجة',
          kind: 'select',
          options: ['على قيد الحياة', 'متوفية'],
        },
      ],
    },
    {
      title: 'بيانات الوصي',
      fields: [
        { key: 'guardian_full_name', label: 'اسم الوصي', kind: 'text' },
        { key: 'guardianid_no', label: 'رقم هوية الوصي', kind: 'id' },
        {
          key: 'relationship',
          label: 'صلة القرابة',
          kind: 'select',
          options: ['أم', 'عم', 'خال', 'جد'],
        },
        { key: 'guardian_jawwal_no', label: 'جوال الوصي', kind: 'phone' },
      ],
    },
    ADDRESS_SECTION,
    BANK_SECTION,
  ],
  prisoners: [
    {
      title: 'بيانات الأسير',
      fields: [
        ...BASIC,
        { key: 'gender', label: 'الجنس', kind: 'select', options: GENDER },
        { key: 'date_of_birth', label: 'تاريخ الميلاد', kind: 'date' },
        { key: 'marital_status', label: 'الحالة الاجتماعية', kind: 'select', options: MARITAL },
        { key: 'number_of_family_members', label: 'عدد أفراد الأسرة', kind: 'int' },
      ],
    },
    {
      title: 'بيانات الأسر',
      fields: [
        { key: 'date_of_captivity', label: 'تاريخ الأسر', kind: 'date' },
        { key: 'date_of_release', label: 'تاريخ الإفراج', kind: 'date' },
        {
          key: 'patient_status',
          label: 'الحالة الصحية بعد الأسر',
          kind: 'select',
          options: ['مرض عضوي', 'مرض نفسي', 'معافى'],
        },
        { key: 'prisoner_aid', label: 'استفاد من منحة الأسرى', kind: 'select', options: YES_NO },
      ],
    },
    {
      title: 'بيانات الزوجة',
      fields: [
        { key: 'wife_full_name', label: 'اسم الزوجة', kind: 'text' },
        { key: 'wife_id_no', label: 'رقم هوية الزوجة', kind: 'id' },
        { key: 'wife_date_of_birth', label: 'تاريخ ميلاد الزوجة', kind: 'date' },
      ],
    },
    ADDRESS_SECTION,
    BANK_SECTION,
  ],
};
