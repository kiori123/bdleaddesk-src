'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { rankOf } from '@/lib/orgRank';

const FIRST = 'first_meeting';

/**
 * Bat dau theo doi mot brand. Dat o buoc dau tien, giong portal cu.
 * Brand chua co category thi phai chon truoc: khong co category thi brand
 * khong tinh vao han muc credit nao va chi admin nhin thay.
 */
export async function trackBrand(brandId: string, categoryId?: string | null) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const { data: b, error: readErr } = await db
    .from('brand').select('stage, category_id').eq('id', brandId).single();
  if (readErr || !b) return { error: 'Could not open this brand.' };

  if (!b.category_id && !categoryId) return { needCategory: true };

  const patch: Record<string, unknown> = {
    stage: FIRST, stage_changed_at: new Date().toISOString(),
  };
  if (categoryId) patch.category_id = categoryId;

  const { error } = await db.from('brand').update(patch).eq('id', brandId);
  if (error) return { error: error.message };

  await db.from('brand_stage_event').insert({
    brand_id: brandId, from_stage: b.stage ?? null, to_stage: FIRST, changed_by: user.id,
  });

  revalidatePath('/');
  revalidatePath(`/brand/${brandId}`);
  return { ok: true };
}

/** Bo theo doi: xoa stage, giu nguyen lien he va tai lieu. */
export async function untrackBrand(brandId: string) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const { data: cur } = await db.from('brand').select('stage').eq('id', brandId).single();

  const { error } = await db.from('brand')
    .update({ stage: null, stage_changed_at: new Date().toISOString() })
    .eq('id', brandId);
  if (error) return { error: error.message };

  await db.from('brand_stage_event').insert({
    brand_id: brandId, from_stage: cur?.stage ?? null, to_stage: null, changed_by: user.id,
  });

  revalidatePath('/');
  return { ok: true };
}

export async function addContact(brandId: string, f: {
  full_name: string; job_title: string; company: string; email: string; phone: string; linkedin_url: string;
}) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const name = String(f.full_name ?? '').trim();
  const email = String(f.email ?? '').trim();
  const phone = String(f.phone ?? '').trim();
  if (!name) return { error: 'Name is required.' };
  if (!email && !phone) return { error: 'At least email or phone is required.' };

  // Thu hang lay tu lib/orgRank - dung chung voi /api/ingest va trang brand,
  // de contact them tay va contact tu scan xep cung mot thang.
  const { error } = await db.from('contact').insert({
    brand_id: brandId, full_name: name,
    job_title: String(f.job_title ?? '').trim() || null,
    company: String(f.company ?? '').trim() || null,
    email: email || null, phone: phone || null,
    linkedin_url: String(f.linkedin_url ?? '').trim() || null,
    org_rank: rankOf(f.job_title), source: 'manual', revealed_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath('/');
  revalidatePath(`/brand/${brandId}`);
  return { ok: true };
}

/**
 * Xoa han mot brand: keo theo lien he, note, lich su stage (khoa ngoai cascade)
 * va toan bo tai lieu trong storage.
 *
 * File tren storage khong co khoa ngoai nen Postgres khong tu don duoc, phai
 * xoa tay truoc, neu khong chung nam lai vinh vien va van an dung luong.
 * Dong so credit thi GIU LAI: brand bi xoa khong lam so tien da tieu bien mat.
 */
export async function deleteBrand(brandId: string) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  // Doc qua RLS: khong phu trach category cua brand nay thi khong xoa duoc.
  const { data: b } = await db.from('brand').select('id, name').eq('id', brandId).single();
  if (!b) return { error: 'Could not open this brand.' };

  const store = supabaseAdmin().storage.from('brand-docs');
  const { data: files } = await store.list(brandId, { limit: 200 });
  if (files?.length) {
    await store.remove(files.filter((f: any) => f.id).map((f: any) => `${brandId}/${f.name}`));
  }

  const { error } = await db.from('brand').delete().eq('id', brandId);
  if (error) return { error: error.message };

  revalidatePath('/');
  return { ok: true };
}

/** Tao brand moi tu giao dien. Ten trung thi bao lai chu khong tao ban sao. */
export async function createBrand(name: string, categoryId: string | null) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const clean = String(name ?? '').trim();
  if (!clean) return { error: 'Brand name is required.' };
  if (clean.length > 90) return { error: 'That name is too long.' };

  // Cung cach chuan hoa voi pipeline n8n va script migrate, de "A2 Milk",
  // "a2 milk" va "A2  Milk" deu ve mot brand.
  const key = clean
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd').replace(/\u0110/g, 'd')
    .toLowerCase().replace(/\s+/g, ' ').trim();

  const { data: exists } = await supabaseAdmin()
    .from('brand').select('id, name').eq('name_key', key).maybeSingle();
  if (exists) return { error: `${exists.name} is already on the list.` };

  const { data: row, error } = await db.from('brand')
    .insert({ name_key: key, name: clean, tier: 1, category_id: categoryId, created_by: user.id })
    .select('id').single();
  if (error) return { error: error.message };

  revalidatePath('/');
  return { ok: true, id: row.id };
}

