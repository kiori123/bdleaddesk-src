/**
 * Mot noi DUY NHAT dinh nghia "contact nay do app tim ra hay do nguoi them tay".
 *
 * Quy tac (co dinh, xem CLAUDE.md / bao cao kem theo):
 *   - source = 'manual' -> nguoi tu them tay.
 *   - moi gia tri source KHAC -> app tim ra.
 *
 * Viet theo huong "khac manual" (denylist), KHONG viet theo huong "nam trong
 * danh sach nay" (allowlist). Ly do: mot allowlist liet ke tung gia tri
 * app-generated se am tham xep sai moi gia tri source moi sinh ra sau nay vao
 * "manually added" - gan nhu khong bao gio dung, vi nguon moi hau het la mot
 * cach tim moi CUA APP (vi du them mot nha cung cap khac ngoai SignalHire),
 * khong phai mot cach nguoi tu nhap moi. "Khac manual" that bai theo huong an
 * toan hon: gia tri la nay se mac dinh tinh la app-generated cho den khi co
 * quyet dinh ro rang xep no vao 'manual'.
 *
 * Da xac minh truc tiep tren Postgres that (khong chi doc schema.sql - file do
 * tung duoc ghi nhan la khong con khop DB, xem can_use_category.sql) rang
 * contact_source hien chi co dung 4 gia tri: signalhire, seed_verified,
 * pasted_linkedin, manual. Nhung dieu do KHONG doi cach viet ham nay - neu mai
 * sau co gia tri thu nam, no phai tu dong roi vao app-generated.
 *
 * seed_verified khong ton credit nhung VAN di qua pipeline SignalHire, nen tinh
 * la app-generated - KHONG phan loai theo co ton credit hay khong (xem
 * isByCredit/isFree o UsagePanel.tsx, mot truc khac han).
 *
 * import_batch KHONG duoc dung o day. No la mot truc khac (contact vao DB kieu
 * gi - xem UsagePanel.tsx), khong lien quan gi den ai/cai gi tao ra contact.
 *
 * Moi noi dem/nhom/loc/hien contact theo nguon goc PHAI goi qua ham nay, khong
 * tu viet lai dieu kien source === '...' hay source in (...).
 */

export type ContactSource = 'signalhire' | 'seed_verified' | 'pasted_linkedin' | 'manual';

export const CONTACT_SOURCES: ContactSource[] = [
  'signalhire', 'seed_verified', 'pasted_linkedin', 'manual',
];

// Nhan doc duoc cho tung gia tri source THAT (khac voi ORIGIN_LABEL o duoi,
// chi gom hai nhom app/manual). Dung o admin edit va o loc "Researched
// brands" - moi noi can hien/loc theo DUNG gia tri source phai lay tu day,
// khong tu viet lai chuoi.
export const SOURCE_LABEL: Record<ContactSource, string> = {
  signalhire: 'SignalHire search',
  pasted_linkedin: 'Pasted LinkedIn link',
  seed_verified: 'Verified seed list',
  manual: 'Added by hand',
};

export function isAppGenerated(source: string | null | undefined): boolean {
  return source !== 'manual';
}

/**
 * TRUC TIEN, doc lap voi isAppGenerated(): mot credit co that su bi tieu cho
 * contact nay hay khong.
 *
 * Khac isAppGenerated() o dung mot cho: `seed_verified` di qua pipeline
 * SignalHire nen LA app-generated, nhung khong goi API nen amount = 0 va khong
 * co dong ledger nao (xem CLAUDE.md, "Contact tu seed khong ton credit").
 *
 * Truoc day ham nay la mot lambda nam trong UsagePanel.tsx. Chuyen ra day khi
 * sheet "Credit & Contacts" cua export can dung no: mot ban thu hai cua phep
 * phan loai nay se lech voi UsagePanel ma khong co gi bao - dung cai bay ghi
 * chu dau file nay noi den.
 *
 * Viet theo huong ALLOWLIST (khac isAppGenerated, co y): mot nguon moi phai
 * duoc quyet dinh RO RANG la co ton credit hay khong. Mac dinh cho la "khong
 * ton" thi an toan hon - no lam mot con so bao cao be di, chu khong bao la da
 * tieu tien vao mot thu chua bao gio tieu.
 */
export function isByCredit(source: string | null | undefined): boolean {
  return source === 'signalhire' || source === 'pasted_linkedin';
}

export const ORIGIN_LABEL = {
  app: 'Found by the app',
  manual: 'Added by hand',
} as const;

export type OriginLabel = typeof ORIGIN_LABEL[keyof typeof ORIGIN_LABEL];

export function originLabel(source: string | null | undefined): OriginLabel {
  return isAppGenerated(source) ? ORIGIN_LABEL.app : ORIGIN_LABEL.manual;
}
