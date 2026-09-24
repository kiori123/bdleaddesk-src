import { supabaseAdmin } from '@/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Credit la tien that. Quy trinh bat buoc, khong duoc rut gon:
 *
 *   1. reserveCredit()  truoc khi goi n8n
 *   2. goi n8n reveal
 *   3. commitCredit()   khi n8n bao thanh cong
 *      hoac releaseCredit() khi that bai
 *
 * Ly do phai dat cho truoc: neu chi ghi so sau khi n8n tra ve, thi hai nguoi
 * bam cung luc deu thay con du han muc va deu chay, tieu qua muc cho phep.
 */

export type ReserveResult =
  | { ok: true; ledgerId: string; remaining: number }
  | { ok: false; reason: 'no_budget' | 'insufficient' | 'not_your_category'; remaining: number; needed: number };

/**
 * is_admin() OR categoryId nam trong my_categories() cua nguoi goi - MOT
 * dinh nghia duy nhat, nam trong ham Postgres can_use_category() (xem
 * can_use_category.sql), khong tu doc profile/profile_category o day nua.
 * is_admin() va my_categories() trong DB cung uy quyen ve cung goc do, nen
 * ba noi khong the lech nhau duoc.
 *
 * Nhan userId ro rang (khong dua vao auth.uid()) vi reserveCredit goi ham
 * nay duoi supabaseAdmin() (service role) - khong co phien dang nhap nao ca.
 * can_use_category() ben SQL nhan p_user tuong ung vi ly do y het.
 */
export async function canUseCategory(db: SupabaseClient, userId: string, categoryId: string) {
  const { data, error } = await db.rpc('can_use_category', {
    p_user: userId,
    p_category: categoryId,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function reserveCredit(opts: {
  categoryId: string;
  brandId?: string | null;
  jobId: string;
  amount: number;
  userId: string;
}): Promise<ReserveResult> {
  const db = supabaseAdmin();

  if (!(await canUseCategory(db, opts.userId, opts.categoryId))) {
    return { ok: false, reason: 'not_your_category', remaining: 0, needed: opts.amount };
  }

  // Doc "con lai" va INSERT ledger phai la MOT thao tac atomic, khong phai hai
  // round-trip rieng: hai request cung category, cung luc, deu co the doc thay
  // con du truoc khi ben nao insert xong, deu qua kiem tra, deu insert - tong
  // vuot han muc that su. reserve_credit() (xem fix_contact_rls_and_credit_race.sql)
  // gom ca doc + kiem + insert vao mot ham Postgres, khoa theo category_id
  // trong pham vi transaction do de serialize.
  const { data, error } = await db
    .rpc('reserve_credit', {
      p_category_id: opts.categoryId,
      p_brand_id: opts.brandId ?? null,
      p_job_id: opts.jobId,
      p_amount: opts.amount,
      p_user_id: opts.userId,
    })
    .single();
  if (error) throw error;

  const row = data as { ok: boolean; reason: string | null; remaining: number; ledger_id: string | null };
  if (!row.ok) {
    return {
      ok: false,
      reason: row.reason as 'no_budget' | 'insufficient',
      remaining: row.remaining,
      needed: opts.amount,
    };
  }
  return { ok: true, ledgerId: row.ledger_id!, remaining: row.remaining };
}

export async function commitCredit(jobId: string, actualAmount: number) {
  const db = supabaseAdmin();

  // n8n bao lai so credit thuc te. Lech so voi luc dat cho la dau hieu co gi do
  // sai, phai ghi lai chu khong im lang bo qua.
  const { data: cur } = await db
    .from('credit_ledger').select('amount')
    .eq('job_id', jobId).eq('status', 'reserved').maybeSingle();
  if (!cur) return;

  const clamped = Math.min(Math.max(0, Math.round(actualAmount)), cur.amount);

  // amount co check (amount > 0) - khong the commit voi amount = 0. Thuc te
  // gap khi SignalHire tim ra nguoi nhung khong ai co email/phone (billable
  // = 0): dung y la khong tinh tien ai, tuc la mot lan release toan bo, khong
  // phai mot lan commit "0 dong". Giu nguyen amount goc de khong vi pham
  // constraint; note ghi lai ly do.
  if (clamped === 0) {
    const { error } = await db
      .from('credit_ledger')
      .update({
        status: 'released',
        settled_at: new Date().toISOString(),
        note: `Reserved ${cur.amount}, nothing billable - released in full`,
      })
      .eq('job_id', jobId).eq('status', 'reserved');
    if (error) throw error;
    return;
  }

  const patch: Record<string, unknown> = {
    status: 'committed',
    settled_at: new Date().toISOString(),
    amount: clamped,
  };
  if (clamped !== cur.amount) {
    patch.note = `Dat cho ${cur.amount}, thuc te ${actualAmount}`;
  }

  const { error } = await db
    .from('credit_ledger').update(patch)
    .eq('job_id', jobId).eq('status', 'reserved');
  if (error) throw error;
}

export async function releaseCredit(jobId: string, reason: string) {
  const db = supabaseAdmin();
  const { error } = await db
    .from('credit_ledger')
    .update({ status: 'released', settled_at: new Date().toISOString(), note: reason })
    .eq('job_id', jobId).eq('status', 'reserved');
  if (error) throw error;
}
