'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function SignOut({ email }: { email: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function out() {
    start(async () => {
      await supabaseBrowser().auth.signOut();
      router.push('/login');
      // Xoa cache Server Component, neu khong nguoi tiep theo bam Back van
      // thay du lieu cua nguoi vua thoat.
      router.refresh();
    });
  }

  return (
    <div className="who2">
      <span className="who2e" title={email}>{email}</span>
      <button className="who2b" onClick={out} disabled={pending}>
        {pending ? 'Signing out' : 'Sign out'}
      </button>
    </div>
  );
}
