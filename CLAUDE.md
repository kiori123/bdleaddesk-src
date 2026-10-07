# OnPoint Lead Desk

Công cụ nội bộ của team Business Development, OnPoint. Tìm và xác minh
decision-maker tại các brand, theo dõi tiến độ deal, lưu tài liệu theo brand.

Người dùng: ~5–10 người trong team BD. Không phải sản phẩm public.

## Kiến trúc

App gọi SignalHire trực tiếp (search, reveal, credit balance — `lib/signalhire.ts`,
key đọc từ `app_setting`). Không còn webhook/callback nào giữa app và n8n cho
đường này — `revealUids`/`searchBrand` trả kết quả ngay trong cùng request, và
không có route `/api/webhooks/n8n` nào tồn tại nữa. n8n chỉ còn lo phần chạy
nền chưa dời sang app (nếu có): sinh bio + org chart bằng LLM, ghi mirror sang
Google Sheets, Gmail.

```
Người dùng ─▶ Next.js (Vercel) ──▶ SignalHire (trực tiếp, lib/signalhire.ts)
                    │
                    └────────────▶ Supabase (Postgres + Auth + Storage)
```

**Ranh giới, không được lấn:**

| App | n8n |
|---|---|
| Đăng nhập, phân quyền | Sinh bio + org chart bằng LLM (nếu còn dùng — chưa thấy dây vào app) |
| Toàn bộ giao diện | Ghi mirror sang Google Sheets |
| Gọi SignalHire trực tiếp (search, reveal), kiểm và trừ credit | — |
| Soạn và mở sẵn mail outreach (deep link Outlook qua lib/template.ts) | — |
| Admin panel, trạng thái job | Cron dọn dẹp, cảnh báo lỗi |

**n8n không phục vụ HTML.** Chỉ nhận JSON, trả JSON. Nếu thấy mình sắp viết
HTML trong n8n, dừng lại — chỗ đó thuộc về app.

`n8n-contract.md` mô tả kiến trúc CŨ (search/reveal qua webhook). Từ khi
`lib/signalhire.ts` gọi thẳng SignalHire, hai webhook `/webhook/lead-search`
và `/webhook/lead-reveal` không còn được app gọi nữa — đọc code trước khi tin
file đó, giống cách đã phải làm với `schema.sql`.

## Bối cảnh: hệ thống này thay cái gì

Bản trước chạy hoàn toàn trong n8n Cloud, gồm hai workflow: một pipeline
SignalHire và một portal 100 node dựng HTML bằng cách nối chuỗi trong Code node.
Pipeline chạy tốt và được **giữ lại**. Portal bị thay, vì viết web app bên trong
engine automation dẫn tới hàng loạt hạn chế: dropdown không đọc được dữ liệu
động, thẻ `<script>` bị strip khỏi form, session phải nhét vào query string,
mỗi endpoint tự kiểm tra một chuỗi tĩnh dùng chung.

Đọc `n8n-contract.md` để biết webhook nào còn sống và hợp đồng dữ liệu ra sao.

## Quy tắc quan trọng

**Credit là tiền thật.** Mỗi lần reveal một người tốn một credit của SignalHire.
Quy trình bắt buộc:

1. App kiểm `category_credit_status.remaining` trước khi làm gì.
2. App ghi dòng `credit_ledger` trạng thái `reserved`.
3. App gọi thẳng SignalHire để reveal (`revealUids` trong `lib/signalhire.ts`),
   trong cùng request — không còn callback nào để đợi.
4. Có kết quả ngay tại đó, app chuyển dòng đó sang `committed`, hoặc `released`
   nếu SignalHire trả lỗi (`app/api/reveal/route.ts`).

Không được để phần gọi SignalHire tự quyết tiêu hay không — bước 1–2 (kiểm và
giữ chỗ credit) luôn phải xong trước khi bước 3 chạy.

**Không phải reveal nào cũng tốn tiền.** SignalHire chỉ tính tiền kết quả CÓ
email hoặc phone; người về tay không thì không bị tính, và `commitCredit()` hạ
số phải chốt xuống đúng phần `billable` rồi trả lại phần còn lại. Số thật tính
từ `measure_since` (08/09/2026): 927 contact tốn-credit thu về, trong đó 548 có
liên hệ và 379 về rỗng — và `credit_ledger` chốt 504 credit, khớp với 548 chứ
không khớp với 927.

