-- Don nhung alias brand ma app da TU HOC SAI, va cac dong chi khac cach viet.
--
-- Khong co thu muc migrations trong du an. File nay dat rieng, ten ro rang,
-- chay tay qua Supabase SQL Editor - giong can_use_category.sql,
-- fix_alias_priority.sql va dedup_contact.sql.
--
-- ===========================================================================
-- CHUYEN GI DA XAY RA
-- ===========================================================================
--
-- ghiAliasHocDuoc() tung chot bang `n >= 2 || ti le >= 0.6`. Dau `||` bien ve
-- 60% thanh code chet: hai nguoi tren mot tram cung khai mot ten la du ghi
-- mot alias VINH VIEN cho brand do.
--
-- Do tren DB that (07/10/2026): 1063 dong alias, 202 dong tu hoc. Luat cu giu
-- CA 202. Tam ba dong trong so do duoi muc "it nhat 3 nguoi VA it nhat 50%",
-- va nhieu cai sai han:
--
--     3%   3/100   green finger    -> Hoa Linh Pharma
--     11%  4/35    nature s way    -> BEE MASTER OF LAS VEGAS INC
--     20%  7/35    kendamil        -> TRUONG VINH KY HIGH SCHOOL
--     30%  8/27    iunik           -> Iunik Travel
--
-- Rac sinh ra nhu the nao, ke lai mot ca co that vi no giai thich het co che.
-- Mot brand sua bot co alias NHAP TAY dung: ten nha phan phoi cap 1 o Viet
-- Nam. App di tim ten nha phan phoi do, nhung o Viet Nam co mot truong cap ba
-- TRUNG TEN. Trong 35 nguoi tra ve, 7 nguoi la giao vien truong do - nhieu
-- nhat trong cac ten khai duoc, va luat cu chi can `n >= 2`. The la app ghi
-- "brand sua bot nay thuoc truong cap ba" thanh mot alias vinh vien, roi moi
-- lan quet deu tim them ca truong do.
--
-- Hai dieu rut ra, deu da vao code:
--   - dong thuan 20% KHONG phai dong thuan. Phai co ca so tuyet doi lan ti le.
--   - alias nhap tay cua nguoi van dung; chinh cai TU HOC de len tren no moi
--     la rac. Nen file nay chi dung toi dong co note "Tu hoc", khong bao gio
--     dung toi dong nguoi go.
--
-- Vi sao phai don chu khong ke mac. Mot alias sai khong chi vo dung, no CHIEM
-- LUON brand: searchBrand() tim moi cong ty da mapped TRUOC, va he co du mot
-- nguoi tra ve thi `gop.length > 0` cat han duong tim lai theo ten brand.
-- Brand do tra ve nguoi cua mot cong ty khong lien quan, khong mot canh bao
-- nao, cho den khi co nguoi sua tay. No con an luot trong tran 300 brand mot
-- ngay cua ca team.
--
-- Code da sua (lib/signalhire.ts: chonTenChiem, nguong MIN_DONG_THUAN = 3 va
-- TI_LE_DONG_THUAN = 0.5, co test o test/signalhire.test.ts). File nay don
-- phan DA GHI RA truoc khi sua.
--
-- ===========================================================================
-- DOC KY CAI NAY TRUOC KHI XOA
-- ===========================================================================
--
-- 63 trong so cac brand lien quan se KHONG CON ALIAS NAO sau khi xoa.
--
-- Do khong phai tai nan, nhung phai biet truoc. Brand khong co alias thi
-- searchBrand() tim thang bang ten brand; khong ra ai thi man ket qua bao
-- "Not found in SignalHire - check whether this brand trades under a
-- different legal entity." Cau do DUNG va lam duoc gi do: PIC biet phai di
-- tim ten phap nhan.
--
-- Doi lai voi hien trang: mot alias sai tra ve nguoi that cua mot cong ty
-- that khong lien quan, khong kem canh bao nao. PIC doc danh sach do va tuong
-- day la nguoi cua brand minh. Sai im lang te hon la noi "khong tim thay".
--
-- Sau khi don, nhung brand do se tu lanh dan theo hai duong:
--   - hocAliasTuContact() (moi): moi lan reveal, app doc `company` cua cac
--     contact da luu cua brand do. Nguoi ta khai phap nhan chu so huu chu
--     khong khai brand con, nen day la duong hoc dung ten cong ty me. Da kiem:
--     suy ra dung "Inochi -> Tan Phu Plastic Joint Stock Company".
--   - Admin > Aliases: go tay, va ban go tay luon thang alias tu hoc
--     (priority 0 - xem fix_alias_priority.sql).

-- ---------------------------------------------------------------------------
-- PHAN 1 - CHI DOC. Xem truoc chinh xac cai gi se bi xoa.
-- ---------------------------------------------------------------------------

