import api, { getDoctypeCount } from './api';
import { getDb } from './db';

/** AID.recipient_type values (AID.recipient is a Dynamic Link on this field). */
export type AidRecipientType = 'Recipient' | 'Wounded' | 'Martyrs' | 'Prisoner';

const AID_LIST_FIELDS = [
  'name',
  'aid_date',
  'aid_type',
  'nature_of_aid',
  'eligibility_status',
  'organization_name',
  'docstatus',
];

const filtersFor = (type: AidRecipientType, name: string) => [
  ['recipient_type', '=', type],
  ['recipient', '=', name],
  ['docstatus', '<', 2],
];

/** One page of a person's aids from the server, newest first. */
export async function fetchPersonAids(
  type: AidRecipientType,
  name: string,
  opts: { start: number; limit: number }
): Promise<Record<string, any>[]> {
  const response = await api.get('/api/method/frappe.client.get_list', {
    params: {
      doctype: 'AID',
      fields: JSON.stringify(AID_LIST_FIELDS),
      filters: JSON.stringify(filtersFor(type, name)),
      order_by: 'aid_date desc, creation desc',
      limit_start: opts.start,
      limit_page_length: opts.limit,
    },
  });
  const data = response.data?.message;
  return Array.isArray(data) ? data : [];
}

export const fetchPersonAidsCount = (type: AidRecipientType, name: string) =>
  getDoctypeCount('AID', filtersFor(type, name));

/**
 * Offline fallback: aids stored on the phone for this recipient (synced + created
 * offline). Only `Recipient` aids: other types aren't stored on the phone.
 */
export async function getLocalPersonAids(name: string): Promise<Record<string, any>[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ data: string }>(
    // Rows synced before recipient_type was downloaded have none → they are Recipient aids.
    `SELECT data FROM aids
     WHERE json_extract(data, '$.recipient') = ?
       AND COALESCE(json_extract(data, '$.recipient_type'), 'Recipient') = 'Recipient'
     ORDER BY json_extract(data, '$.aid_date') DESC`,
    name
  );
  return rows.map((r) => JSON.parse(r.data));
}
