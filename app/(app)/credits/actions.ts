'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * PIC xin them credit. Gui cho mot PIC cu the (toProfileId) hoac de trong de
 * xin thang admin. Trigger credit_request_notify lo phan bao chuong.
 */
export async function askCredits(input: {
  categoryId: string;
  toProfileId: string | null;
  amount: number;
  brandName?: string | null;
  reason?: string | null;
}) {
  if (!input.categoryId) return { error: 'Pick the category the credits should go to.' };
  if (!Number.isFinite(input.amount) || input.amount < 1) {
    return { error: 'Ask for at least 1 credit.' };
  }

  const db = await supabaseServer();
  const { error } = await db.from('credit_request').insert({
    category_id: input.categoryId,
    to_profile_id: input.toProfileId,
    amount: Math.floor(input.amount),
    brand_name: input.brandName?.trim() || null,
    reason: input.reason?.trim() || null,
  });

  if (error) return { error: `Could not send the request: ${error.message}` };
  revalidatePath('/credits');
  return { ok: true };
}

/**
 * Duyet hoac tu choi. Toan bo kiem tra quyen, han muc nguoi cho va viec chuyen
 * credit nam trong ham Postgres, khong lam o day.
 */
export async function decideRequest(requestId: string, approve: boolean, note?: string) {
  const db = await supabaseServer();

  const { error } = approve
    ? await db.rpc('approve_credit_request', { p_request_id: requestId })
    : await db.rpc('reject_credit_request', { p_request_id: requestId, p_note: note ?? null });

  if (error) return { error: error.message };
  revalidatePath('/credits');
  return { ok: true };
}