Đừng xây chỉ số nào trên giả định "mỗi dòng contact = một credit". Một tile tên
"Wasted" trên `/admin` từng lấy `Spent − Gained` với Gained đếm cả 379 dòng
không hề bị tính tiền, nên nó đọc 977 (51%) trong khi con số thật là 0. Câu hỏi
"tiền bỏ ra có mua được gì không" đã có chỗ trả lời đúng rồi: **Full rate
(paid)**.

**`uids` của request là URL, `person.uid` của response là hex — đừng so hai cái
với nhau.** Khi PIC dán link LinkedIn, app gửi đi một URL nhưng SignalHire trả
về uid hex của người đó. Mọi phép `uids.includes(person.uid)` hay
`person.uid.startsWith('http')` vì thế luôn sai, và sai **im lặng**. Đã cắn đúng
hai lần, cùng một nguyên nhân:

- `source` bị ghi thành `signalhire` cho cả 125 contact vào bằng đường dán link;
  cột `pasted_linkedin` rỗng suốt từ đầu dù có 143 job dán link.
- `billable` ra 0 nên `commitCredit()` **trả lại toàn bộ credit** với ghi chú
  "nothing billable" trong khi SignalHire đã trừ tiền thật: 130 lần reveal dán
  link lưu về 125 contact mà sổ chỉ chốt 4 credit.

Cả hai đã vá (`app/api/reveal/route.ts`, dùng cờ `moiUidLaLink` dựng từ chính
`uids` của request). Dữ liệu cũ thì không dựng lại được.

Lỗ thứ ba cùng gốc — dán lại link người đã có vẫn bị tính tiền — cũng đã vá,
nhưng **không** bằng cách so uid: bộ lọc `uidsMoi` giờ so thêm **khóa LinkedIn
đã chuẩn hóa** (`khoaLinkedin()` trong `lib/contactIdentity.ts`), vì
`contact.linkedin_url` và đường link PIC dán cùng trỏ về một profile. Đo trên dữ
liệu thật: 98/107 đường link đã dán tìm ra đúng contact của nó. Khớp nhầm người
khác thì không xảy ra được vì slug LinkedIn là duy nhất, nên phần trượt chỉ rơi
về đúng hành vi cũ (tính tiền), không sinh hỏng mới.

Khi chuẩn hóa URL LinkedIn phải **giải mã %XX và `normalize('NFC')` trước**:
trình duyệt copy link profile Việt Nam ra dạng đã mã hóa
(`b%E1%BA%A3o-tr%C3%A2m`) còn SignalHire trả về dạng chữ thật — không giải mã
thì hai dạng của cùng một người thành hai người.

**`credit_ledger` mới là sổ chi của app, không phải số dư SignalHire.** Số dư
là của CẢ TÀI KHOẢN: credit hết hạn, đổi gói, đổi API key, hay ai đó reveal
thẳng trên web signalhire.com đều làm nó tụt y hệt lúc app tiêu tiền. Đã dính
thật: 01/10/2026 số dư rơi 1458 → 5 trong 7 tiếng rưỡi mà `credit_ledger` và
bảng `job` đều không có một dòng nào trong đúng khoảng đó. Chỗ nào cần "app đã
tiêu bao nhiêu" thì cộng `amount` của các dòng `committed`; số dư chỉ dùng để
hiện "còn lại bao nhiêu" và để đối chiếu.

**Contact từ seed không tốn credit.** Có một bộ dữ liệu đã xác minh thủ công
(`source = 'seed_verified'`), có thể còn sống trong workflow n8n gốc hoặc đã
import thẳng vào Postgres — kiểm bằng cách đếm `contact` theo `source` trước
khi giả định. Nó không gọi API, nên `amount = 0`, không tạo dòng ledger nào.

**Brand chưa có category thì chỉ admin thấy.** Cố ý fail-closed: brand không
category không tính vào hạn mức nào, nên nếu để mọi người thấy thì đó là đường
né credit. Admin panel phải có chỗ hiện danh sách này để gán.

**Credit không cộng dồn.** Mỗi tháng một dòng `credit_budget` riêng. Hết tháng
là hết, phần chưa dùng không mang sang.

