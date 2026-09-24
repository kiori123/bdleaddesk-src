/**
 * Khoa doi chieu ten brand. Dung CHUNG cho moi noi tao hoac tra brand.
 *
 * Truoc day ham nay nam rieng trong app/api/ingest/route.ts. Cho nao can khop
 * brand ma khong goi duoc no thi phai tu viet lai, va chi can lech mot buoc
 * chuan hoa la sinh ra brand thu hai trung ten: "Chin-su" va "Chin Su" thanh
 * hai dong, contact chia doi giua hai dong do.
 *
 * DAU CAU THANH KHOANG TRANG. Ban truoc giu nguyen dau nhay va dau gach, va
 * dung dieu ma ghi chu tren canh bao da xay ra - khong phai voi brand trung
 * ten, ma voi bang alias:
 *
 *   PIC go "L'Oreal Paris"  -> khoa "l'oreal paris"
 *   bang alias luu          ->      "l oreal paris"  -> "L'Oreal Vietnam"
 *
 * Hai chuoi khac nhau, nen alias KHONG BAO GIO duoc tra ra. App di tim dung
 * chu "L'Oreal Paris" lam ten cong ty, va vi do la ten mot DONG SAN PHAM chu
 * khong phai phap nhan tuyen dung, ket qua tra ve la beauty advisor, chu salon
 * va "Individually owned and operated" khap the gioi - khong mot ai trong doi
 * L'Oreal Vietnam. Bao cao "L'Oreal mot nui nguoi o VN ma khong ra VN" la
 * chuyen nay, khong phai loi bo loc dia diem.
 *
 * Bo alias goc (868 dong) duoc nap voi dau cau da thay bang khoang trang, nen
 * ca mot lop brand chung so phan do - kiem tren du lieu that: Kiehl's, Lay's,
 * Pond's, McDonald's, Domino's Pizza, Biti's, Nature's Way, Johnson's Baby,
 * Wall's, Beck's, La Roche-Posay, Koala's March, M&M's, P/S va L'Oreal Paris.
 * 15 brand mat alias trong im lang.
 *
 * Vi sao sua o DAY chu khong o cho tra alias: ham nay duoc goi tren CA HAI dau
 * - ten PIC go VA gia tri luu trong bang (xem gomAliasTheoUuTien) - nen chi can
 * mot luat duy nhat la hai ben gap nhau. Them mot phep so "de tinh" rieng cho
 * alias la tao ban chuan hoa thu hai, dung cai bay ghi chu tren noi den.
 *
 * `\p{L}\p{N}` chu khong phai `a-z0-9`: giu lai chu cua moi he chu viet. Hom
 * nay bang brand khong co ten chu Han/Han Quoc nao (da kiem), nhung category
 * China Project thi co, va `a-z0-9` se bien mot ten chu Han thanh chuoi rong.
 *
 * KEM MOT FILE SQL: `fix_name_key_punctuation.sql` tinh lai brand.name_key cho
 * 16 dong bi anh huong. Khong chay no thi khoa luu trong DB va khoa ham nay
 * tinh ra se lech nhau, va reveal/route.ts (upsert onConflict: 'name_key') se
 * chen mot dong brand THU HAI cho cung mot brand.
 */
export function nameKey(s: string) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
