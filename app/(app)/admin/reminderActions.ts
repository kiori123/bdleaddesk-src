'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';

export type Rule = {
  id: string;
  name: string;
  active: boolean;
  day_of_week: number | null;
  time_of_day: string;
  stale_days: number;
  escalate_after_h: number | null;
  target_stage: string | null;
  target_category_id: string | null;
  target_profile_id: string | null;
  last_run_at: string | null;
};

// DAYS song ben ReminderCenter.tsx. File 'use server' chi duoc export ham
// async: moi export khac bi bien thanh proxy, nen mang hang so o day se khong
// con la mang khi client dung toi.

export async function listRules() {
  const db = await supabaseServer();
  const [{ data: rules }, { data: cats }, { data: people }] = await Promise.all([
    db.from('reminder_rule').select('*').order('name'),
    db.from('category').select('id, name').eq('active', true).order('name'),
    db.from('profile').select('id, full_name').eq('active', true).order('full_name'),
  ]);
  return {
    rules: (rules ?? []) as Rule[],
    cats: (cats ?? []) as { id: string; name: string }[],
    people: (people ?? []) as { id: string; full_name: string | null }[],
  };
}

function validate(f: Partial<Rule>) {
  if (!String(f.name ?? '').trim()) return 'Give the rule a name.';
  if (f.stale_days != null && (f.stale_days < 1 || f.stale_days > 90))
    return 'Days without update must be between 1 and 90.';
  if (f.day_of_week != null && (f.day_of_week < 0 || f.day_of_week > 6))
    return 'Pick a valid day.';
  if (f.escalate_after_h != null && (f.escalate_after_h < 0 || f.escalate_after_h > 720))
    return 'Escalation must be between 0 and 30 days.';
  return null;
}

export async function saveRule(f: Partial<Rule> & { id?: string }) {
  const db = await supabaseServer();
  const bad = validate(f);
  if (bad) return { error: bad };

  const row = {
    name: String(f.name).trim(),
    active: f.active ?? true,
    day_of_week: f.day_of_week ?? null,
    time_of_day: f.time_of_day || '09:00',
    stale_days: f.stale_days ?? 5,
    // 0 tren giao dien nghia la khong leo thang bao gio, luu thanh null de
    // ham queue_escalations bo qua quy tac nay han
    escalate_after_h: f.escalate_after_h ? f.escalate_after_h : null,
    target_stage: f.target_stage || null,
    target_category_id: f.target_category_id || null,
    target_profile_id: f.target_profile_id || null,
  };

  const { error } = f.id
    ? await db.from('reminder_rule').update(row).eq('id', f.id)
    : await db.from('reminder_rule').insert(row);

  // RLS chan bang is_admin(). Loi o day gan nhu chac chan la khong phai admin,
  // noi thang thay vi tra ve thong bao Postgres kho hieu.
  if (error) return { error: error.message.includes('policy')
    ? 'Only an admin can change reminders.' : error.message };

  revalidatePath('/admin');
  return { ok: true };
}

export async function toggleRule(id: string, active: boolean) {
  const db = await supabaseServer();
  const { error } = await db.from('reminder_rule').update({ active }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin');
  return { ok: true };
}

export async function deleteRule(id: string) {
  const db = await supabaseServer();
  const { error } = await db.from('reminder_rule').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin');
  return { ok: true };
}

/**
 * Chay thu ngay bay gio, bo qua lich. Dung de admin biet quy tac se bat ai
 * truoc khi cho no chay that sang hom sau.
 */
export async function runNow() {
  const db = await supabaseServer();
  const { data, error } = await db.rpc('queue_stale_reminders');
  if (error) return { error: error.message };

  // Chay leo thang ngay sau, giong hai cron chay lien nhau moi sang, de nut
  // Run now phan anh dung mot vong thuc te chu khong chi mot nua.
  const esc = await db.rpc('queue_escalations');

  revalidatePath('/admin');
  return {
    ok: true,
    made: (data as number) ?? 0,
    escalated: (esc.data as number) ?? 0,
  };
}

/** Xem truoc: ai se bi nhac neu quy tac chay ngay bay gio. */
export async function previewRule(staleDays: number, categoryId: string | null, profileId: string | null) {
  const db = await supabaseServer();
  let q = db.from('brand_progress')
    .select('brand, owner_name, owner_id, days_since_update, status')
    .gte('days_since_update', staleDays)
    .not('owner_id', 'is', null)
    .not('status', 'in', '(won,lost)');
  if (categoryId) q = q.eq('category_id', categoryId);
  if (profileId)  q = q.eq('owner_id', profileId);
  const { data } = await q.order('days_since_update', { ascending: false });
  return (data ?? []) as { brand: string; owner_name: string | null; days_since_update: number }[];
}
