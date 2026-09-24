import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Chua dang nhap thi da ve /login. Webhook tu n8n di duong rieng, khong qua day.
export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options)),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;

  if (!user && path !== '/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    // Nho cho nguoi ta quay lai dung trang dinh vao, thay vi luon do ve trang chu.
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }
  if (user && path === '/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.searchParams.delete('next');
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  // Loai tru toan bo /api. Cac route API tu kiem tra x-api-key hoac phien dang
  // nhap cua chinh no. Neu de middleware xu ly, POST tu n8n bi chuyen huong
  // sang /login, va trang do khong nhan POST nen tra ve 405.
  //
  // Loai tru them cac file cua PWA. Trinh duyet tai manifest, service worker va
  // icon bang request KHONG kem cookie dang nhap. De middleware bat, chung bi
  // day sang /login va trinh duyet nhan ve HTML thay vi JSON hay JavaScript.
  // Hau qua: manifest coi nhu hong, nut Install khong bao gio hien, ma khong co
  // loi nao bao ra ca.
  //
  // Chuoi nay phai viet lien mot dong. Next doc matcher luc bien dich chu khong
  // chay code, nen noi chuoi bang dau cong se lam build that bai.
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|favicon-64.png|icon.png|apple-icon.png|manifest.webmanifest|sw.js|icon-192.png|icon-512.png|icon-512-maskable.png|onpoint-logo.png).*)'],
};
