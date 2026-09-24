import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import List from './List';
import { danhSachNhac } from './actions';

export const dynamic = 'force-dynamic';

export default async function RemindersPage() {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();

  const [dsNhac, { data: brands }, { data: me }] = await Promise.all([
    danhSachNhac(),
    // RLS chi tra ve brand thuoc category cua nguoi nay. Admin thay het, ma
    // admin moi la nguoi dat nhac viec, nen o chon brand van du dung.
    db.from('brand').select('id, name').order('name'),
    user
      ? db.from('profile').select('role').eq('id', user.id).single()
      : Promise.resolve({ data: null as { role: string } | null }),
  ]);

  const admin = me?.role === 'admin';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100dvh - 108px)' }}>
      <div className="phead">
        <h1 className="h1">Reminders</h1>
      </div>

      <div className="navrow">
        <Link href="/" className="back">Brand board</Link>
        <span className="what">
          {admin
            ? 'What you set here rings in everyone’s bell on the day. Each person ticks off their own copy.'
            : 'Reminders for the whole team, set by an admin. They ring in your bell on the day. Ticking one off clears it for you only.'}
        </span>
      </div>

      <List
        dsNhac={dsNhac}
        brands={(brands ?? []) as { id: string; name: string }[]}
        admin={admin}
      />
    </div>
  );
}
