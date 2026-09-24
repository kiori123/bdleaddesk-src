import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import BudgetCard from './BudgetCard';
import UsagePanel from './UsagePanel';
import AddCategory from './AddCategory';
import Settings from './Settings';
import Aliases from './Aliases';
import ReminderCenter from './ReminderCenter';
import ExportPanel from './ExportPanel';
import People from './People';

export default async function AdminPage() {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  const { data: me } = await db.from('profile').select('role').eq('id', user!.id).single();
  if (me?.role !== 'admin') redirect('/');

  const [{ data: credits }, { data: activeCats }, { data: orphans }, { data: shKey }, { data: aliases }] = await Promise.all([
    // category_credit_status la mot view SELECT thang tu category, khong loc
    // active - retire mot category (vd Cross Boder) van con hien o day neu
    // khong tu loc lai. Loc theo activeCats ben duoi thay vi sua view: sua
    // view la DDL, phai qua file .sql chay tay; loc trong code deploy binh
    // thuong va it rui ro hon.
    db.from('category_credit_status').select('*').order('category_name'),
    db.from('category').select('id').eq('active', true),
    db.from('brand').select('id, name').is('category_id', null).order('name'),
    supabaseAdmin().from('app_setting').select('value, updated_at').eq('key', 'signalhire_api_key').maybeSingle(),
    db.from('brand_alias').select('alias, employer, note').order('alias'),
  ]);

  const activeIds = new Set((activeCats ?? []).map((c: any) => c.id));
  const visibleCredits = (credits ?? []).filter((c: any) => activeIds.has(c.category_id));

  return (
    <main className="space-y-9">
      <h1 className="font-display text-[23px] uppercase">Admin</h1>

      {!!orphans?.length && (
        <p className="rounded-lg border border-red-deep/30 bg-white px-4 py-3 text-sm leading-relaxed">
          <b>{orphans.length} brand(s) with no category:</b>{' '}
          {orphans.map((b) => b.name).join(', ')}.{' '}
          <span className="text-ink-dim">
            They count against no budget and only you can see them.
          </span>
        </p>
      )}

      <section>
        <h2 className="font-display text-base uppercase text-teal-deep">Credit per category</h2>
        <p className="mt-1 text-xs text-ink-faint">
          Budgets reset on the first of each month and do not roll over. Edit a number, then Save.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleCredits.map((c: any) => (
            <BudgetCard
              key={c.category_id}
              categoryId={c.category_id}
              name={c.category_name}
              granted={c.granted}
              used={c.used}
              remaining={c.remaining}
            />
          ))}
        </div>

        <AddCategory />
      </section>

      <UsagePanel />
      <Settings hasKey={!!shKey?.value} updatedAt={shKey?.updated_at ?? null} />

      <Aliases rows={(aliases ?? []) as any} />

      <ReminderCenter />

      <ExportPanel />


      <People />

    </main>
  );
}
