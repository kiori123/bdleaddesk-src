'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { nameKey } from '@/lib/nameKey';

/**
 * Dat han muc credit cho mot category trong thang hien tai.
 * Khong cong don: moi thang mot dong rieng trong credit_budget.
 */
export async function setBudget(categoryId: string, granted: number) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  // Kiem quyen o server. Dung tin vao viec giao dien da an nut di.
  const { data: me } = await db.from('profile').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') return { error: 'Only an admin can change budgets.' };

  const n = Math.floor(Number(granted));
  if (!Number.isFinite(n) || n < 0) return { error: 'Budget must be zero or more.' };

  // Ha han muc xuong duoi so da tieu thi chan lai, vi so lieu se thanh am
  // va nguoi dung se thay "con -12 credit".
  const { data: status } = await db
    .from('category_credit_status')
    .select('used, category_name')
    .eq('category_id', categoryId).single();

  if (status && n < status.used) {
    return { error: `${status.category_name} has used ${status.used} credits this month. The budget cannot go below that.` };
  }

  const first = new Date();
  const period = new Date(Date.UTC(first.getFullYear(), first.getMonth(), 1))
    .toISOString().slice(0, 10);

  const { error } = await supabaseAdmin()
    .from('credit_budget')
    .upsert(
      { category_id: categoryId, period_month: period, granted: n,
        updated_by: user.id, updated_at: new Date().toISOString() },
      { onConflict: 'category_id,period_month' }
    );
  if (error) return { error: error.message };

  revalidatePath('/admin');
  revalidatePath('/');
  return { ok: true };
}

/** Them category moi. Slug sinh tu ten, bo dau tieng Viet. */
export async function addCategory(name: string) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const { data: me } = await db.from('profile').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') return { error: 'Only an admin can add categories.' };

  const clean = String(name ?? '').trim();
  if (!clean) return { error: 'Enter a category name.' };

  const slug = clean
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd').replace(/\u0110/g, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const { error } = await supabaseAdmin().from('category').insert({ name: clean, slug });
  if (error) {
    if (error.code === '23505') return { error: `"${clean}" already exists.` };
    return { error: error.message };
  }

  revalidatePath('/admin');
  revalidatePath('/');
  return { ok: true };
}

/**
 * Luu SignalHire API key de n8n hoi lay khi quet.
 *
 * Muc dich: doi key khong phai vao n8n nua, va khi doi instance n8n thi key di
 * theo app chu khong ket lai trong data table cua instance cu.
 */
export async function setSignalhireKey(key: string) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const { data: me } = await db.from('profile').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') return { error: 'Only an admin can change the key.' };

  const clean = String(key ?? '').trim();
  if (clean.length < 12) return { error: 'That key looks too short. Check it again.' };
  if (/\s/.test(clean)) return { error: 'The key cannot contain spaces.' };

  const { error } = await supabaseAdmin()
    .from('app_setting')
    .upsert({ key: 'signalhire_api_key', value: clean, updated_at: new Date().toISOString() },
            { onConflict: 'key' });
  if (error) return { error: error.message };

  revalidatePath('/admin');
  return { ok: true };
}

/** Them hoac sua mot dong alias brand. */
export async function saveAlias(alias: string, employer: string, note: string) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Not signed in.' };
  const { data: me } = await db.from('profile').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') return { error: 'Only an admin can edit aliases.' };

  // nameKey() - phai giong het khoa ma searchBrand() dung luc tra cuu
  // (lib/signalhire.ts), neu khong dong alias ghi vao day se khong bao gio khop.
  const a = nameKey(alias);
  const e = String(employer ?? '').trim();
  if (!a) return { error: 'Enter a brand name.' };
  if (!e) return { error: 'Enter a company name.' };

  // Khoa duy nhat that su la (alias, employer) - brand_alias_alias_employer_uniq.
  // Khong co rang buoc unique tren rieng cot alias.
  //
  // priority: 0 - dong admin tu tay nhap PHAI luon thang moi dong tu hoc
  // (ghiAliasHocDuoc ghi 1 hoac 2). Truoc day cot nay bo trong, roi ra mac
  // dinh 1 - thap hon dong tu hoc qua duong tim lai (khi do la 0), nen mot
  // lan hoc sai qua duong do se de len sua tay cua admin.
  const { error } = await supabaseAdmin().from('brand_alias').upsert(
    { alias: a, employer: e, priority: 0, note: String(note ?? '').trim() || null,
      updated_at: new Date().toISOString() },
    { onConflict: 'alias,employer' }
  );
  if (error) return { error: error.message };

  revalidatePath('/admin');
  return { ok: true };
}

export async function deleteAlias(alias: string) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Not signed in.' };
  const { data: me } = await db.from('profile').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') return { error: 'Only an admin can edit aliases.' };

  const { error } = await supabaseAdmin().from('brand_alias').delete().eq('alias', alias);
  if (error) return { error: error.message };

  revalidatePath('/admin');
  return { ok: true };
}
