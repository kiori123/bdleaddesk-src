import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import PersonForm from './PersonForm';

export const dynamic = 'force-dynamic';

export default async function PersonPage() {
  const db = await supabaseServer();
  const { data: cats } = await db
    .from('category').select('id, name').eq('active', true).order('name');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100dvh - 108px)' }}>
      <div className="phead">
        <h1 className="h1">Get a contact</h1>
      </div>

      {/* Nut quay lai tach thanh hang rieng, khong con nhet canh tieu de nua.
          PIC bao khong nhin thay dong chu xam cu. */}
      <div className="navrow">
        <Link href="/scan" className="back">All scan types</Link>
      </div>
      <p className="note max-w-[62ch]" style={{ marginBottom: 14 }}>
        You already know who the person is. This is the only screen in the scan flow that spends
        credits.
      </p>
      <PersonForm categories={cats ?? []} />
    </div>
  );
}
