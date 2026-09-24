'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';

export type FileMau = {
  id: string;
  name: string;
  size: number;
  path: string;
  share_url: string | null;
};

/** 10 nam. Link chia se phai song lau hon vong doi mot chien dich outreach. */
const HAN_CHIA_SE = 60 * 60 * 24 * 365 * 10;

/** 5 phut. Du de bam tai ve, va khong du de phat tan. */
const HAN_TAI_VE = 300;

export async function fileCuaMau(templateId: string): Promise<FileMau[]> {
  const db = await supabaseServer();
  const { data } = await db
    .from('template_file')
    .select('id, name, size, path, share_url')
    .eq('template_id', templateId)
    .order('created_at');
  return (data ?? []) as unknown as FileMau[];
}

/**
 * Ghi nhan mot file vua duoc tai len.
 *
 * File di thang tu trinh duyet vao storage, khong qua may chu app: file 25MB di
 * vong qua server action la doi hai lan va cham gap doi. Ham nay chi ghi lai
 * dong tuong ung trong bang.
 */
export async function ghiFile(templateId: string, path: string, name: string, size: number) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  // Duong dan phai nam trong thu muc cua chinh nguoi nay. Policy ben storage da
  // chan roi, nhung bang template_file la mot duong khac nen phai chan lai.
  if (!path.startsWith(`${user.id}/`)) return { error: 'Bad file path.' };

  const { error } = await db.from('template_file').insert({
    profile_id: user.id, template_id: templateId, path, name: name.slice(0, 200), size,
  });
  if (error) return { error: error.message };
  revalidatePath('/templates');
  return { ok: true };
}

/** Duong dan tai ve ngan han, danh cho chinh PIC de tu dinh vao Outlook. */
export async function linkTaiVe(id: string) {
  const db = await supabaseServer();
  const { data: f } = await db
    .from('template_file').select('path').eq('id', id).maybeSingle();
  if (!f) return { error: 'File not found.' };

  const { data, error } = await db.storage
    .from('outreach-files').createSignedUrl((f as any).path, HAN_TAI_VE);
  if (error || !data) return { error: error?.message ?? 'Could not open that file.' };
  return { ok: true, url: data.signedUrl };
}

/**
 * Bat hoac tat che do chia se.
 *
 * Bat: sinh mot duong dan ky ten han 10 nam roi luu lai, de chen vao thu.
 *
 * Tat: KHONG chi xoa cot share_url. Duong dan ky ten da phat ra van con song
 * cho toi khi het han, nen ai da cam link van tai duoc. Phai DOI TEN file trong
 * bucket, luc do moi duong dan cu deu chet. Doi ten xong thi sinh lai duong dan
 * moi cho lan bat sau, va cap nhat path.
 */
export async function doiChiaSe(id: string, bat: boolean) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const { data: f } = await db
    .from('template_file').select('path, name').eq('id', id).maybeSingle();
  if (!f) return { error: 'File not found.' };
  const path = String((f as any).path);

  if (bat) {
    const { data, error } = await db.storage
      .from('outreach-files').createSignedUrl(path, HAN_CHIA_SE);
    if (error || !data) return { error: error?.message ?? 'Could not create the link.' };

    const { error: e2 } = await db.from('template_file')
      .update({ share_url: data.signedUrl }).eq('id', id);
    if (e2) return { error: e2.message };
  } else {
    const duoi = path.split('/').slice(1).join('/');
    const moi = `${user.id}/${crypto.randomUUID()}-${duoi.replace(/^[^-]*-/, '')}`;

    const { error } = await db.storage.from('outreach-files').move(path, moi);
    // Doi ten hong thi KHONG duoc bao la da thu hoi. Noi that de PIC biet link
    // cu van song, con hon de ho tuong da dong ma thuc ra chua.
    if (error) return { error: `Could not revoke the link: ${error.message}` };

    const { error: e2 } = await db.from('template_file')
      .update({ share_url: null, path: moi }).eq('id', id);
    if (e2) return { error: e2.message };
  }

  revalidatePath('/templates');
  return { ok: true };
}

export async function xoaFile(id: string) {
  const db = await supabaseServer();
  const { data: f } = await db
    .from('template_file').select('path').eq('id', id).maybeSingle();
  if (!f) return { error: 'File not found.' };

  // Xoa file truoc, roi moi xoa dong. Nguoc lai thi dong bien mat ma file con
  // nam trong bucket, khong ai nhin thay de don nua.
  const { error } = await db.storage
    .from('outreach-files').remove([String((f as any).path)]);
  if (error) return { error: error.message };

  const { error: e2 } = await db.from('template_file').delete().eq('id', id);
  if (e2) return { error: e2.message };

  revalidatePath('/templates');
  return { ok: true };
}
