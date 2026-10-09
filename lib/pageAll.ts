/**
 * Doc HET mot bang qua PostgREST, khong dung o 1000 dong.
 *
 * PostgREST cat moi truy van khong kem Range/limit o `max-rows` cua server -
 * tren Supabase mac dinh la 1000. No KHONG bao loi: `data` tra ve du 1000 dong
 * va `error` la null, nen moi phep dem phia sau am tham thieu phan con lai. Da
 * kiem truc tiep tren DB that: `scan_candidate` co 18.514 dong, mot
 * `.select('id')` tran tra ve dung 1000.
 *
 * Bang `contact` dang o 993 dong. Bay dung bay: them BAY contact nua la moi
 * con so tren trang /admin (tong, tung category, Complete, Full rate, Gained,
 * va ca `contacts_total` ghi vinh vien vao credit_snapshot) bat dau sai, ma
 * man hinh van xanh. Duong xuat Excel chia lo 100 brand mot nen khong dinh -
 * tuc dung luc UsagePanel hua "khop voi sheet Credit & Contacts" thi hai ben
 * bat dau lech.
 *
 * Dung ham nay cho MOI lan doc ca bang ma so dong khong co tran biet truoc.
 *
 * ---------------------------------------------------------------------------
 * HAI DIEU KIEN de ham nay dung. Thieu mot trong hai la no tai dien dung cai
 * loi no sinh ra de chong.
 *
 * 1. TRUY VAN PHAI SAP XEP THEO MOT KHOA DUY NHAT.
 *
 *    Phan trang bang offset chi dung khi thu tu la thu tu TOAN PHAN. Sap theo
 *    mot cot co gia tri trung thi Postgres duoc quyen tra ve cac dong trung
 *    nhau theo thu tu khac giua hai lan goi, nen mot dong co the bi nhay qua
 *    hoac lay hai lan ngay tai cho noi hai trang.
 *
 *    Khong phai chuyen gia dinh: `contact` co 993 dong nhung chi 941 gia tri
 *    `created_at` khac nhau. Sap theo `created_at` khong thi chua du - phai
 *    kem `id` lam khoa phu (hoac sap thang theo `id` neu thu tu khong quan
 *    trong).
 *
 * 2. BUOC NHAY PHAI LA SO DONG THAT SU NHAN DUOC, khong phai so dong da hoi.
 *
 *    Ban dau ham nay cong `tu += lo` sau moi vong va dung lai khi
 *    `phan.length < lo`. Cach do chi dung khi `lo` <= `max-rows` cua server.
 *    Neu server cat o muc thap hon `lo` - doi cau hinh, hoac mot cho goi khac
 *    truyen `lo` lon hon - thi vong dau nhan ve it hon da hoi, ham tuong het
 *    bang va dung lai, bo lai toan bo phan con lai. Dung y het cai loi 1000
 *    dong o tren, chi khac la lan nay do chinh ham chong-loi gay ra.
 *
 *    Cong theo `phan.length` va chi dung khi mot trang ve RONG thi dung bat ke
 *    server cat o dau. Gia ban them dung mot request rong o cuoi.
 */
export async function docTatCa<T>(
  truyVan: (tu: number, den: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  lo = 500,
): Promise<T[]> {
  if (!Number.isInteger(lo) || lo < 1) throw new Error(`docTatCa: lo phai la so nguyen duong, nhan duoc ${lo}`);

  const ra: T[] = [];
  for (let tu = 0; ;) {
    const { data, error } = await truyVan(tu, tu + lo - 1);
    if (error) throw new Error(error.message);

    const phan = data ?? [];
    if (phan.length === 0) return ra;

    ra.push(...phan);
    tu += phan.length;   // KHONG phai `tu += lo` - xem dieu kien 2 o tren.
  }
}
