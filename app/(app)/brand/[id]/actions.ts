'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { CONTACT_SOURCES, type ContactSource } from '@/lib/contactOrigin';

const STAGES = ['first_meeting','internal_review','bp_pitch','negotiating','live'] as const;
export type Stage = typeof STAGES[number];

/**
 * Doi stage. RLS lo phan chan: nguoi khong phu trach category cua brand nay
 * khong update duoc dong nao. Bam lai dung stage dang co = bo theo doi.
 */
export async function setStage(brandId: string, next: Stage | null) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Not signed in.' };
  if (next !== null && !STAGES.includes(next)) return { error: 'Unknown stage.' };

  const { data: cur, error: readErr } = await db
    .from('brand').select('stage').eq('id', brandId).single();
  if (readErr) return { error: 'Could not open this brand.' };

  const target = cur?.stage === next ? null : next;

  const { error } = await db.from('brand')
    .update({ stage: target, stage_changed_at: new Date().toISOString() })
    .eq('id', brandId);
  if (error) return { error: error.message };

  await db.from('brand_stage_event').insert({
    brand_id: brandId, from_stage: cur?.stage ?? null, to_stage: target, changed_by: user.id,
  });

  revalidatePath(`/brand/${brandId}`);
  revalidatePath('/');
  return { ok: true, stage: target };
}

export async function setCategory(brandId: string, categoryId: string | null) {
  const db = await supabaseServer();
  const { error } = await db.from('brand')
    .update({ category_id: categoryId }).eq('id', brandId);
  if (error) return { error: 'Could not save.' };
  revalidatePath(`/brand/${brandId}`);
  revalidatePath('/');
  return { ok: true };
}

export async function addNote(brandId: string, body: string) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const clean = String(body ?? '').trim();
  if (!clean) return { error: 'Nothing to save.' };

  const { error } = await db.from('brand_note')
    .insert({ brand_id: brandId, body: clean, created_by: user.id });
  if (error) return { error: 'Could not save.' };

  revalidatePath(`/brand/${brandId}`);
  return { ok: true };
}

export async function deleteContact(contactId: string, brandId: string) {
  const db = await supabaseServer();
  const { error } = await db.from('contact').delete().eq('id', contactId);
  if (error) return { error: error.message };
  revalidatePath(`/brand/${brandId}`);
  return { ok: true };
}

/**
 * Sua tay mot contact da co san - vd dien email SignalHire da bo lo nhung tim
 * duoc qua extension.
 *
 * `source` chi admin moi doi duoc. Truong do la dau vet duy nhat de UsagePanel
 * biet mot contact co ton credit hay khong (isByCredit trong UsagePanel.tsx)
 * va Origin badge biet "app tim ra" hay "them tay" (xem lib/contactOrigin.ts).
 * Sua no qua tay se lam lech so lieu credit da tieu so voi thuc te, dung noi
 * CLAUDE.md canh bao ve viec cho hai con so nay lech nhau - nen chi nguoi sua
 * duoc phep chiu trach nhiem cho con so do (admin) moi dung tay vao.
 *
 * Kiem is_admin() ngay tai server, KHONG tin field isAdmin tu client: modal
 * chi an nut di voi nguoi khong phai admin, ai goi thang action nay voi source
 * van bi chan o day.
 */
export async function updateContact(contactId: string, brandId: string, f: {
  full_name: string; job_title: string; company: string; email: string; phone: string; linkedin_url: string;
  source?: string;
}) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const name = String(f.full_name ?? '').trim();
  const email = String(f.email ?? '').trim();
  const phone = String(f.phone ?? '').trim();
  if (!name) return { error: 'Name is required.' };
  if (!email && !phone) return { error: 'At least email or phone is required.' };

  const patch: Record<string, unknown> = {
    full_name: name,
    job_title: String(f.job_title ?? '').trim() || null,
    company: String(f.company ?? '').trim() || null,
    email: email || null, phone: phone || null,
    linkedin_url: String(f.linkedin_url ?? '').trim() || null,
  };

  if (f.source !== undefined) {
    const { data: admin } = await db.rpc('is_admin');
    if (!admin) return { error: 'Only an admin can change where a contact came from.' };
    if (!CONTACT_SOURCES.includes(f.source as ContactSource)) {
      return { error: 'Unknown source value.' };
    }
    patch.source = f.source;
  }

  const { error } = await db.from('contact').update(patch).eq('id', contactId);
  if (error) return { error: error.message };

  revalidatePath(`/brand/${brandId}`);
  return { ok: true };
}