**Test có gọi SignalHire thì phải ghi vào đồng hồ.** Trần ngày 300 brand và
6000 profile do SignalHire đếm ở phía họ, `search_usage` chỉ là bản sao bên
mình. Chạy thử một lần scan rồi xoá dòng test đi là làm hai con số lệch nhau,
và hôm nào chạy sát trần sẽ bị khoá 24h mà nhìn màn hình vẫn thấy còn dư.

Xoá dữ liệu test thì vẫn phải để lại một dòng `search_usage` cộng đúng số brand
và profile đã tiêu, `job_id` để null. Nếu dòng đó mang `occurred_at` trong quá
khứ thì phải chỉnh luôn `quota_config.period_started_at` về thời điểm đó, vì
trigger `search_usage_trip` chốt mốc kỳ bằng `now()`, và mọi dòng nằm trước mốc
sẽ không được đếm.

## Ranh giới truy cập database sống (service role key)

`SUPABASE_SERVICE_ROLE_KEY` trong `.env.local` bỏ qua MỌI RLS policy. Dùng nó
để đọc là an toàn; dùng nó để ghi là nguy hiểm, vì không có policy nào chặn
lại nữa.

- **Đọc để kiểm tra (introspection) được khuyến khích, không phải chỉ cho
  phép.** Enum, kiểu cột và nullability, chữ ký hàm, RLS policy, đếm dòng, xem
  mẫu dữ liệu — xác minh luôn tốt hơn giả định. Một giả định sai về hình dạng
  dữ liệu trả về đã làm sập production một lần trong tuần này: `my_quota()`
  trả `ky_bat_dau` kiểu `timestamptz` trong khi điều kiện kiểm hình dạng của
  `/api/scan` lại đòi đúng dạng `YYYY-MM-DD`, khiến mọi lần scan trả về 503.
- **Ghi vào database sống KHÔNG được phép, không có ngoại lệ:** không
  `insert`/`update`/`delete`, không DDL, không `create or replace function`,
  không `cron.schedule`. Thay đổi schema đi vào một file `.sql` ở gốc repo,
  tên rõ ràng, [user] tự chạy tay qua SQL Editor — đúng quy ước
  `can_use_category.sql` và `fix_alias_priority.sql` đã đặt.
- Không bao giờ in, echo, log, hay ghi credential vào file, commit, hay câu
  trả lời — kể cả một phần giá trị.
- Không để lại response body đã dump trên đĩa. Đọc xong, dùng xong, xoá ngay
  (giữ trong biến bộ nhớ của lệnh, không `Out-File`/ghi file trung gian nếu
  tránh được).
- `schema.sql` đã cũ và thiếu ít nhất 13 bảng/view đang sống (ví dụ
  `search_usage`, `quota_config`, `app_setting`, `brand_progress`,
  `category_health`, `scan_candidate`, `reminder`, `reminder_rule` — xem
  `can_use_category.sql`). Ưu tiên đọc trực tiếp từ database hơn là tin file
  này.

## Chuẩn kỹ thuật

- Next.js App Router, TypeScript, Server Components mặc định
- Supabase JS client. Thao tác cần vượt RLS (ghi ledger, đọc `app_setting`,
  gọi SignalHire) dùng service role và **chỉ chạy ở server**
- Tailwind. Không thêm component library nếu chưa thật cần
- Ghi Postgres bằng SQL/RPC, không ORM
- **Đọc cả bảng thì phải phân trang.** PostgREST cắt mọi truy vấn không kèm
  `Range` ở `max-rows` của server — Supabase mặc định 1000 — và **không báo
  lỗi**: `data` về đủ 1000 dòng, `error` là `null`, mọi phép đếm phía sau âm
  thầm thiếu phần còn lại. Đã kiểm trực tiếp: `scan_candidate` có 18.514 dòng,
  một `.select('id')` trần trả về đúng 1000. Dùng `docTatCa()` trong
  `lib/pageAll.ts` cho mọi lần đọc mà số dòng không có trần biết trước. Bảng
  `contact` đang ở 993 dòng — bẫy này đang nằm sát mép

## Đếm contact: dòng khác người

