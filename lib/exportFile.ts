import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import api from './api';
import type { PeopleFilter } from './peopleFilter';
import type { AidRecipientType } from './personAids';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

interface ExportPayload {
  filename: string;
  /** base64-encoded xlsx */
  content: string;
}

/** Write the Excel file to the cache dir and open the share sheet (WhatsApp, Drive, mail…). */
async function saveAndShare(payload: ExportPayload | undefined, dialogTitle: string) {
  if (!payload?.content) throw new Error('لم يُرجع الخادم ملفاً');
  const safeName = payload.filename.replace(/[^\w.\-]/g, '_');
  const file = new File(Paths.cache, safeName);
  if (file.exists) file.delete();
  file.create();
  file.write(payload.content, { encoding: 'base64' });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('المشاركة غير متاحة على هذا الجهاز');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: XLSX_MIME,
    dialogTitle,
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
  });
}

/** Excel of everyone matching the filter + a sheet with all criteria used. */
export async function exportFilteredPeople(
  type: AidRecipientType,
  filter: PeopleFilter,
  search?: string
) {
  const fields = Object.fromEntries(
    Object.entries(filter.fields).filter(([, v]) => v !== '' && v != null)
  );
  const response = await api.post(
    '/api/method/aids.api.export_filtered_people',
    {
      recipient_type: type,
      filters: fields,
      aid_conditions: filter.aidConditions,
      search: search?.trim() || undefined,
    },
    { timeout: 120_000 }
  );
  await saveAndShare(response.data?.message, 'تصدير نتائج التصفية');
}

/** Excel of every aid of one person. */
export async function exportPersonAids(type: AidRecipientType, recipient: string) {
  const response = await api.get('/api/method/aids.api.export_person_aids', {
    params: { recipient_type: type, recipient },
    timeout: 60_000,
  });
  await saveAndShare(response.data?.message, 'تصدير المساعدات');
}
