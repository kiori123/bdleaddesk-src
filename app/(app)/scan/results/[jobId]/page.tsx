import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import Results from './Results';
import { pollJob } from './actions';
import { hasPrefs } from '@/lib/rank';

export const dynamic = 'force-dynamic';

export default async function ResultsPage({
  params,
}: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;

  const db = await supabaseServer();
  const { data: job } = await db
    .from('job').select('id, kind, category_id, payload').eq('id', jobId).single();

  // RLS tra ve rong khi job khong phai cua nguoi nay, giong het khi job khong
  // ton tai. Ca hai deu dan ve 404, va do la dieu dung: khong noi cho nguoi la
  // biet job do co that.
  if (!job) notFound();

  const first = await pollJob(jobId);
  if (!first) notFound();

  const p = (job.payload ?? {}) as any;
  const brandsAsked: string[] = Array.isArray(p.brands)
    ? p.brands.map((b: any) => b?.name).filter(Boolean)
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100dvh - 108px)' }}>
      <div className="phead">
        <h1 className="h1">Results</h1>
      </div>

      <div className="navrow">
        <Link href="/scan" className="back">New scan</Link>
        {brandsAsked.length > 0 && (
          <span className="what">Searched: {brandsAsked.join(', ')}</span>
        )}
      </div>

      <Results
        jobId={jobId}
        categoryId={job.category_id}
        initial={first}
        showChip={hasPrefs(p.prefs ?? {}) || Boolean(p.prefs?.chasing)}
      />
    </div>
  );
}
