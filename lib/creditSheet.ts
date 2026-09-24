import type ExcelJS from 'exceljs';
import { colorForIndex, argb, chuTren, TEAL, RED, GREY } from '@/lib/categoryPalette';

/**
 * Sheet "Credit & Contacts" cua /api/export.
 *
 * Tach ra khoi route CO LY DO CU THE: bo cuc sheet nay da hong hai lan lien
 * tiep tren ban that ma khong cach nao thay truoc - mot lan chu trong bieu do
 * ra o vuong rong, mot lan anh cao 340px de len tieu de bang o dong 20. Ca hai
 * deu lot qua vi khong co cach nao kiem bo cuc ma khong deploy roi mo file
 * bang mat. Gio no la mot ham thuan nhan du lieu va mot worksheet, nen
 * test/credit-sheet.test.ts kiem duoc: khong co anh, o gop nam dung dong, bang
 * bat dau dung cho, va ten category khong bi ke soc xoa mat.
 *
 * Doc du lieu van o route (ham nay khong biet gi ve Supabase).
 */

/** Mot dong tong hop theo category, route tinh san roi truyen vao. */
export type CatRow = {
  id: string;
  name: string;
  brands: number;
  withContact: number;
  noContact: number;
  /**
   * Contact ma MOT CREDIT that su da mua (isByCredit o lib/contactOrigin.ts:
   * signalhire + pasted_linkedin).
   *
   * TACH RIENG khoi `free` co ly do cu the: moi ti le tren sheet nay chi duoc
   * tinh tren so nay. Truoc day mau so la MOI contact, nen Mom & Baby hien
   * 41% full trong khi 3 credit cua no chi mua 21 contact o 29% - con so 41%
   * do 42 contact nguoi go tay ganh, tuc no do cong suc nhap tay cua PIC chu
   * khong do hieu qua cua reveal.
   */
  paid: number;
  /** Trong so `paid`, bao nhieu cai co CA email va phone. */
  paidFull: number;
  /**
   * Bon con so duoi day CONG DUNG BANG `paid`:
   *   paidFull + paidMailOnly + paidPhoneOnly + paidNeither === paid
   *
   * Chung ton tai de tra loi cau VI SAO, khong chi bao nhieu - xem
   * lib/qualitySheet.ts. Mot full rate 13% co the la "thieu phone" (van goi
   * duoc mail) hoac la "ve tay khong" (credit mua mot ban ghi rong). Hai
   * chuyen do dan den hai viec khac han nhau, ma mot con so 13% thi khong
   * phan biet duoc.
   */
  paidMailOnly: number;
  paidPhoneOnly: number;
  paidNeither: number;
  /**
   * Trong so `paidNeither`, bao nhieu cai VAN co linkedin_url.
   *
   * Day la con so cuu duoc viec: mot contact khong email khong phone nhung co
   * LinkedIn thi nguoi that van lien he duoc. Khong co truong nay thi 48
   * contact rong cua Beauty doc nhu 48 credit mat trang, trong khi 38 trong so
   * do van dung duoc.
   */
  paidNeitherWithLinkedin: number;
  /**
   * Cheo CATEGORY x VI TRI, chi tinh nguoi CO location.
   *
   * Ton tai vi mot ket luan nguyen nhan khong duoc phu dinh cai con lai ma
   * khong kiem. Ban truoc cua sheet nay viet "it is where the person sits, NOT
   * the category" - va do la mot ket luan confounded: location va category
   * tuong quan voi nhau (Beauty la cho tap trung brand Han), nen chon mot cai
   * roi phu dinh cai kia la doan.
   *
   * Bang cheo tren du lieu that pha ket luan do: CHI tinh nguoi o Viet Nam,
   * Beauty rong 48% con F&B rong 13% - chenh 35 diem trong cung mot nhom vi
   * tri. Tuc category co tac dong DOC LAP, va manh. Ca hai tang cong don, va
   * cau ket luan phai noi ca hai.
   */
  paidVn: number;
  paidVnEmpty: number;
  paidNgoai: number;
  paidNgoaiEmpty: number;
  /**
   * Contact khong ton credit nao: seed list da xac minh (di qua pipeline nhung
   * khong goi API, xem CLAUDE.md) cong contact nguoi go tay. Van hien tren bang
   * de khong thu gi bi giau, nhung KHONG nam trong bat ky ti le nao.
   */
  free: number;
  spend: number;
};

/**
 * Toa do CO DINH cua sheet, export de test kiem duoc chu khong phai doc so
 * rai rac trong code.
 *
 * TABLE_START = 9, khong phai 20. So 20 cu de danh cho mot anh bieu do cao
 * 10-17 dong; anh da bi bo (xem lib/categoryPalette.ts) nen khoang trong do
 * khong con ly do ton tai - va chinh no la cho anh tung de len tieu de bang.
 */
/**
 * So contact toi thieu de mot category duoc xep hang theo TI LE day du.
 *
 * Duoi nguong nay mot ti le khong noi len dieu gi: 1/1 la 100%, va mot contact
 * them vao doi ngay thanh 50%. Xem ghi chu o cho dung bien duMauXepHang.
 */
