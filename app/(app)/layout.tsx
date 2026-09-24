import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import SignOut from './SignOut';
import Bell from './Bell';
import UpdateBanner from './UpdateBanner';
import NavProgress from './NavProgress';
import InstallApp from './InstallApp';
import Reload from './Reload';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await db
    .from('profile').select('full_name, role, active').eq('id', user.id).single();

  if (me && !me.active) {
    return (
      <div className="wrap">
        <div className="phead"><h1 className="h1">Account disabled</h1></div>
        <p className="note">Ask the admin to switch it back on.</p>
      </div>
    );
  }

  return (
    <>
      <NavProgress />
      <UpdateBanner />
      <header className="top">
        <Link href="/" className="brand" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          {/* Logo chinh chu thay cho chu On/Point go tay. priority: no nam tren
              cung moi trang, de lazy thi header giat mot nhip khi tai. */}
          <img src="/onpoint-logo.png" alt="OnPoint"
            style={{ height: 26, width: 'auto', display: 'block' }} />
          <span className="wm2" style={{
            fontFamily: 'var(--dp)', fontSize: 15, textTransform: 'uppercase',
            letterSpacing: '.02em', color: 'var(--tl)', lineHeight: 1,
            paddingLeft: 10, borderLeft: '1px solid var(--bd)',
          }}>BD Lead Hub</span>
        </Link>
        <nav className="tnav">
          <Link href="/">Brands</Link>
          <Link href="/reminders">Reminders</Link>
          <Link href="/templates">Templates</Link>
          {me?.role === 'admin' && <Link href="/admin">Admin</Link>}
        </nav>
        <InstallApp />
        <Reload />
        <Bell />
        <SignOut email={me?.full_name || user.email || ''} />
      </header>
      <div className="wrap">{children}</div>
    </>
  );
}
