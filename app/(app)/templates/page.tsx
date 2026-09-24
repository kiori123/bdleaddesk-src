import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import Editor from './Editor';
import { mauCuaToi } from './actions';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();

  const [{ data: me }, dsMau] = await Promise.all([
    db.from('profile').select('full_name, email').eq('id', user!.id).single(),
    mauCuaToi(),
  ]);

  /**
   * Mot nguoi that de xem thu.
   *
   * Lay nguoi CO bio, vi bio la truong hay rong nhat va cung la truong de lam
   * thung mot cau nhat. Xem thu bang mot nguoi du thong tin thi khong bao gio
   * thay van de; day chinh la truong hop can nhin thay.
   *
   * RLS lo phan chi thay contact thuoc category cua minh.
   */
  const { data: ai } = await db
    .from('contact')
    .select('full_name, job_title, location, bio, brand(name)')
    .not('bio', 'is', null)
    .limit(1)
    .maybeSingle();

  const nguoiThu = ai
    ? {
      full_name: String((ai as any).full_name ?? ''),
      job_title: ((ai as any).job_title ?? null) as string | null,
      location: ((ai as any).location ?? null) as string | null,
      bio: ((ai as any).bio ?? null) as string | null,
      brand: String((ai as any).brand?.name ?? 'their company'),
      email: null,
    }
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100dvh - 108px)' }}>
      <div className="phead">
        <h1 className="h1">Email templates</h1>
      </div>

      <div className="navrow">
        <Link href="/" className="back">Brand board</Link>
        <span className="what">
          Used by the Email button on a brand page. Yours alone, nobody else sees or changes them.
        </span>
      </div>

      <Editor
        dsMau={dsMau}
        toi={{ name: me?.full_name || user?.email || '', email: me?.email || user?.email || '' }}
        nguoiThu={nguoiThu}
      />
    </div>
  );
}