/**
 * Mot dong cua bang "nguoi do ngoi o dau".
 *
 * Day la truc tra loi cau VI SAO. Mot con so theo category khong tra loi duoc:
 * "Beauty 14% full" khong noi vi sao, con "nguoi ngoai Viet Nam co 65% reveal
 * ve tay khong, trong Viet Nam la 30%" thi noi - va no giai thich luon vi sao
 * Beauty thap nhat (Beauty la cho tap trung brand indie Han).
 */
export type ViTriRow = {
  key: 'vn' | 'ngoai' | 'chuaBiet';
  label: string;
  paid: number;
  empty: number;
  full: number;
  /** Trong so `empty`, bao nhieu cai VAN co LinkedIn - tuc van lien he duoc. */
  emptyWithLinkedin: number;
  /** Nuoc xuat hien nhieu nhat trong nhom rong, de noi dich danh. */
  topNuoc: string | null;
  topNuocEmpty: number;
};

/**
 * Mot brand dang ganh so reveal rong.
 *
 * Bang nay ton tai vi PIC canh bao dung: con so theo category che mat su that
 * o cap brand. F&B co 5 reveal rong tren 55, doc nhu ca category deu on -
 * nhung 14 trong 16 brand cua no SACH HOAN TOAN, ba brand ganh het, va RITA
 * FOOD rong 29%. Khong hien cap brand thi nguoi doc ket luan sai ve 14 brand
 * con lai.
 */
export type BrandRong = {
  brand: string;
  category: string;
  paid: number;
  empty: number;
};

export const MIN_CONTACT_XEP_HANG = 20;

/** So brand chua co contact toi thieu de goi la van de (cung voi ti le duoi). */
export const MIN_BRAND_BAO_DONG = 3;

/**
 * So reveal toi thieu de ti le rong CUA MOT BRAND duoc doc nhu mot ti le.
 * Duoi nguong nay van hien dong do (no that su ganh so rong tuyet doi), nhung
 * ti le hien mo - giong ky luat o bang category.
 */
export const MIN_PAID_BRAND_DE_XEP_HANG = 10;

/** Ti le brand chua co contact toi thieu de goi la van de. */
export const TI_LE_BRAND_BAO_DONG = 0.2;

export const LAYOUT = {
  /** Dai ba o KPI, nam ngang. */
  TILE_ROW: 5,
  TILE_ROW_END: 7,
  /**
   * Cot cua tung o KPI. Do rong khong deu la co y: o thu ba chua cau dai nhat
   * ("F&B - 6% of brands have no contact") nen duoc dai nhat.
   */
  TILES: [{ from: 1, to: 2 }, { from: 3, to: 5 }, { from: 6, to: 11 }],
  /** Dong tieu de bang chi tiet. */
  TABLE_START: 9,
  COLS: [22, 14, 15, 10, 13, 11, 11, 14, 12, 13, 14],
} as const;

/** Chu dam mot mau, dung cho o can noi bat trong bang. */
function paint(cell: ExcelJS.Cell, argbColor: string) {
  cell.font = { color: { argb: argbColor }, bold: true };
}

/**
 * Cau nguyen nhan NGAN cho o KPI "Weakest yield".
 *
 * Chi noi ra khi co mot nguyen nhan noi troi - mot o KPI khong duoc gan
 * nguyen nhan cho mot thu khong co van de gi.
 */
function nguyenNhanNgan(c: CatRow): string {
  if (c.paid === 0) return '';
  if (c.paidNeither / c.paid >= 0.3) return `${c.paidNeither} came back with nothing`;
  if (c.paidMailOnly / c.paid >= 0.3) return `${c.paidMailOnly} have no phone`;
  if (c.paidPhoneOnly / c.paid >= 0.3) return `${c.paidPhoneOnly} have no email`;
  return '';
}

