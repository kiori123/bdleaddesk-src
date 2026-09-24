import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import Pipeline from './Pipeline';
import BrandView from './BrandView';

export default async function BrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await supabaseServer();

  const { data: brand } = await db
    .from('brand')
    .select('id, name, stage, tier, category_id, drive_folder_link')
    .eq('id', id).single();

  // RLS tra ve rong khi nguoi nay khong phu trach category cua brand. Voi ho thi
  // brand nay khong ton tai, dung nhu y do.
  if (!brand) notFound();

  const { data: { user } } = await db.auth.getUser();

  const [{ data: notes }, { data: contacts }, { data: cats }, { data: mau }, { data: me }, { data: isAdmin }] =
    await Promise.all([
      db.from('brand_note').select('body, created_at')
        .eq('brand_id', id).order('created_at', { ascending: false }).limit(1),
      db.from('contact')
        .select('id, full_name, job_title, company, email, phone, linkedin_url, location, org_rank, bio, source')
        .eq('brand_id', id).order('org_rank', { nullsFirst: false }),
      db.from('category').select('id, name').eq('active', true).order('name'),
      // Mau mac dinh cua chinh nguoi dang xem. RLS chan sang mau nguoi khac.
      db.from('email_template').select('id, subject, body, cc')
        .eq('is_default', true).maybeSingle(),
      db.from('profile').select('full_name, email').eq('id', user!.id).maybeSingle(),
      db.rpc('is_admin'),
    ]);

  const last = notes?.[0];
  const people = contacts ?? [];

  // File gui kem cua mau mac dinh. Lay ca file chua bat chia se, vi nut Tai ve
  // van dung duoc voi chung; chi rieng phan chen link vao thu moi doi share_url.
  const { data: dsFile } = (mau as any)?.id
    ? await db.from('template_file').select('id, name, size, share_url')
      .eq('template_id', (mau as any).id).order('created_at')
    : { data: [] as any[] };

  return (
    <>
      <div className="phead">
        <div className="h1">{brand.name}</div>
        <div className="h1s">
          {people.length} contact{people.length === 1 ? '' : 's'} · Tier {brand.tier}
        </div>
      </div>

      {/* Duong ve tach ra thanh nut rieng. Nhet trong dong chu nho canh so
          contact thi no doc nhu mot manh thong tin, khong ai doc ra la bam duoc. */}
      <div className="navrow">
        <Link href="/" className="back">Brand board</Link>
      </div>

      <div className="bento">
        <Pipeline
          brandId={brand.id}
          brandName={brand.name}
          categories={cats ?? []}
          categoryId={brand.category_id}
          folderLink={brand.drive_folder_link}
          stage={brand.stage as any}
          note={last?.body ?? ''}
          noteAt={last?.created_at ?? null}
        />
        <BrandView
          brandId={brand.id} brandName={brand.name} contacts={people as any}
          mau={mau ? {
            subject: (mau as any).subject ?? '',
            body: (mau as any).body ?? '',
            cc: (mau as any).cc ?? '',
          } : null}
          toi={{ name: me?.full_name || user?.email || '', email: me?.email || user?.email || '' }}
          files={(dsFile ?? []) as any}
          isAdmin={Boolean(isAdmin)}
        />

        <div className="tile foot g-how">
          <div>
            <div className="ft">Found a bug or need a new feature?</div>
            <div className="fd">The assistant answers questions about the tool. For anything it cannot do, reach the admin.</div>
          </div>
          <a className="btn2" href="mailto:khoa@onpoint.vn?subject=Lead%20Desk%20-%20request">Contact admin</a>
        </div>
      </div>
    </>
  );
}
