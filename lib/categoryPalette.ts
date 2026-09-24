/**
 * Mau cho tung category, dung o sheet Credit & Contacts cua export.
 *
 * ---------------------------------------------------------------------------
 * Vi sao khong con bieu do ve bang anh
 * ---------------------------------------------------------------------------
 * File nay truoc day ten shareChart.ts va co renderShareBarChart(): dung SVG
 * roi rasterize sang PNG bang sharp, nhung vao Excel bang wb.addImage(). Da bo
 * han, vi hai ly do doc lap nhau:
 *
 *   1. CHU TRONG ANH KHONG RENDER DUOC O SERVER. Container Linux cua Vercel
 *      khong co font nao, nen librsvg trong sharp khong co glyph de ve: moi
 *      chu trong bieu do ra o vuong rong. Tren may Windows thi lai dep, vi
 *      Windows co Segoe UI va Arial - do la ly do loi nay thoat duoc mot lan
 *      kiem tra tai cho va chi lo ra tren ban that. Muon giu chu trong anh
 *      thi phai ship mot file font vao repo va noi day fontconfig, qua nhieu
 *      manh de hong cho mot hinh ve.
 *
 *   2. NO VE LAI DUNG CAI BANG NGAY BEN DUOI. Bang chi tiet da sap theo chi
 *      tieu giam dan va da co cot "Share of spend". Anh la ban thu hai cua
 *      cung mot thong tin, va no chiem cho: khi ve dung kich thuoc (680x340)
 *      no phu tu dong 5 xuong dong 21 va de len ca tieu de bang lan cac o
 *      highlight ben phai.
 *
 * Thay bang data bar NATIVE cua Excel ngay trong cot "Credit spent"
 * (addConditionalFormatting type 'dataBar', xem app/api/export/route.ts).
 * Khong can font, khong co anh de dat sai cho, va no ve lai dung khi nguoi doc
 * sap lai hay loc bang.
 *
 * DUNG them chu vao mot anh sinh o server o bat cu cho nao khac trong du an,
 * tru khi da ship font kem theo va da kiem tra tren ban deploy that.
 */

export function relativeLuminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Nguong chon chu trang hay chu den tren nen mau, theo cong thuc tuong phan
 * WCAG: duoi nguong thi mau tuong phan tot hon voi trang, tren thi tot hon voi
 * den.
 *
 * 0.179 la diem giao THAT SU. Ban truoc dung 0.45 va day chu trang len ca
 * nhung mau sang trung binh - #EDA100 vang chi con 2.2:1, #1BAF7A xanh 2.8:1,
 * #E87BA4 hong 2.7:1, tuc duoi ca muc 3:1 toi thieu cho chu dam.
 */
export const NGUONG_CHU_DEN = 0.179;

/** ARGB cho ExcelJS (khong co dau #, co byte alpha dan dau). */
export function argb(hex: string): string {
  return hex.replace('#', 'FF').toUpperCase();
}

/** Mau chu doc duoc nhat tren nen `hex`. */
export function chuTren(hex: string): string {
  return relativeLuminance(hex) < NGUONG_CHU_DEN ? 'FFFFFFFF' : 'FF0B0B0B';
}

/**
 * 8 hue cua bang mau categorical da validate (dataviz skill, palette.md),
 * thu tu CO DINH - mot category luon lay cung mot mau du sap xep lai danh
 * sach, khong gan mau theo hang muc chi tieu (xem color-formula.md: "color
 * follows the entity, never its rank"). Ca 8 hue nay pass adjacent-pair CVD
 * check (dung cho bang/legend dat canh nhau); KHONG dung ca 8 cho mot bieu do
 * kieu scatter/small-multiples (chi 3 hue dau moi pass all-pairs).
 *
 * Dung het 8 slot truoc khi can gan mau cho category thu 9 tro di - xem
 * colorForIndex(): khong bao gio lap lai (cycle) mot hue da dung, vi hai
 * category trung mau la sai theo dung nghia (tung xay ra o day: 7 category
 * chia 6 mau khien Beauty va Mom & Baby cung mau xanh).
 */
export const CATEGORY_PALETTE = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
];

/** Mau cho category thu i (0-based). Het 8 slot rieng thi ngoi chung mau xam trung tinh, khong cycle lai tu dau. */
export function colorForIndex(i: number): string {
  return CATEGORY_PALETTE[i] ?? '#898781';
}

/**
 * Mau thuong hieu, dang ARGB cho ExcelJS. Lay tu CLAUDE.md muc "Nhan dien
 * thuong hieu" - da co dinh, dung tu doi.
 *
 * Dat o day de route va lib/creditSheet.ts dung CHUNG mot ban, khong moi noi
 * mot chuoi hex rieng.
 */
export const TEAL  = 'FF0C3D47';
export const RED   = 'FFD43A38';
export const AMBER = 'FFB9791F';
export const GREY  = 'FFF1F4F4';