export function veSheetCreditContacts(
  ws: ExcelJS.Worksheet,
  opts: {
    rows: CatRow[];
    /** Phan tich nguyen nhan theo noi nguoi do ngoi - xem ViTriRow. */
    viTri: ViTriRow[];
    /** Brand dang ganh so reveal rong, da sap giam dan - xem BrandRong. */
    brands: BrandRong[];
    from: string | null;
    to: string | null;
  },
): void {
  const list = opts.rows;
  const viTri = opts.viTri;
  const brands = opts.brands;
  const fFrom = opts.from;
  const fTo = opts.to;

  ws.mergeCells('A1:F1');
  ws.getCell('A1').value = 'Credit & Contact Overview';
  ws.getCell('A1').font = { bold: true, size: 16, color: { argb: TEAL } };

  ws.mergeCells('A2:K2');
  ws.getCell('A2').value = fFrom || fTo
    ? `All categories, all brands (ignores the Category/Owner/Status filters above). Credit spend counted from ${fFrom || 'the start'} to ${fTo || 'now'}. Contacts reflect the current state.`
    : 'All categories, all brands, all time (ignores the Category/Owner/Status filters above).';
  ws.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF6F878B' } };

  /**
   * Mau co dinh theo ten category (bang chu cai), khong theo hang muc chi tieu -
   * mot category luon giu dung mot mau du bang sap xep lai theo spend.
   */
  const alphaCats = [...list].sort((a, b) => a.name.localeCompare(b.name));
  const colorOf = new Map<string, string>();
  alphaCats.forEach((c, i) => colorOf.set(c.id, colorForIndex(i)));

  const totalSpend = list.reduce((s, c) => s + c.spend, 0);
  const totalBrands = list.reduce((s, c) => s + c.brands, 0);
  const totalPaid = list.reduce((s, c) => s + c.paid, 0);
  const totalPaidFull = list.reduce((s, c) => s + c.paidFull, 0);

  /** Cau dung khi khong mot category nao du mau de xep hang. */
  const CHUA_DU_MAU = `No category has ${MIN_CONTACT_XEP_HANG} paid contacts yet.`;

  /**
   * XEP HANG THEO TI LE PHAI CO NGUONG MAU. Khong co nguong thi mau nho nhat
   * luon thang, va con so hien ra la tieng on chu khong phai tin hieu.
   *
   * Da xay ra dung nhu vay tren ban that: o "Best contact yield" khoe "China
   * Project - 100% full contacts" trong khi China Project co DUNG MOT contact
   * (1/1). Cung luc do F&B co 37/55 that su day du va khong duoc nhac den.
   *
   * Nguong 20: duoi so nay mot ti le nhay rat manh - mot contact them vao doi
   * 100% thanh 50%. Tu 20 tro len thi con so noi duoc mot dieu gi.
   */
  const duMauXepHang = list.filter((c) => c.paid >= MIN_CONTACT_XEP_HANG);
  const theoYield = [...duMauXepHang].sort((a, b) => b.paidFull / b.paid - a.paidFull / a.paid);
  const fullLeader = theoYield[0];
  const weakLeader = theoYield.length > 1 ? theoYield[theoYield.length - 1] : undefined;

  /**
   * "Can chu y" PHAI IM LANG KHI KHONG CO GI DANG BAO. Ban truoc lay max cua
   * ti le brand-khong-co-contact, va vi bao gio cung co mot cai lon nhat, no
   * bao dong ca khi moi thu dang tot: tren ban that no khoe "F&B needs
   * attention: 6% of its brands have no contact" - tuc DUNG MOT brand tren 17,
   * trong khi coverage cua F&B la 94% va moi category khac la 100%. Mot canh
   * bao luon sang thi khong ai con nhin no.
   *
   * Gio phai dat CA HAI nguong moi tinh la van de: it nhat 3 brand, va it nhat
   * 20% brand cua category do.
   */
  const thieuContact = list
    .filter((c) => c.brands > 0 && c.noContact >= MIN_BRAND_BAO_DONG
      && c.noContact / c.brands >= TI_LE_BRAND_BAO_DONG)
    .sort((a, b) => b.noContact / b.brands - a.noContact / a.brands)[0];

  const spenders = list.filter((c) => c.spend > 0).sort((a, b) => b.spend - a.spend);

  /** "37 of 55" - mau so LUON di kem ti le, de khong ai doc 100% cua mot contact. */
  const tiLe = (c: CatRow) => `${Math.round((c.paidFull / c.paid) * 100)}% full (${c.paidFull} of ${c.paid})`;

  // Mot dong "so what" ngay duoi tieu de, thay vi bat nguoi doc tu suy ra tu
  // bang so - day la thu mot C-level doc truoc tien.
  const takeaways: string[] = [];
  if (spenders[0] && totalSpend > 0) {
    takeaways.push(`${spenders[0].name} leads spend at ${Math.round((spenders[0].spend / totalSpend) * 100)}% (${spenders[0].spend.toLocaleString('en-US')}).`);
  }
  // KHONG nhac lai best/weakest o day: hai o KPI ngay duoi (dong 5-7) da noi
  // dung hai dieu do. Dong nay gop het bon cau thi dai ~230 ky tu tren MOT dong
  // gop khong wrap, tuc bi cat - dung loai loi vua sua o sheet nay. Dong 3 chi
  // giu nhung gi KHONG co trong o KPI.
  // Chi noi ve brand chua co contact khi no THAT SU la van de. Khong thi noi
  // con so that, vi "112 of 113" la tin tot va doc mot cau khang dinh de hieu
  // hon la khong doc gi.
  if (thieuContact) {
    takeaways.push(`${thieuContact.name} needs attention: ${thieuContact.noContact} of its ${thieuContact.brands} brands have no contact yet.`);
  } else if (totalBrands > 0) {
    const coContact = list.reduce((n, c) => n + c.withContact, 0);
    takeaways.push(`${coContact} of ${totalBrands} brands have at least one contact.`);
  }
  ws.mergeCells('A3:K3');
  ws.getCell('A3').value = takeaways.length ? takeaways.join('   ·   ') : 'Not enough data yet to call out a trend.';
  ws.getCell('A3').font = { bold: true, size: 11.5, color: { argb: TEAL } };
  // wrapText + do cao hai dong: luoi an toan cho truong hop ten category dai
  // lam cau nay tran ra. Mot o gop MOT dong khong wrap thi phan tran bi cat
  // mat, khong co dau hieu gi.
  ws.getCell('A3').alignment = { wrapText: true, vertical: 'middle' };
  ws.getRow(3).height = 28;

  /**
   * Dai ba o KPI, nam NGANG tren mot bang.
   *
   * Truoc day ba o nay xep DOC o cot H..K de nhuong cho trai cho bieu do anh.
   * Bieu do da bi bo (xem lib/categoryPalette.ts), nen xep doc chi de lai mot
   * khoang trong to giua dong 5 va dong 20 - va chinh khoang trong do la cho
   * anh tung de len tieu de bang.
   *
   * Do rong khong deu la co y: o thu ba chua cau dai nhat ("F&B - 6% of brands
   * have no contact") nen duoc dai nhat (cot F..J), o dau chi chua mot con so
   * nen ngan nhat.
   */
  function statTile(colTu: number, colDen: number, label: string, value: string, valueColor: string) {
    const A = (n: number) => ws.getColumn(n).letter;
    ws.mergeCells(`${A(colTu)}5:${A(colDen)}5`);
    const l = ws.getCell(`${A(colTu)}5`);
    l.value = label;
    l.font = { bold: true, size: 10.5, color: { argb: 'FF6F878B' } };
    l.alignment = { vertical: 'middle' };

    ws.mergeCells(`${A(colTu)}6:${A(colDen)}7`);
    const v = ws.getCell(`${A(colTu)}6`);
    v.value = value;
    v.font = { bold: true, size: 14, color: { argb: valueColor } };
    v.alignment = { wrapText: true, vertical: 'top' };

    for (let r = 5; r <= 7; r++) {
      for (let c = colTu; c <= colDen; c++) {
        ws.getRow(r).getCell(c).border = {
          top: r === 5 ? { style: 'thin', color: { argb: 'FFE1E9E6' } } : undefined,
          bottom: r === 7 ? { style: 'thin', color: { argb: 'FFE1E9E6' } } : undefined,
          left: c === colTu ? { style: 'thin', color: { argb: 'FFE1E9E6' } } : undefined,
          right: c === colDen ? { style: 'thin', color: { argb: 'FFE1E9E6' } } : undefined,
        };
      }
    }
  }

  // Cot phai duoc dat do rong TRUOC statTile: ham do doc ws.getColumn(n).letter,
  // va no can cot da ton tai.
  LAYOUT.COLS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  ws.getRow(LAYOUT.TILE_ROW).height = 16;
  ws.getRow(LAYOUT.TILE_ROW + 1).height = 19;
  // Dong thu hai cua o KPI phai du cao: cau dai nhat ("Beauty - 12% full
  // (9 of 75)") xuong hai dong o font 14, va o anh chup PIC gui kem chu
  // "contacts" bi cat mat mot nua vi dong nay con o do cao mac dinh.
  ws.getRow(LAYOUT.TILE_ROW + 2).height = 19;

  statTile(1, 2, 'Total credit spent',
    totalSpend > 0 ? totalSpend.toLocaleString('en-US') : 'None yet for this period',
    totalSpend > 0 ? TEAL : 'FF6F878B');

  /**
   * Nhan noi RO "paid reveals only" va gia tri LUON kem mau so.
   *
   * Hai chuyen da sai o ban truoc, ca hai deu lam nguoi doc tin mot dieu khong
   * dung:
   *   - Nhan chi ghi "Best contact yield" ma khong noi tinh tren cai gi, trong
   *     khi mau so la MOI contact - ke ca contact nguoi go tay, thu khong ton
   *     credit nao. Mom & Baby hien 41% full trong khi 3 credit cua no chi mua
   *     21 contact o 29%; con so 41% do 42 dong go tay ganh.
   *   - Gia tri chi ghi "100% full contacts" ma khong ghi "1 of 1", nen China
   *     Project duoc khoe la tot nhat trong khi no co dung mot contact.
   */
  statTile(3, 5, `Best contact yield (paid reveals, ${MIN_CONTACT_XEP_HANG}+ contacts)`,
    fullLeader ? `${fullLeader.name} — ${tiLe(fullLeader)}` : CHUA_DU_MAU,
    fullLeader ? TEAL : 'FF6F878B');

  /**
   * O nay noi CA nguyen nhan, khong chi con so.
   *
   * "Beauty - 13% full (12 of 82)" khong noi phai lam gi. "48 came back with
   * nothing" thi noi: credit dang mua ban ghi rong, khong phai contact thieu
   * phone. Hai chuyen do dan den hai viec khac han nhau.
   *
   * Chi tiet day du (thanh xep tang + mot cau cho tung category) nam o sheet
   * "Contact quality" - xem lib/qualitySheet.ts.
   */
  const nn = weakLeader ? nguyenNhanNgan(weakLeader) : '';
  // Con tro sang sheet chi tiet nam o NHAN, khong nam trong gia tri: gia tri o
  // font 14 ma them mot cau nua thi tran ra dong thu ba va bi cat - dung loai
  // loi da sua o sheet nay. Nhan o font 10.5 nen chua duoc.
  statTile(6, 11, 'Weakest yield — why, on the "Contact quality" sheet',
    weakLeader
      ? `${weakLeader.name} — ${tiLe(weakLeader)}` + (nn ? `  ·  ${nn}` : '')
      : CHUA_DU_MAU,
    weakLeader ? RED : 'FF6F878B');

  // ---------- Bang chi tiet, xep theo chi tieu giam dan ----------
  const tableStart = LAYOUT.TABLE_START;

  /**
   * Cot contact TACH theo "credit co mua khong", khong gop lam mot.
   *
   * Sheet nay ten la "Credit & Contacts", nen mau so co y nghia duy nhat cho
   * mot ti le la nhung contact credit THAT SU mua (isByCredit). Gop contact go
   * tay vao lam ti le khong con do duoc dieu gi: no do ca cong suc nhap tay
   * cua PIC lan hieu qua cua reveal, tron thanh mot so khong dien giai duoc.
   * Sheet Pipeline da tach "Found by the app / Added by hand" tu lau; sheet nay
   * gio moi tach.
   *
   * Cot "Free contacts" van hien de khong thu gi bi giau: do la seed list da
   * xac minh (khong goi API nen amount = 0) cong contact go tay.
   */
  ws.getRow(tableStart).values = [
    'Category', 'Credit spent', 'Share of spend', 'Brands', 'With contact',
    'No contact', 'Coverage', 'Paid contacts', 'Full (paid)', 'Full rate (paid)',
    'Free contacts',
  ];
  const hdr = ws.getRow(tableStart);
  hdr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
  hdr.height = 20;
  hdr.alignment = { wrapText: true, vertical: 'middle' };

  const sortedForTable = [...list].sort((a, b) => b.spend - a.spend);
  let rIdx = tableStart;
  for (const c of sortedForTable) {
    rIdx += 1;
    const coverage = c.brands > 0 ? c.withContact / c.brands : null;
    const fullRate = c.paid > 0 ? c.paidFull / c.paid : null;
    const share = totalSpend > 0 ? c.spend / totalSpend : null;
    const row = ws.getRow(rIdx);
    row.values = [
      c.name, c.spend, share != null ? share : '', c.brands, c.withContact,
      c.noContact, coverage != null ? coverage : '', c.paid, c.paidFull,
      fullRate != null ? fullRate : '', c.free,
    ];
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(colorOf.get(c.id)!) } };
    // chuTren(): chon trang hay den theo nguong tuong phan that su - xem
    // NGUONG_CHU_DEN o lib/categoryPalette.ts.
    row.getCell(1).font = { bold: true, color: { argb: chuTren(colorOf.get(c.id)!) } };
    row.getCell(3).numFmt = '0%';
    row.getCell(7).numFmt = '0%';
    row.getCell(10).numFmt = '0%';

    /**
     * Ti le tinh tren mau qua nho hien MO, khong phai an di.
     *
     * Mat nguoi doc bang so se tu xep hang theo con so to nhat, va "100%" cua
     * mot contact duy nhat se thang moi con so that. Lam mo la cach noi "dung
     * doc dong nay nhu mot thanh tich" ma khong xoa du lieu - nguoi can so
     * chinh xac van thay no.
     *
     * Cung ly do voi viec KHONG ve data bar cho cot ti le: mot thanh dai het
     * co cho China Project 100%-cua-1 se tao lai dung cai bay dang sua o day.
     * Data bar chi ve cho cot DEM (Credit spent, Paid contacts), noi do dai
     * thanh tuong ung voi mot so luong that.
     */
    if (c.paid > 0 && c.paid < MIN_CONTACT_XEP_HANG) {
      row.getCell(10).font = { italic: true, color: { argb: 'FF9AA8AB' } };
    }
    if (c.id === fullLeader?.id) paint(row.getCell(10), TEAL);
    if (c.id === weakLeader?.id) paint(row.getCell(10), RED);
    if (c.id === thieuContact?.id) paint(row.getCell(6), RED);
  }
  rIdx += 1;
  const totalRow = ws.getRow(rIdx);
  totalRow.values = [
    'Total', totalSpend, '', totalBrands,
    list.reduce((s, c) => s + c.withContact, 0), list.reduce((s, c) => s + c.noContact, 0),
    '', totalPaid, totalPaidFull, totalPaid > 0 ? totalPaidFull / totalPaid : '',
    list.reduce((s, c) => s + c.free, 0),
  ];
  totalRow.font = { bold: true };
  totalRow.getCell(10).numFmt = '0%';
  totalRow.eachCell((c) => { c.border = { top: { style: 'thin', color: { argb: 'FFC3C2B7' } } }; });

  /**
   * Data bar NGAY TRONG cot dem - day la thu thay cho bieu do anh da bi bo
   * (xem lib/categoryPalette.ts).
   *
   * Dung conditional formatting that cua Excel, khong phai hinh ve: khong can
   * font nen khong the ra o vuong rong tren server, khong phai mot anh noi de
   * dat lan cho o khac, va no ve lai dung khi nguoi doc sap lai hay loc bang.
   *
   * CHI cho cot DEM (Credit spent, Paid contacts), KHONG cho cot ti le - xem
   * ghi chu o cho lam mo ti le mau nho ben tren.
   *
   * Chi ap cho cac dong du lieu, KHONG gom dong Total: Total luon la so lon
   * nhat nen thanh cua no se dai het co va dim moi thanh con lai thanh vach
   * mo. gradient: false cho canh thanh dut khoat, de uoc luong do dai bang mat
   * hon mot dai chuyen mau.
   *
   * cfvo bat dau tu num 0, khong phai 'min': lay min lam goc thi category thap
   * nhat se co thanh dai bang 0 va doc ra nhu bang khong, trong khi no khong
   * bang khong.
   */
  if (rIdx > tableStart + 1) {
    for (const cotSo of [2, 8]) {
      const cot = ws.getColumn(cotSo).letter;
      ws.addConditionalFormatting({
        ref: `${cot}${tableStart + 1}:${cot}${rIdx - 1}`,
        rules: [{
          type: 'dataBar',
          gradient: false,
          showValue: true,
          minLength: 0,
          maxLength: 100,
          color: { argb: cotSo === 2 ? 'FF0093A3' : 'FF7FC5CC' },
          cfvo: [{ type: 'num', value: 0 }, { type: 'max' }],
        } as any],
      });
    }
  }

  /**
   * Chu thich duoi bang. Ba cau, va ca ba deu de chan mot cach doc sai CU THE
   * ma nguoi that da doc sai:
   *
   *   1. Ti le mo = mau qua nho. Khong noi ra thi nguoi doc van xep hang theo no.
   *   2. "Free contacts" la gi, va vi sao no khong nam trong ti le.
   *   3. KHONG duoc chia "Credit spent" cho so contact. So credit_ledger chi bat
   *      dau tu 09/09/2026 trong khi contact som nhat la 23/08/2026: 22 contact
   *      loai ton-credit khong co dong ledger nao (credit do tieu o ban n8n cu).
   *      Tong so ghi 98 credit cho 192 contact ton-credit - chia hai so do ra la
   *      uu ai category nao co nhieu lich su di tru hon. Day la ly do sheet nay
   *      KHONG co cot "credit tren moi contact", du do la con so mot C-level hoi
   *      dau tien.
   */
  rIdx += 2;
  const ghiChu = ws.getRow(rIdx);
  ws.mergeCells(`A${rIdx}:K${rIdx}`);
  ghiChu.getCell(1).value =
    `A grey italic rate means fewer than ${MIN_CONTACT_XEP_HANG} paid contacts — too few to rank, `
    + '1 of 1 is 100%.  ·  "Free contacts" are the verified seed list plus anything added by hand; '
    + 'no credit bought them, so they are left out of the rate.  ·  Do not divide Credit spent by '
    + 'contacts: the credit ledger only starts once the app took over, so some contacts here were paid '
    + 'for in the old system and have no ledger row.';
  ghiChu.getCell(1).font = { italic: true, size: 9.5, color: { argb: 'FF6F878B' } };
  ghiChu.getCell(1).alignment = { wrapText: true, vertical: 'top' };
  ghiChu.height = 42;

  /**
   * ---------------------------------------------------------------------------
   * KHOI "VI SAO" - nam TRONG CUNG SHEET nay, khong phai mot tab rieng
   * ---------------------------------------------------------------------------
   * Truoc day day la mot sheet thu hai ("Contact quality"). Bo di vi hai tab
   * phuc vu DUNG MOT muc dich: mot tab noi ti le, tab kia noi vi sao ti le nhu
   * vay. Nguoi doc phai nho so o tab nay roi sang tab kia tim nguyen nhan, ma
   * hai con so lai la cua cung mot phep tinh.
   *
   * Va quan trong hon: cai goi la "vi sao" o tab cu that ra khong phai vi sao.
   * "51 trong 85 reveal ve tay khong" chi la cach noi khac cua "full rate 14%"
   * - cung mot con so, tach ra thanh phan. Do la CAI GI, khong phai TAI SAO.
   *
   * Nguyen nhan THAT, do duoc tren du lieu that, nam o hai truc duoi day:
   *   - NOI NGUOI DO NGOI: trong Viet Nam 30% rong, ngoai Viet Nam 65% rong.
   *     Hon gap doi, va 33 trong 37 cai rong ngoai VN la Han Quoc.
   *   - BRAND NAO: con so category che mat su that o cap brand.
   */
  rIdx += 2;
  const dauKhoi = rIdx;
  ws.mergeCells(`A${rIdx}:K${rIdx}`);
  ws.getCell(`A${rIdx}`).value = 'Why reveals come back empty';
  ws.getCell(`A${rIdx}`).font = { bold: true, size: 13, color: { argb: TEAL } };
  ws.getRow(rIdx).height = 20;

  /**
   * Cau ket luan, TINH TU du lieu chu khong viet san.
   *
   * So sanh hai nhom: neu nhom ngoai Viet Nam rong nhieu hon ro rang thi noi
   * ra, kem ca ti le cua hai ben de nguoi doc tu thay do lech. Khong dat duoc
   * nguong chenh lech thi khong ket luan - mot cau nguyen nhan sai con te hon
   * khong co cau nao.
   */
  const vn = viTri.find((v) => v.key === 'vn');
  const ngoai = viTri.find((v) => v.key === 'ngoai');
  rIdx += 1;
  ws.mergeCells(`A${rIdx}:K${rIdx}`);
  const oKetLuan = ws.getCell(`A${rIdx}`);

  const tiRong = (v: ViTriRow | undefined) => (v && v.paid > 0 ? v.empty / v.paid : null);
  const rVn = tiRong(vn);
  const rNgoai = tiRong(ngoai);

  /**
   * HAI TANG, moi tang phai co bang chung RIENG moi duoc noi.
   *
   * Ban truoc viet "It is where the person sits, NOT the category" - va do la
   * mot ket luan confounded, da bi chinh du lieu pha: location va category
   * tuong quan voi nhau (Beauty la cho tap trung brand indie Han), nen chon
   * mot cai roi phu dinh cai kia la doan, khong phai ket luan.
   *
   * Bang cheo that: CHI tinh nguoi o Viet Nam, Beauty rong 48% con F&B rong
   * 13%. Chenh 35 diem trong cung mot nhom vi tri, tuc category co tac dong
   * doc lap. Mot CEO doc "khong phai category" roi bao team cu scan Beauty
   * thoai mai se ra quyet dinh sai.
   *
   * Nen: hai cau, hai dieu kien doc lap, va KHONG cau nao phu dinh cau kia.
   */
  const cau: string[] = [];

  // Tang 1: category, do TRONG CUNG mot nhom vi tri (chi nguoi o Viet Nam) -
  // do la cach duy nhat tach tac dong cua category ra khoi tac dong cua noi o.
  const duVn = list.filter((c) => c.paidVn >= MIN_CONTACT_XEP_HANG);
  if (duVn.length >= 2) {
    const theo = [...duVn].sort((a, b) => a.paidVnEmpty / a.paidVn - b.paidVnEmpty / b.paidVn);
    const tot = theo[0];
    const te = theo[theo.length - 1];
    const rTot = tot.paidVnEmpty / tot.paidVn;
    const rTe = te.paidVnEmpty / te.paidVn;
    if (rTe - rTot >= 0.15) {
      cau.push(
        `Two things stack up, and the category is one of them. Counting only people based in Vietnam, `
        + `${te.name} comes back empty ${Math.round(rTe * 100)}% of the time against ${tot.name}'s `
        + `${Math.round(rTot * 100)}% — same country, very different odds.`,
      );
    }
  }

  // Tang 2: noi nguoi do ngoi.
  if (vn && ngoai && rVn != null && rNgoai != null
      && vn.paid >= MIN_CONTACT_XEP_HANG && ngoai.paid >= MIN_CONTACT_XEP_HANG
      && rNgoai - rVn >= 0.15) {
    cau.push(
      `On top of that, where the person sits matters: ${Math.round(rNgoai * 100)}% empty for people outside `
      + `Vietnam against ${Math.round(rVn * 100)}% inside`
      + (ngoai.topNuoc ? ` — ${ngoai.topNuocEmpty} of those are in ${ngoai.topNuoc}` : '')
      + `. ${ngoai.emptyWithLinkedin} of them do have a LinkedIn profile, so they are reachable, just not by email or phone.`,
    );
  }

  if (cau.length) {
    oKetLuan.value = cau.join('  ');
    oKetLuan.font = { bold: true, size: 10.5, color: { argb: 'FF52514E' } };
  } else {
    oKetLuan.value = 'Not enough reveals yet to say where the empty ones come from.';
    oKetLuan.font = { italic: true, size: 10, color: { argb: 'FF6F878B' } };
  }
  oKetLuan.alignment = { wrapText: true, vertical: 'top' };
  ws.getRow(rIdx).height = 46;

  // ---------- Truc 1: noi nguoi do ngoi ----------
  rIdx += 2;
  const hdrViTri = ws.getRow(rIdx);
  // Bay cot LIEN NHAU (A..G), khong de cot trong o giua: ban truoc dat "Has
  // LinkedIn" o cot H nen E-F-G rong tao mot khoang ho giua bang, doc nhu bang
  // bi loi render.
  hdrViTri.values = ['Where the person sits', 'Paid', 'Empty', 'Empty rate',
    'Has LinkedIn anyway', 'Full', 'Full rate'];
  for (let c = 1; c <= 7; c++) {
    const o = hdrViTri.getCell(c);
    o.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10.5 };
    o.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
    o.alignment = { wrapText: true, vertical: 'middle' };
  }
  hdrViTri.height = 18;

  const viTriTu = rIdx + 1;
  for (const v of viTri) {
    if (v.paid === 0) continue;
    rIdx += 1;
    const row = ws.getRow(rIdx);
    row.values = [
      v.label, v.paid, v.empty, v.empty / v.paid,
      v.emptyWithLinkedin, v.full, v.full / v.paid,
    ];
    row.getCell(4).numFmt = '0%';
    row.getCell(7).numFmt = '0%';
    // To do dong te nhat, de mat bat duoc ngay dong nao la van de.
    if (v.key === 'ngoai' && v.paid > 0 && v.empty / v.paid >= 0.5) {
      paint(row.getCell(4), RED);
      row.getCell(1).font = { bold: true };
    }
  }
  const viTriDen = rIdx;

  /**
   * Data bar cho cot "Empty rate" cua RIENG bang nay.
   *
   * O bang category thi ti le KHONG duoc ve bar (mot thanh dai het co cho
   * 100%-cua-1 la cai bay da phai sua). O day thi ve duoc, vi day chi co hai
   * ba dong va ca hai deu co mau lon (122 va 57) - khong co dong nao mau nho
   * de bi doc sai.
   *
   * cfvo chay tu 0 den 1 CO DINH, khong phai 'max': lay max lam moc thi dong
   * te nhat luon dai het thanh du no la 30% hay 90%, tuc mat con so tuyet doi.
   */
  if (viTriDen >= viTriTu) {
    ws.addConditionalFormatting({
      ref: `D${viTriTu}:D${viTriDen}`,
      rules: [{
        type: 'dataBar',
        gradient: false,
        showValue: true,
        minLength: 0,
        maxLength: 100,
        color: { argb: 'FFD98C8B' },
        cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 1 }],
      } as any],
    });
  }

  // ---------- Truc 2: brand nao dang ganh ----------
  rIdx += 2;
  ws.mergeCells(`A${rIdx}:K${rIdx}`);
  ws.getCell(`A${rIdx}`).value =
    'The brands carrying it. A category number hides this: most brands come back clean and a few carry all the empties.';
  ws.getCell(`A${rIdx}`).font = { italic: true, size: 10, color: { argb: 'FF6F878B' } };
  ws.getCell(`A${rIdx}`).alignment = { wrapText: true, vertical: 'top' };
  ws.getRow(rIdx).height = 16;

  rIdx += 1;
  const hdrBrand = ws.getRow(rIdx);
  hdrBrand.values = ['Brand', 'Category', 'Paid', 'Empty', 'Empty rate'];
  for (let c = 1; c <= 5; c++) {
    const o = hdrBrand.getCell(c);
    o.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10.5 };
    o.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
  }
  hdrBrand.height = 18;

  const brandTu = rIdx + 1;
  for (const b of brands) {
    rIdx += 1;
    const row = ws.getRow(rIdx);
    row.values = [b.brand, b.category, b.paid, b.empty, b.paid > 0 ? b.empty / b.paid : ''];
    row.getCell(5).numFmt = '0%';
    if (b.paid > 0 && b.empty / b.paid >= 0.75) paint(row.getCell(5), RED);

    /**
     * Mau nho thi lam MO ti le, giong het bang category o tren.
     *
     * Bang nay sap theo SO TUYET DOI reveal rong, nen mot brand 6/6 dung o day
     * la dung - no that su ganh 6 cai. Nhung "100%" cua 6 lan goi khong so
     * sanh duoc voi "91%" cua 11 lan, va mat nguoi doc se xep hang theo con so
     * to nhat. Ban truoc cua khoi nay hien 100% o n=6 khong lam mo gi - tuc
     * tai tao lai dung cai bay mau nho da phai sua o bang tren.
     */
    if (b.paid < MIN_PAID_BRAND_DE_XEP_HANG) {
      row.getCell(5).font = { italic: true, color: { argb: 'FF9AA8AB' } };
    }
  }
  const brandDen = rIdx;

  if (brands.length === 0) {
    rIdx += 1;
    ws.mergeCells(`A${rIdx}:E${rIdx}`);
    ws.getCell(`A${rIdx}`).value = 'No reveal has come back empty yet.';
    ws.getCell(`A${rIdx}`).font = { italic: true, color: { argb: 'FF6F878B' } };
  } else {
    ws.addConditionalFormatting({
      ref: `D${brandTu}:D${brandDen}`,
      rules: [{
        type: 'dataBar',
        gradient: false,
        showValue: true,
        minLength: 0,
        maxLength: 100,
        color: { argb: 'FFD98C8B' },
        // THANG CO DINH 0..1, giong het cot "Empty rate" cua bang tren. Ban
        // truoc bang nay dung 'max' nen hai cot CUNG TEN tren CUNG sheet co
        // hai thang khac nhau: mot thanh dai o bang nay khong bang mot thanh
        // dai o bang kia, va nguoi doc so sanh cheo se sai.
        cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 1 }],
      } as any],
    });
  }

  // Khoi nay KHONG duoc cham vao dai bang category o tren - kiem bang test.
  void dauKhoi;


  for (let i = tableStart + 1; i < rIdx; i++) {
    if ((i - tableStart) % 2 === 0) {
      ws.getRow(i).eachCell({ includeEmpty: true }, (c, colNumber) => {
        if (colNumber < 2 || colNumber > 11) return;
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY } };
      });
    }
  }
}
