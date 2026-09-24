import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Category nao PIC duoc thay trong dropdown chon truoc khi scan.
 *
 * category_read cho phep MOI nguoi doc MOI category (RLS using(true)), vi
 * admin can thay het de gan category cho brand. Dropdown thi khac: PIC chi
 * duoc thay category minh phu trach, neu khong ho co the chon nham category
 * nguoi khac roi ton credit/quota duoi ten category do. Loc o day, khong dua
 * vao RLS.
 */
export async function visibleCategories(db: SupabaseClient) {
  const [{ data: isAdminRes }, { data: myCats }] = await Promise.all([
    db.rpc('is_admin'),
    db.rpc('my_categories'),
  ]);

  let q = db.from('category').select('id, name').eq('active', true).order('name');
  if (!isAdminRes) q = q.in('id', myCats ?? []);

  const { data } = await q;
  return data ?? [];
}