-- Viet theo LUAT chu khong liet ke san tung dong: chay lai luc nao cung dung,
-- va khong phai sua file nay moi khi bang alias doi.
--
-- Hai bieu thuc duoi day doc `n` va `tong` ra tu chinh cau ghi chu ma
-- ghiAliasHocDuoc() da viet ("... 25/31 ket qua khai ten nay." hoac
-- "... ten nay ra 4/7 nguoi."). Dong nao khong doc duoc se ra NULL, va moi
-- phep so sanh voi NULL deu khong thoa - tuc dong do KHONG bi xoa. Huong an
-- toan: bo sot mot dong rac con hon xoa nham mot alias dung.

create or replace view alias_hoc_yeu as
select
  alias,
  employer,
  priority,
  note,
  substring(note from '(\d+)/\d+ (?:ket qua|nguoi)')::int as nguoi_dong_y,
  substring(note from '\d+/(\d+) (?:ket qua|nguoi)')::int as tong_nguoi,
  round(
    100.0 * substring(note from '(\d+)/\d+ (?:ket qua|nguoi)')::int
          / nullif(substring(note from '\d+/(\d+) (?:ket qua|nguoi)')::int, 0)
  ) as phan_tram
from brand_alias
where note like 'Tu hoc%'
  and substring(note from '(\d+)/\d+ (?:ket qua|nguoi)') is not null
  and (
    substring(note from '(\d+)/\d+ (?:ket qua|nguoi)')::int < 3
    or 1.0 * substring(note from '(\d+)/\d+ (?:ket qua|nguoi)')::int
           / nullif(substring(note from '\d+/(\d+) (?:ket qua|nguoi)')::int, 0) < 0.5
  );

-- 1a. Danh sach se bi xoa, te nhat len dau. Nen ra 83 dong.
select * from alias_hoc_yeu order by phan_tram, tong_nguoi desc;

-- 1b. Brand nao se KHONG CON alias nao. Nen ra 63 dong.
--     Nhin qua mot luot: co cai ten nao ma mat alias la dau that su khong.
select a.alias
from brand_alias a
group by a.alias
having count(*) = count(*) filter (
  where (a.alias, a.employer) in (select alias, employer from alias_hoc_yeu)
)
order by a.alias;

-- ---------------------------------------------------------------------------
-- PHAN 2 - XOA. Chay sau khi da xem Phan 1.
-- ---------------------------------------------------------------------------

-- begin;
--   -- Giu lai mot ban sao de doi chieu/hoan tac trong vai ngay toi.
--   create table if not exists brand_alias_da_xoa_20261009 as
--   select b.*, now() as xoa_luc
--   from brand_alias b
--   where (b.alias, b.employer) in (select alias, employer from alias_hoc_yeu);
--
--   delete from brand_alias b
--   where (b.alias, b.employer) in (select alias, employer from alias_hoc_yeu);
--
--   -- Phai ra 83. Khac nhieu thi dung commit, roll back va xem lai Phan 1.
--   select count(*) as da_xoa from brand_alias_da_xoa_20261009;
-- commit;

-- Hoan tac, neu can, trong khi bang sao con day:
-- insert into brand_alias (alias, employer, relation, priority, note, updated_at)
-- select alias, employer, relation, priority, note, updated_at
-- from brand_alias_da_xoa_20261009
-- on conflict (alias, employer) do nothing;

-- ---------------------------------------------------------------------------
-- PHAN 3 - CHI DOC. Alias tro toi hai ten chi khac cach viet.
-- ---------------------------------------------------------------------------
--
-- "SNB Distribution" va "SNB Distribution LTD.,"; "Bristar" va "Bristar
-- Group"; "The a2 Milk Company" va "The a2 Milk Company Limited". Ve mat tim
-- kiem la mot cong ty, nhung bang alias khoa theo (alias, employer) nen chung
-- nam thanh hai dong, va searchBrand() tim HET moi cong ty da mapped - tuc
-- moi dong thua an them mot den hai luot trong tran 300 brand/ngay, de doi
-- lay gan nhu cung mot danh sach nguoi. `tongTotal` cung cong don hai lan nen
-- con so "N of M" tren man ket qua phong len.
--
-- Tren DB that co 50 alias tro toi nhieu cong ty, phan lon la kieu nay.
--
-- Code da chan khong ghi THEM dong kieu nay nua (laBienTheTen() trong
-- lib/signalhire.ts). Phan da co thi KHONG tu dong xoa o day: chon giu ten
-- nao la viec cua nguoi - ten ngan de khop rong hon, ten day du dung hon khi
-- co nhieu cong ty gan giong. Xem roi xoa tay tung dong.

with chuan as (
  select
    alias,
    employer,
    ' ' || btrim(regexp_replace(lower(employer), '[^a-z0-9]+', ' ', 'g')) || ' ' as khoa
  from brand_alias
)
select
  a.alias,
  a.employer as ten_ngan,
  b.employer as ten_day_du
from chuan a
join chuan b
  on a.alias = b.alias
 and a.employer <> b.employer
 and b.khoa like '%' || a.khoa || '%'      -- ten ngan nam tron trong ten day du
order by a.alias, a.employer;
