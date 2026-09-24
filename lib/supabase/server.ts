import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Client cho Server Component va Route Handler.
 * Chay duoi danh tinh cua nguoi dang dang nhap, nen RLS van ap dung day du.
 * Dung cai nay cho gan het moi thu.
 */
export async function supabaseServer() {
  // Next 16: cookies() la ham bat dong bo, phai await.
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try { list.forEach(({ name, value, options }) => store.set(name, value, options)); }
          catch { /* goi tu Server Component thi khong set duoc, middleware da lo */ }
        },
      },
    }
  );
}
