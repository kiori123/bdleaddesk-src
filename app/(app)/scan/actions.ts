'use server';

import { supabaseServer } from '@/lib/supabase/server';
import { nameKey } from '@/lib/nameKey';

export type Company = { employer: string; relation: string; note: string | null };
export type Resolved = { brand: string; companies: Company[] };

/**
 * Mot brand co the tro toi nhieu cong ty: chu so huu va nha phan phoi.
 * Royal Canin ban tai VN qua Cityzoo, nen phai tim ca hai cho.
 *
 * Tra ve de man hinh HIEN RA truoc khi quet. PIC nhin thay app sap tim o dau va
 * sua duoc neu sai, thay vi quet xong moi phat hien tim nham cong ty.
 *
 * p_alias phai chuan hoa GIONG HET cach loadSettings()/searchBrand() tra cuu
 * (lib/signalhire.ts) - ca hai deu doc alias qua nameKey(). Truoc day o day
 * chi .toLowerCase() (khong bo dau), mot chuan hoa THU BA khac voi ca hai
 * noi con lai, nen man xem truoc co the resolve khac voi lan tim that su.
 */
export async function resolveBrands(names: string[]): Promise<Resolved[]> {
  const db = await supabaseServer();
  const clean = names.map((n) => n.trim()).filter(Boolean).slice(0, 50);

  const out = await Promise.all(
    clean.map(async (brand) => {
      const { data } = await db.rpc('brand_companies', { p_alias: nameKey(brand) });
      return { brand, companies: (data ?? []) as Company[] };
    }),
  );

  return out;
}

export type GoiY = { name: string; onFile: boolean; contacts: number };

/**
 * Goi y ten brand ngay duoi o go.
 *
 * Hai nguon, va phai gop lai chu khong duoc chon mot:
 *   brand       - brand da co ho so trong app
 *   brand_alias - ten da tung duoc anh xa, ke ca brand chua ai quet bao gio
 *
 * Vi sao can. PIC go "dior" roi bam tim, khong biet trong he thong ten do da
 * duoc anh xa toi dau, cung khong biet la da co 12 nguoi tren ho so roi. Ket
 * qua la quet lai cai da co, hoac go sai chinh ta mot ky tu roi ket luan brand
 * khong co ai.
 *
 * onFile de man hinh noi thang "da co 12 nguoi", vi do la ly do de KHONG quet.
 */
export async function goiYBrand(tu: string): Promise<GoiY[]> {
  const q = tu.trim();
  if (q.length < 2) return [];

  const db = await supabaseServer();

  // Dau _ va % la ky tu dai dien cua LIKE. Khong thoat thi go "100%" thanh mot
  // cau tim khop moi thu.
  const mau = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const [{ data: brands }, { data: aliases }] = await Promise.all([
    db.from('brand').select('name, contact(id)').ilike('name', mau).limit(8),
    db.from('brand_alias').select('alias').ilike('alias', mau).limit(8),
  ]);

  const ra = new Map<string, GoiY>();

  for (const b of (brands ?? []) as any[]) {
    const ten = String(b.name ?? '').trim();
    if (!ten) continue;
    const n = Array.isArray(b.contact) ? b.contact.length : 0;
    ra.set(ten.toLowerCase(), { name: ten, onFile: true, contacts: n });
  }

  for (const a of (aliases ?? []) as any[]) {
    const ten = String(a.alias ?? '').trim();
    if (!ten || ra.has(ten.toLowerCase())) continue;
    ra.set(ten.toLowerCase(), { name: ten, onFile: false, contacts: 0 });
  }

  // Brand da co ho so len truoc, roi den ten ngan hon vi no thuong la ten goc
  // chu khong phai bien the.
  return [...ra.values()]
    .sort((a, b) => Number(b.onFile) - Number(a.onFile) || a.name.length - b.name.length)
    .slice(0, 8);
}
