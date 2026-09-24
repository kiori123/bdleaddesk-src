'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get('next') || '/';
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function signIn() {
    if (!email || !pass) { setMsg('Fill in both fields.'); return; }
    setBusy(true); setMsg('');
    const { error } = await supabaseBrowser().auth
      .signInWithPassword({ email, password: pass });
    setBusy(false);
    if (error) { setMsg(error.message); setPass(''); return; }
    router.push(next);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <div className="relative w-full max-w-[360px] overflow-hidden rounded-2xl border border-line bg-white px-[26px] py-7 shadow-[0_12px_32px_rgba(14,34,40,.09)]">
        <span className="absolute left-[26px] top-0 h-[3px] w-[34px] rounded-b bg-red-deep" />
        {/* Logo that thay cho chu OnPoint ghep tay. Ghep tay thi moi lan doi ten
            app la phai nho sua ca o day, va mau do phai tu khop bang mat. */}
        <img src="/onpoint-logo.png" alt="OnPoint"
             style={{ height: 22, width: 'auto', display: 'block' }} />
        <h1 className="font-display text-[22px] uppercase leading-none" style={{ marginTop: 10 }}>
          BD Lead Hub
        </h1>
        <p className="mt-[7px] text-xs leading-snug text-ink-faint">
          Sign in to see brands, contacts and documents.
        </p>

        <label className="mt-[18px] block text-[10px] font-bold uppercase tracking-[.07em] text-ink-faint">Email</label>
        <input
          className="mt-1.5 h-10 w-full rounded-[9px] border border-line bg-surface-sunk px-3 outline-none focus:border-teal-deep focus:bg-white"
          value={email} onChange={(e) => setEmail(e.target.value)}
          autoComplete="username" spellCheck={false}
        />

        <label className="mt-[18px] block text-[10px] font-bold uppercase tracking-[.07em] text-ink-faint">Password</label>
        <input
          type="password"
          className="mt-1.5 h-10 w-full rounded-[9px] border border-line bg-surface-sunk px-3 outline-none focus:border-teal-deep focus:bg-white"
          value={pass} onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && signIn()}
          autoComplete="current-password"
        />

        <button
          onClick={signIn} disabled={busy}
          className="mt-5 h-[42px] w-full rounded-[10px] bg-grad-red font-display text-[15px] uppercase tracking-[.03em] text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? 'Signing in' : 'Sign in'}
        </button>

        <p className="mt-3 min-h-4 text-center text-[11.5px] text-red-deep">{msg}</p>
        <p className="mt-[18px] border-t border-line pt-3.5 text-center text-[10.5px] text-ink-faint">
          Made by Khoa · BD Team
        </p>
      </div>
    </main>
  );
}

// Next 16 bat buoc useSearchParams phai boc trong Suspense, neu khong `next build`
// se bao loi prerender.
export default function LoginPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center" />}>
      <LoginForm />
    </Suspense>
  );
}
