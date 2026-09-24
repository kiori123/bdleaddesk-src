'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';

export type Notif = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

/**
 * Hop thu cua chinh minh. RLS lo phan chan: policy notification_own chi cho
 * doc dong co profile_id = auth.uid(), nen khong can loc lai o day.
 */
export async function myNotifications(): Promise<Notif[]> {
  const db = await supabaseServer();
  const { data } = await db
    .from('notification')
    .select('id, kind, title, body, link, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  return (data ?? []) as Notif[];
}

export async function markRead(id: string) {
  const db = await supabaseServer();
  const { error } = await db
    .from('notification')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/');
  return { ok: true };
}

export async function markAllRead() {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const { error } = await db
    .from('notification')
    .update({ read_at: new Date().toISOString() })
    .eq('profile_id', user.id)
    .is('read_at', null);
  if (error) return { error: error.message };
  revalidatePath('/');
  return { ok: true };
}
