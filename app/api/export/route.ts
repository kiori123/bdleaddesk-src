import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { dungWorkbookXuat, LoiXuat } from '@/lib/exportWorkbook';

// exceljs can Node, khong chay duoc tren edge runtime
export const runtime = 'nodejs';

// Duong doc toan bo pipeline nguoi goi thay duoc va dung ca 5 sheet. Dat rieng
// 60s giong scan/reveal/contacts-export, thay vi de mac dinh cua Vercel
// (thuong 10s).
export const maxDuration = 60;

/**
 * Route chi con ba viec: kiem dang nhap, doc bo loc tu query string, va doi
 * loi thanh Response.
 *
 * Toan bo phan dung workbook nam o lib/exportWorkbook.ts, vi mot script chay
 * tay cung phai goi DUNG ma do de xuat file mau cho PIC xem truoc khi deploy
 * (xem scripts/export-mau.mts). Mot ban sao rieng cho script thi file mau
 * khong con la bang chung ve file that.
 */
export async function GET(req: NextRequest) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return new Response('Not signed in.', { status: 401 });

  const q = req.nextUrl.searchParams;

  let wb;
  try {
    // RLS van ap dung: PIC export ra chi co category cua ho, admin duoc het -
    // vi day la client co phien dang nhap cua chinh nguoi goi.
    wb = await dungWorkbookXuat(db, {
      category: q.get('category'),
      owner: q.get('owner'),
      status: q.get('status'),
      from: q.get('from'),
      to: q.get('to'),
    });
  } catch (e) {
    // LoiXuat mang san ma HTTP va cau chu nguoi doc duoc. Loi khac thi nem
    // tiep, de Next ghi log va tra 500 - khong giau mot su co that sau mot
    // cau chu tu bien ra.
    if (e instanceof LoiXuat) return new Response(e.message, { status: e.status });
    throw e;
  }

  const buf = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="onpoint-pipeline-${stamp}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
