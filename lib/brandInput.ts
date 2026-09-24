/**
 * Tach o nhap brand thanh danh sach ten.
 *
 * VAN DE PIC BAT DUOC: go "ABC, LLD" thi app hieu thanh HAI brand la "ABC" va
 * "LLD", roi di tim mot cong ty ten LLD. Nhung "ABC, LLD" la MOT ten phap nhan,
 * dau phay nam trong ten chu khong phai dau ngan cach. Chuyen nay rat pho bien:
 *
 *   ABC, LLC          Nestle Vietnam, Ltd.       Masan, JSC
 *   Unilever, Inc.    Something Holdings, Pte    XYZ, Sdn Bhd
 *
 * Tach nham thi lan quet do vua phi mot luot cho mot cai ten khong co that, vua
 * tra ve rong cho brand that.
 *
 * Cach xu ly: tach theo dau phay, xuong dong va cham phay nhu cu, NHUNG doan
 * nao chi gom toan tu viet tat cua loai hinh doanh nghiep thi nhap nguoc lai
 * vao ten dung truoc no.
 *
 * Khong doan xa hon the. Neu doan sau dau phay co bat ky tu nao khac ngoai danh
 * sach duoi day thi coi la mot brand rieng, vi doan nham theo huong nhap lai se
 * lam mat han mot brand ma khong ai nhin thay.
 */

// Da bo dau cham va chuyen ve chu thuong truoc khi doi chieu.
const DUOI_PHAP_NHAN = new Set([
  'llc', 'lld', 'ltd', 'limited', 'inc', 'incorporated', 'co', 'corp',
  'corporation', 'company', 'jsc', 'plc', 'lp', 'llp', 'gmbh', 'ag', 'nv',
  'bv', 'sa', 'srl', 'spa', 'pte', 'pty', 'sdn', 'bhd', 'tbk', 'pt', 'kk',
  'oy', 'ab', 'as', 'aps', 'sas', 'sarl', 'cjsc', 'ojsc', 'jv', 'kft', 'doo',
  // Viet Nam
  'tnhh', 'cp', 'mtv', 'jsc', 'ltd',
]);

const don = (s: string) => s.replace(/[.。]/g, '').trim().toLowerCase();

/** Doan nay chi gom tu viet tat loai hinh doanh nghiep? */
function laDuoi(doan: string) {
  const tu = don(doan).split(/\s+/).filter(Boolean);
  if (!tu.length || tu.length > 3) return false;
  return tu.every((t) => DUOI_PHAP_NHAN.has(t));
}

export function tachBrand(raw: string): string[] {
  const manh = String(raw ?? '')
    .split(/[,;\n]/)
    .map((s) => s.trim());

  const ra: string[] = [];
  for (const m of manh) {
    if (!m) continue;
    if (ra.length && laDuoi(m)) {
      // Nhap nguoc vao ten truoc do, giu nguyen dau phay nhu nguoi ta da go.
      ra[ra.length - 1] = `${ra[ra.length - 1]}, ${m}`;
      continue;
    }
    ra.push(m);
  }
  return ra;
}
