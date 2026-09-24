# OnPoint Lead Desk

Công cụ nội bộ của team Business Development, OnPoint. Tìm và xác minh
decision-maker tại các brand, theo dõi tiến độ deal, lưu tài liệu theo brand.

Người dùng: ~5–10 người trong team BD. Không phải sản phẩm public.

## Kiến trúc

Hệ thống lai. App lo mọi thứ người dùng chạm vào; n8n lo mọi thứ chạy nền.

```
Người dùng ─▶ Next.js (Vercel) ─▶ Supabase (Postgres + Auth + Storage)
                    │
                    ├── webhook ──▶ n8n (self-host) ──▶ SignalHire
                    │                                └─▶ Google Sheets (mirror)
                    │                                └─▶ Gmail
                    ◀── callback ───┘
```

**Ranh giới, không được lấn:**

| App | n8n |
|---|---|
| Đăng nhập, phân quyền | Gọi SignalHire (search, reveal) |
| Toàn bộ giao diện | Sinh bio + org chart bằng LLM |
| Kiểm và trừ credit, soạn và mở sẵn mail outreach (deep link Outlook qua lib/template.ts) | — |
| Admin panel | Ghi mirror sang Google Sheets |
| Trạng thái job | Cron dọn dẹp, cảnh báo lỗi |

**n8n không phục vụ HTML.** Chỉ nhận JSON, trả JSON. Nếu thấy mình sắp viết
HTML trong n8n, dừng lại — chỗ đó thuộc về app.

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
3. App gọi n8n để reveal.
4. n8n callback về, app chuyển dòng đó sang `committed`, hoặc `released` nếu lỗi.

Không bao giờ để n8n tự quyết được tiêu hay không. Nó không thấy được tồn kho.

**Idempotency.** Mọi callback từ n8n mang theo `job_id`. Xử lý xong phải kiểm
job đã ở trạng thái `done` chưa trước khi ghi tiếp — n8n có retry, và ghi trùng
nghĩa là tiêu trùng credit.

**Contact từ seed không tốn credit.** Có một bộ dữ liệu đã xác minh thủ công
nằm trong workflow n8n (`source = 'seed_verified'`). Nó không gọi API, nên
`amount = 0`, không tạo dòng ledger nào.

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
- Supabase JS client. Thao tác cần vượt RLS (ghi ledger, xử callback n8n) dùng
  service role và **chỉ chạy ở server**
- Tailwind. Không thêm component library nếu chưa thật cần
- Ghi Postgres bằng SQL/RPC, không ORM

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
- Đừng gọi SignalHire trực tiếp từ app. Mọi thứ đi qua n8n
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
