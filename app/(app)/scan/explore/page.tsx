import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { visibleCategories } from '@/lib/visibleCategories';
import SearchForm from '../SearchForm';

export const dynamic = 'force-dynamic';

export default async function ExplorePage() {
  const db = await supabaseServer();
  const cats = await visibleCategories(db);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100dvh - 108px)' }}>
      <div className="phead">
        <h1 className="h1">Explore a brand</h1>
      </div>

      {/* Nut quay lai tach thanh hang rieng, khong con nhet canh tieu de nua.
          PIC bao khong nhin thay dong chu xam cu. */}
      <div className="navrow">
        <Link href="/scan" className="back">All scan types</Link>
      </div>
      <p className="note max-w-[62ch]" style={{ marginBottom: 14 }}>
        Type a brand and see who works there. Nothing is charged. You pick who to pay for on the
        next screen.
      </p>
      <SearchForm mode="explore" categories={cats} />
    </div>
  );
}
