'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { MAU_KHOI_DAU } from '@/lib/template';

export type Mau = {
  id: string;
  name: string;
  subject: string;
  body: string;
  /** CC co dinh, ngan cach bang dau phay. Rong la khong CC ai. */
  cc: string;
  is_default: boolean;
  updated_at: string;
};

/**
 * Mau thu cua chinh nguoi dang dang nhap.
 *
 * RLS lo phan chan: policy email_template_own chi cho dong co
 * profile_id = auth.uid(). Nen o day khong loc lai bang tay, chi can KHONG dung
 * service_role.
 */
export async function mauCuaToi(): Promise<Mau[]> {
  const db = await supabaseServer();
  const { data } = await db
    .from('email_template')
    .select('id, name, subject, body, cc, is_default, updated_at')
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false });
  return (data ?? []) as unknown as Mau[];
}

export async function themMau(khoiDau = false) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  // Mau dau tien cua mot nguoi thi dat luon lam mac dinh. Neu khong, ho soan
  // xong mot mau roi bam Email o trang brand va khong hieu vi sao thu van trong.
  const { count } = await db
    .from('email_template').select('id', { count: 'exact', head: true });

  const row = khoiDau
    ? MAU_KHOI_DAU
    : { name: 'Untitled template', subject: '', body: '', cc: '' };

  const { data, error } = await db
    .from('email_template')
    .insert({ ...row, profile_id: user.id, is_default: (count ?? 0) === 0 })
    .select('id').single();

  if (error) return { error: error.message };
  revalidatePath('/templates');
  return { ok: true, id: data?.id as string };
}

export async function luuMau(
  id: string,
  v: { name: string; subject: string; body: string; cc: string },
) {
  const db = await supabaseServer();
  const ten = v.name.trim();
  if (!ten) return { error: 'Give the template a name.' };

  const { error } = await db
    .from('email_template')
    .update({
      name: ten.slice(0, 120), subject: v.subject, body: v.body,
      cc: v.cc.trim().slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { error: error.message };
  revalidatePath('/templates');
  return { ok: true };
}

export async function datMacDinh(id: string) {
  const db = await supabaseServer();
  // Ham trong DB, khong phai hai lenh update tu day: giua hai lenh se co mot
  // khoanh khac khong mau nao mac dinh, hoac hai mau cung mac dinh va chi muc
  // duy nhat tu choi lenh thu hai.
  const { error } = await db.rpc('set_default_template', { p_id: id });
  if (error) return { error: error.message };
  revalidatePath('/templates');
  return { ok: true };
}

export async function xoaMau(id: string) {
  const db = await supabaseServer();
  const { data: mau } = await db
    .from('email_template').select('is_default').eq('id', id).maybeSingle();

  const { error } = await db.from('email_template').delete().eq('id', id);
  if (error) return { error: error.message };

  // Xoa mat mau mac dinh thi phong mot cai khac len. Khong lam thi nut Email o
  // trang brand lang le quay ve thu trong.
  if ((mau as any)?.is_default) {
    const { data: con } = await db
      .from('email_template').select('id').order('updated_at', { ascending: false }).limit(1);
    const keId = (con ?? [])[0]?.id;
    if (keId) await db.rpc('set_default_template', { p_id: keId });
  }

  revalidatePath('/templates');
  return { ok: true };
}
