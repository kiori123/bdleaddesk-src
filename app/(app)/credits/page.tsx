import { supabaseServer } from '@/lib/supabase/server';
import CreditConsole from './CreditConsole';

export const dynamic = 'force-dynamic';

export default async function CreditsPage() {
  const db = await supabaseServer();

  const [quota, peers, requests, cats] = await Promise.all([
    db.rpc('my_quota'),
    db.rpc('list_peers'),
    db.rpc('my_credit_requests'),
    db.from('category').select('id, name').eq('active', true).order('name'),
  ]);

  if (quota.error) {
    return (
      <div className="wrap">
        <div className="phead"><h1 className="h1">Credits</h1></div>
        <p className="note">
          Could not load your credit numbers right now. Reload the page, and if it keeps
          failing tell an admin. ({quota.error.message})
        </p>
      </div>
    );
  }

  return (
    <CreditConsole
      quota={quota.data}
      peers={peers.data ?? []}
      requests={requests.data ?? []}
      categories={cats.data ?? []}
    />
  );
}
