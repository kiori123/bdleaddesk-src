/**
 * Thu hang trong so do to chuc, suy tu chuc danh.
 *
 * MOT NGUON DUY NHAT. Truoc day ham nay ton tai ba ban sao roi rac o
 * app/(app)/actions.ts, app/(app)/brand/[id]/actions.ts va app/api/ingest/route.ts.
 * Sua mot cho quen hai cho kia thi contact them tay xep hang khac contact tu
 * scan, va so do to chuc hien sai ma khong co gi bao.
 *
 * File nay KHONG co 'use server': file server action chi duoc export ham async,
 * ma day la ham thuong. De o lib de ca ba noi import duoc.
 *
 * Thang do: so cang nho cang cao. Giu nguyen 15 / 30 / 45 / 60 nhu portal cu de
 * du lieu da luu khong bi lech.
 */

export const RANK_EXEC = 15;   // CEO, chu tich, nha sang lap
export const RANK_DIR = 30;    // giam doc, head, country lead
export const RANK_MGR = 45;    // truong phong, manager
export const RANK_STAFF = 60;  // con lai

// Ba muc gom tieng Anh, Viet, Trung, Nhat, Han - dong bo voi node loc ben n8n.
// Thieu tieng chau A thi contact them tay o thi truong Nhat / Trung se roi het
// xuong day, va so do to chuc dao lon.
const EXEC =
  /\bceo\b|\bcfo\b|\bcoo\b|\bcto\b|\bcmo\b|chief|president|founder|co-?founder|owner|managing director|general director|tổng giám đốc|chủ tịch|người sáng lập|总裁|总经理|首席|董事长|创始人|社長|代表取締役|会長|대표이사|사장|회장/i;

const DIR =
  /director|\bvp\b|vice president|\bsvp\b|\bevp\b|head of|\bhead\b|country manager|country lead|general manager|giám đốc|phó giám đốc|trưởng khối|总监|副总|部長|本部長|執行役員|이사|상무|전무|본부장/i;

const MGR =
  /manager|\blead\b|supervisor|principal|trưởng phòng|trưởng bộ phận|trưởng nhóm|quản lý|tổ trưởng|经理|主管|课长|課長|マネージャー|과장|팀장|차장/i;

export function rankOf(title: string | null | undefined): number {
  const t = String(title ?? '');
  if (!t.trim()) return RANK_STAFF;
  if (EXEC.test(t)) return RANK_EXEC;
  if (DIR.test(t)) return RANK_DIR;
  if (MGR.test(t)) return RANK_MGR;
  return RANK_STAFF;
}

/** Nhan cua tung bac, dung khi hien so do to chuc. */
export function rankLabel(rank: number | null | undefined): string {
  const r = rank ?? RANK_STAFF;
  if (r <= RANK_EXEC) return 'Executive';
  if (r <= RANK_DIR) return 'Head / Director';
  if (r <= RANK_MGR) return 'Manager';
  return 'Team';
}
