'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import {
  CASE_STATUS, STUCK_REASON,
  type CaseState, type CaseStatus, type StuckReason,
} from './caseLabels';

// Hang so va nhan nam o caseLabels.ts. File nay la 'use server' nen chi duoc
// export ham async; de mang hoac object o day thi Next 16 bao loi luc chay.

/**
 * Doc trang thai case. Goi tu client khi mo trang, de khong phai sua page.tsx
 * va doi chu ky props cua BrandView.
 */
export async function getCase(brandId: string): Promise<{ case?: CaseState; error?: string }> {
  const db = await supabaseServer();
  const { data, error } = await db
    .from('brand_progress')
    .select('status, stuck_reason, next_action, next_follow_up, owner_id, owner_name, last_update_at, last_note, days_since_update')
    .eq('id', brandId)
    .single();
  if (error) return { error: 'Could not read this case.' };
  return { case: data as CaseState };
}

/** Danh sach nguoi de gan owner. */
export async function listPeople() {
  const db = await supabaseServer();
  const { data } = await db
    .from('profile').select('id, full_name, role').eq('active', true).order('full_name');
  return (data ?? []) as { id: string; full_name: string | null; role: string }[];
}

/**
 * Mot lan cap nhat cua PIC.
 *
 * Chi ghi vao brand_update. Trigger touch_brand_update ben Postgres tu dong
 * chuyen sang brand: status, stuck_reason, next_action, next_follow_up va
 * last_update_at. Lam vay thi du sau nay co job hay import nao ghi thang vao
 * brand_update, dong ho "lan cuoi cap nhat" van luon dung.
 */
export async function updateCase(brandId: string, f: {
  status: CaseStatus;
  stuck_reason: StuckReason | null;
  note: string;
  next_action: string;
  next_follow_up: string;
}) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  if (!CASE_STATUS.includes(f.status)) return { error: 'Unknown status.' };

  // Stuck ma khong noi vi sao thi bao cao cho sep van la mot o trong, nen chan
  // ngay tu day thay vi de lot xuong bao cao.
  const reason = f.status === 'stuck' ? f.stuck_reason : null;
  if (f.status === 'stuck' && !reason) return { error: 'Pick why it is stuck.' };
  if (reason && !STUCK_REASON.includes(reason)) return { error: 'Unknown reason.' };

  const note = String(f.note ?? '').trim();
  if (!note) return { error: 'Write one line on what happened.' };

  const { error } = await db.from('brand_update').insert({
    brand_id: brandId,
    status: f.status,
    stuck_reason: reason,
    note,
    next_action: String(f.next_action ?? '').trim() || null,
    next_follow_up: String(f.next_follow_up ?? '').trim() || null,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath(`/brand/${brandId}`);
  revalidatePath('/');
  return { ok: true };
}

export async function setOwner(brandId: string, ownerId: string | null) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const { error } = await db.from('brand')
    .update({ owner_id: ownerId }).eq('id', brandId);
  if (error) return { error: error.message };

  revalidatePath(`/brand/${brandId}`);
  revalidatePath('/');
  return { ok: true };
}
