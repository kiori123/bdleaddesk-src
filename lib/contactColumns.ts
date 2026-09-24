/**
 * Cot cho tinh nang "copy danh sach contact" o trang brand.
 *
 * Khong goi API Google Sheets / Microsoft Graph nao ca. Team dung Excel qua
 * Microsoft 365, va sheet cua ho co thu tu cot rieng (co nguoi de LinkedIn
 * truoc Phone, co nguoi nguoc lai). Cach re nhat de khop voi MOI sheet la
 * copy TSV: dan (Ctrl+V) vao Excel/Sheets thi moi cot roi dung o rieng theo
 * tab, khong can biet truoc dinh dang cua ho.
 */

export type ColKey =
  | 'full_name' | 'job_title' | 'email' | 'phone'
  | 'linkedin_url' | 'location' | 'level' | 'brand' | 'source';

export const COLUMN_LABEL: Record<ColKey, string> = {
  full_name: 'Name',
  job_title: 'Job title',
  email: 'Email',
  phone: 'Phone',
  linkedin_url: 'LinkedIn',
  location: 'Location',
  level: 'Level',
  brand: 'Brand',
  source: 'Origin',
};

export const ALL_COLUMNS = Object.keys(COLUMN_LABEL) as ColKey[];

export const DEFAULT_COLUMN_ORDER: ColKey[] = [
  'full_name', 'job_title', 'email', 'phone', 'linkedin_url',
];

const STORAGE_KEY = 'bdleaddesk:contact-copy-columns';

/** Rieng cho tung trinh duyet. Moi PIC ghim thu tu cot theo sheet cua minh. */
export function loadColumnOrder(): ColKey[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMN_ORDER;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length && parsed.every((k) => ALL_COLUMNS.includes(k))) {
      return parsed as ColKey[];
    }
  } catch { /* dung mac dinh */ }
  return DEFAULT_COLUMN_ORDER;
}

export function saveColumnOrder(order: ColKey[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(order)); } catch { /* khong sao */ }
}

export type ContactRow = Partial<Record<ColKey, string | number | null | undefined>>;

/** Moi contact mot dong, cach nhau bang tab, dung dinh dang sheet dang mo. Khong kem dong tieu de. */
export function contactsToTsv(order: ColKey[], rows: ContactRow[]): string {
  const clean = (v: unknown) => String(v ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
  return rows.map((r) => order.map((k) => clean(r[k])).join('\t')).join('\n');
}
