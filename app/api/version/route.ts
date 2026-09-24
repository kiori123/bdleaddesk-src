import { NextResponse } from 'next/server';

/**
 * Ma so cua ban dang chay tren may chu.
 *
 * Cua so app dang mo hoi duong nay de biet minh co con la ban moi nhat khong.
 * Khong tra ve gi ngoai mot chuoi so, va KHONG doi dang nhap: cua so co the da
 * het phien nhung van can biet la co ban moi de con nap lai.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  const ms = Number(process.env.APP_BUILD_ID);
  return NextResponse.json(
    {
      id: process.env.APP_BUILD_ID ?? 'dev',
      // Doc duoc bang mat, khong phai doi chieu mot day so. Sau moi lan deploy
      // chi can mo duong nay la biet ban dang chay build luc nao.
      builtAt: Number.isFinite(ms) ? new Date(ms).toISOString() : null,
      // May chu dang chay o dau. Supabase dat tai Sydney (ap-southeast-2) va PIC
      // ngoi o Viet Nam; ham chay o My thi moi lan mo trang phai di vong nua
      // vong trai dat hai luot. Muon 'sin1'. Xem vercel.json.
      region: process.env.VERCEL_REGION ?? 'local',
    },
    {
      // Bat buoc. Thieu dong nay thi Vercel co the tra ve ban da luu cua chinh
      // duong nay, tuc la mai mai bao "dang chay ban moi nhat".
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    },
  );
}