Bảng `contact` là (người × brand), không phải (người). Một người ở công ty mẹ
thường là đầu mối của nhiều brand con, nên **nhiều dòng cho cùng một người là
đúng và không được xoá** — xoá là cắt mất đường liên hệ của cả một brand. Thực
tế: 993 dòng = 979 người, 14 cặp trùng thì 13 cặp là kiểu này (Tan Phu
Plastic/Inochi, Xuong Giang Paper/Posy, Fani/TopGia, Sunlight/Vim…).

Cách xử lý đã chọn là **đếm cho đúng, không phải xoá**: `/admin` hiện cả
"Leads" (số dòng) lẫn "People" (số người). Định nghĩa "cùng một người" nằm duy
nhất ở `lib/contactIdentity.ts` — gộp theo thành phần liên thông trên uid +
LinkedIn + email, **không bao giờ theo số điện thoại** (tổng đài dùng chung)
hay **theo tên** (tên Việt trùng rất nhiều). Xem `dedup_contact.sql` để ra soát
lại và cho hai cặp còn mập mờ.

## Nhận diện thương hiệu

Đã cố định, đừng tự đổi:

- Font hiển thị: **Anton** (viết hoa, dùng cho tiêu đề)
- Font nội dung: **Aptos**, fallback Inter
- Đỏ `#D43A38` / `#99302D` · Teal `#0093A3` / `#0C3D47`
- Gradient teal `#0093A3 → #103A52`, đỏ `#E8443A → #7E1F26`, đều 135°
- **Chỉ light mode.** Không làm dark mode.

## Ngôn ngữ

Người dùng là người Việt. Giao diện tiếng Anh (team quen dùng vậy), nhưng
thông báo lỗi phải viết bằng lời người thường, giải thích chuyện gì xảy ra và
làm gì tiếp theo. Tên brand và chức danh thường có dấu tiếng Việt — chuẩn hoá
khi so khớp, giữ nguyên khi hiển thị.

Có một cái bẫy đã cắn một lần: SignalHire lưu quốc gia là `"Viet Nam"` chứ
không phải `"Vietnam"`. Các nước khác chưa kiểm tra hết.

## Việc không được làm

- Đừng đụng vào workflow pipeline n8n trừ khi hợp đồng webhook thay đổi
- Đừng đọc Google Sheets để ra quyết định. Nó là mirror, Postgres mới là nguồn
- Đừng thêm cơ chế PIN/OTP. Supabase Auth đã lo phần danh tính
- **Mọi lần gọi SignalHire (search, reveal, credit balance) đi qua
  `goiSignalHire()` trong `lib/signalhire.ts`, không tự thêm một `fetch()`
  rời rạc ở nơi khác.** Đó là nơi DUY NHẤT chặn giới hạn 3 request đồng thời
  của tài khoản — thêm một đường gọi song song sẽ vô tình cộng dồn vượt giới
  hạn thật dù mỗi hàm tưởng mình đang nằm trong hạn mức riêng.
- **Đừng gửi `department` cho SignalHire.** Nhãn trong `DEPARTMENTS` của
  `SearchForm.tsx` là nhãn tự đặt của app ("E-commerce and digital", "Export
  and international"), không phải danh mục của họ. Một giá trị ngoài danh mục
  là họ từ chối **cả request** với `422 Department is not recognized`, và lần
  gọi đó là lần duy nhất mang `location` — nên bộ lọc địa điểm chết theo,
  `timMotCongTy()` lùi về kết quả khám phá không lọc gì, và PIC chọn "Vietnam
  only" nhận về 100 người đầu của chỉ mục toàn cầu. Đã hỏng lặng lẽ nhiều ngày
  trên mọi công ty lớn (đọc `job.error`: L'Oreal Paris, indomie, Nutifood,
  Heineken, Suntory Pepsico, Vinasoy, Dutch Lady, Lof, Omo…). Function giờ chỉ
  là đầu vào xếp hạng. Muốn nó lọc lại thì phải có danh mục thật của SignalHire
  trước và ánh xạ nhãn app sang danh mục đó — đừng đoán.
- Chỉ gửi cho SignalHire tham số đã kiểm bằng lần gọi thật. Một tham số sai
  không hỏng một mình nó, nó hỏng cả lần gọi và kéo theo mọi bộ lọc đi cùng

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
