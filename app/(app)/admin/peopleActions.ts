'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type Person = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'pic';
  active: boolean;
  category_ids: string[];
  brands_owned: number;
};

async function requireAdmin() {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Not signed in.' as const };
  const { data: me } = await db.from('profile').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') return { error: 'Only an admin can manage people.' as const };
  return { userId: user.id };
}

export async function listPeople() {
  const db = await supabaseServer();
  const [{ data: people }, { data: cats }, { data: links }, { data: owned }] = await Promise.all([
    db.from('profile').select('id, email, full_name, role, active').order('email'),
    db.from('category').select('id, name').eq('active', true).order('name'),
    db.from('profile_category').select('profile_id, category_id'),
    db.from('brand').select('owner_id'),
  ]);

  const byPerson = new Map<string, string[]>();
  for (const l of links ?? []) {
    const arr = byPerson.get(l.profile_id) ?? [];
    arr.push(l.category_id);
    byPerson.set(l.profile_id, arr);
  }
  const ownCount = new Map<string, number>();
  for (const b of owned ?? []) {
    if (b.owner_id) ownCount.set(b.owner_id, (ownCount.get(b.owner_id) ?? 0) + 1);
  }

  return {
    people: (people ?? []).map((p: any): Person => ({
      ...p,
      category_ids: byPerson.get(p.id) ?? [],
      brands_owned: ownCount.get(p.id) ?? 0,
    })),
    cats: (cats ?? []) as { id: string; name: string }[],
  };
}

/** Bat/tat mot category cho mot nguoi. */
export async function toggleCategory(profileId: string, categoryId: string, on: boolean) {
  const gate = await requireAdmin();
  if ('error' in gate) return { error: gate.error };

  const db = supabaseAdmin();
  const { error } = on
    ? await db.from('profile_category')
        .upsert({ profile_id: profileId, category_id: categoryId },
                { onConflict: 'profile_id,category_id' })
    : await db.from('profile_category')
        .delete().eq('profile_id', profileId).eq('category_id', categoryId);

  if (error) return { error: error.message };
  revalidatePath('/admin');
  revalidatePath('/');
  return { ok: true };
}

export async function setName(profileId: string, name: string) {
  const gate = await requireAdmin();
  if ('error' in gate) return { error: gate.error };

  const clean = String(name ?? '').trim();
  if (!clean) return { error: 'Enter a name.' };

  const { error } = await supabaseAdmin()
    .from('profile').update({ full_name: clean }).eq('id', profileId);
  if (error) return { error: error.message };
  revalidatePath('/admin');
  revalidatePath('/');
  return { ok: true };
}

export async function setRole(profileId: string, role: 'admin' | 'pic') {
  const gate = await requireAdmin();
  if ('error' in gate) return { error: gate.error };

  // Ha chinh minh xuong pic thi mat quyen vao trang nay, va neu la admin cuoi
  // cung thi khong ai con vao duoc nua. Chan ca hai truong hop.
  if (profileId === gate.userId && role !== 'admin') {
    return { error: 'You cannot remove your own admin role.' };
  }
  if (role !== 'admin') {
    const db = await supabaseServer();
    const { count } = await db.from('profile')
      .select('id', { count: 'exact', head: true }).eq('role', 'admin').eq('active', true);
    if ((count ?? 0) <= 1) return { error: 'This is the last admin. Promote someone else first.' };
  }

  const { error } = await supabaseAdmin()
    .from('profile').update({ role }).eq('id', profileId);
  if (error) return { error: error.message };
  revalidatePath('/admin');
  return { ok: true };
}

export async function setActive(profileId: string, active: boolean) {
  const gate = await requireAdmin();
  if ('error' in gate) return { error: gate.error };

  if (profileId === gate.userId && !active) {
    return { error: 'You cannot switch off your own account.' };
  }

  // Tat nguoi dang giu brand thi brand do thanh vo chu va khong ai duoc nhac.
  // Khong chan, nhung phai bao ro.
  let warn = '';
  if (!active) {
    const db = await supabaseServer();
    const { count } = await db.from('brand')
      .select('id', { count: 'exact', head: true }).eq('owner_id', profileId);
    if ((count ?? 0) > 0) {
      warn = `${count} brand still owned by this person. Reassign them or nobody gets reminded.`;
    }
  }

  const { error } = await supabaseAdmin()
    .from('profile').update({ active }).eq('id', profileId);
  if (error) return { error: error.message };
  revalidatePath('/admin');
  revalidatePath('/');
  return { ok: true, warn };
}
