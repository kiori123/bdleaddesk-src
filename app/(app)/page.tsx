import { supabaseServer } from '@/lib/supabase/server';
import BrandBoard, { type Row } from './BrandBoard';

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'khoa@onpoint.vn';

// Buoc scan nam trong app, o /scan. n8n da bi go bo hoan toan, khong con
// duong nao khac de tro toi.
const SCAN_URL = '/scan';

export default async function BrandsPage() {
  const db = await supabaseServer();

  // RLS lo phan loc. Query khong nhac toi category cua nguoi dang xem, nhung
  // Postgres chi tra ve brand thuoc category ho phu trach.
  const [{ data: brands }, { data: cats }] = await Promise.all([
    db.from('brand')
      .select('id, name, stage, stage_changed_at, status, stuck_reason, last_update_at, created_at, tier, category:category_id (name), owner:owner_id (full_name), contact(email, phone, source)')
      .order('name'),
    db.from('category').select('id, name').eq('active', true).order('name'),
  ]);

  const rows: Row[] = (brands ?? []).map((b: any) => {
    const cs = b.contact ?? [];
    return {
      id: b.id,
      name: b.name,
      stage: b.stage,
      stageAt: b.stage_changed_at,
      tier: b.tier ?? 0,
      category: b.category?.name ?? null,
      status: b.status ?? null,
      stuckReason: b.stuck_reason ?? null,
      owner: b.owner?.full_name ?? null,
      lastUpdate: b.last_update_at ?? b.created_at ?? null,
      contacts: cs.length,
      // "Day du" = co ca email lan so dien thoai. Day la thu BD thuc su can
      // truoc khi lien he, nen dem rieng thay vi chi dem dau nguoi.
      full: cs.filter((c: any) => c.email && c.phone).length,
      // Co it nhat email HOAC phone. Can rieng voi "full" de phan biet "co
      // mot phan lien he" voi "khong co gi ca" - truoc day ca hai deu hien
      // chung la "Partial", trong khi "khong co gi" phai la mot the khac.
      withInfo: cs.filter((c: any) => c.email || c.phone).length,
      // Cac gia tri source khac nhau dang co tren brand nay, de loc theo
      // "Researched brands" o BrandBoard - mot brand co the co ca nguoi tim
      // qua SignalHire lan nguoi them tay, nen day la mot danh sach chu
      // khong phai mot gia tri.
      sources: [...new Set(cs.map((c: any) => c.source).filter(Boolean))] as string[],
    };
  });

  return <BrandBoard rows={rows} cats={cats ?? []} scanUrl={SCAN_URL} adminEmail={ADMIN_EMAIL} />;
}
