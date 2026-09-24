'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * Nhac viec cua CA TEAM.
 *
 * Truoc day day la manh giay tu dan cho chinh minh: ai cung them duoc, va chi
 * minh thay. Nay doi han: CHI ADMIN duoc them, va den han thi MOI PIC deu nhan
 * chuong.
 *
 * Vi la cua chung nen viec "tich xong" phai la cua tung nguoi, cat rieng trong
 * bang reminder_done. De chung mot cot tren reminder thi mot nguoi tich la ca
 * team mat cai nhac do, trong khi ho chua lam gi.
 */

export type Nhac = {
  id: string;
  title: string;
  note: string | null;
  due_on: string;
  closed_at: string | null;
  notified_at: string | null;
  brand_id: string | null;
  brand: { name: string } | null;
  created_by: string;
  nguoiVietTen: string | null;
  toiDaXong: boolean;
};

async function laAdmin() {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { db, user: null, admin: false };
  const { data } = await db.from('profile').select('role').eq('id', user.id).single();
  return { db, user, admin: data?.role === 'admin' };
}

/** Tat ca nhac viec cua team, kem viec chinh minh da tich chua. */
export async function danhSachNhac(): Promise<Nhac[]> {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();

  const [{ data: ds }, { data: daXong }, { data: ten }] = await Promise.all([
    db.from('reminder')
      .select('id, title, note, due_on, closed_at, notified_at, brand_id, created_by, brand(name)')
      .order('closed_at', { nullsFirst: true })
      .order('due_on'),
    user
      ? db.from('reminder_done').select('reminder_id').eq('profile_id', user.id)
      : Promise.resolve({ data: [] as { reminder_id: string }[] }),
    db.from('profile_name').select('id, full_name'),
  ]);

  const xong = new Set((daXong ?? []).map((r: any) => r.reminder_id));
  const tenTheoId = new Map((ten ?? []).map((p: any) => [p.id, p.full_name]));

  return ((ds ?? []) as any[]).map((r) => ({
    ...r,
    nguoiVietTen: tenTheoId.get(r.created_by) ?? null,
    toiDaXong: xong.has(r.id),
  })) as Nhac[];
}

export async function themNhac(f: {
  title: string; note: string; due_on: string; brand_id: string | null;
}) {
  const { db, user, admin } = await laAdmin();
  if (!user) return { error: 'Not signed in.' };
  // RLS da chan roi, nhung chan them o day de bao duoc mot cau tu te thay vi
  // nem ra loi cua Postgres.
  if (!admin) return { error: 'Only an admin can add a team reminder.' };

  const ten = f.title.trim();
  if (!ten) return { error: 'Write what the team should be reminded about.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.due_on)) return { error: 'Pick a date.' };

  const { error } = await db.from('reminder').insert({
    created_by: user.id,
    brand_id: f.brand_id || null,
    title: ten.slice(0, 200),
    note: f.note.trim().slice(0, 1000) || null,
    due_on: f.due_on,
  });
  if (error) return { error: error.message };
  revalidatePath('/reminders');
  return { ok: true };
}

/** Tich xong cua RIENG minh. Khong dung den cua nguoi khac. */
export async function xongNhac(id: string, xong: boolean) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const { error } = xong
    ? await db.from('reminder_done')
        .upsert({ reminder_id: id, profile_id: user.id }, { onConflict: 'reminder_id,profile_id' })
    : await db.from('reminder_done')
        .delete().eq('reminder_id', id).eq('profile_id', user.id);

  if (error) return { error: error.message };
  revalidatePath('/reminders');
  return { ok: true };
}

export async function xoaNhac(id: string) {
  const { db, admin } = await laAdmin();
  if (!admin) return { error: 'Only an admin can delete a team reminder.' };
  const { error } = await db.from('reminder').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/reminders');
  return { ok: true };
}

/**
 * Admin dong mot nhac viec lai: no thoi khong ban chuong nua nhung van con
 * trong danh sach. Xoa han thi mat dau vet ca team da tung duoc nhac gi.
 */
export async function dongNhac(id: string, dong: boolean) {
  const { db, admin } = await laAdmin();
  if (!admin) return { error: 'Only an admin can close a team reminder.' };
  const { error } = await db.from('reminder')
    .update({
      closed_at: dong ? new Date().toISOString() : null,
      // Mo lai thi cho no duoc bao lai tu dau, khong thi no im vinh vien va
      // khong ai hieu tai sao.
      ...(dong ? {} : { notified_at: null }),
    })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/reminders');
  return { ok: true };
}

/** Ai da tich xong nhac viec nay. Chi admin goi duoc. */
export async function aiDaXong(id: string) {
  const { db, admin } = await laAdmin();
  if (!admin) return { error: 'Only an admin can see that.' as string };

  const [{ data: xong }, { data: moiNguoi }] = await Promise.all([
    db.from('reminder_done').select('profile_id').eq('reminder_id', id),
    db.from('profile_name').select('id, full_name'),
  ]);

  const r = new Set((xong ?? []).map((x: any) => x.profile_id));
  const ds = (moiNguoi ?? []) as { id: string; full_name: string | null }[];
  return {
    xong: ds.filter((p) => r.has(p.id)).map((p) => p.full_name ?? 'Someone'),
    chua: ds.filter((p) => !r.has(p.id)).map((p) => p.full_name ?? 'Someone'),
  };
}
