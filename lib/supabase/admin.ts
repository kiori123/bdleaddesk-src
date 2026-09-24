import { createClient } from '@supabase/supabase-js';

/**
 * Client bo qua RLS. CHI dung cho hai viec:
 *   - ghi so credit_ledger
 *   - xu ly callback tu n8n (luc do khong co phien dang nhap nao)
 *
 * Khong bao gio import file nay vao Client Component. Neu can du lieu o client,
 * di qua Route Handler.
 */
export function supabaseAdmin() {
  if (typeof window !== 'undefined') {
    throw new Error('supabaseAdmin chi duoc chay o server');
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
