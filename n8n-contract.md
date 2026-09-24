# Hợp đồng App ↔ n8n

## Xác thực

Bỏ hoàn toàn kiểu `?key=onpoint2026` trong URL. Mọi request từ app sang n8n gửi
header:

```
x-api-key: <N8N_SHARED_SECRET>
```

n8n callback ngược về app cũng gửi header tương tự với secret riêng. Hai secret
khác nhau, để lộ một cái không kéo theo cái kia.

Lý do đổi: chuỗi trong query string nằm lại trong log server, lịch sử trình
duyệt, và trong mọi link ai đó copy cho nhau.

## Workflow giữ lại

**`Lead - SignalHire v3 (BD confirm)`** — `ewPf0bQBxMkBuxzP`

Giữ nguyên phần lõi. Chỉ đổi hai đầu: đầu vào từ Form Trigger sang Webhook,
đầu ra từ form/redirect sang callback.

## Workflow bỏ

**`Org Chart Viewer`** — `VawmcV4Hn8cBnZPk`, 100 node.

Toàn bộ chuyển sang app. Trước khi xoá, kéo hết dữ liệu ra bằng
`migrate-from-n8n.mjs`.

---

## Endpoint

### `POST /webhook/lead-search`

App gọi khi BD bấm scan. n8n tìm ứng viên, **chưa reveal ai**, chưa tốn credit.

```jsonc
{
  "job_id": "uuid",                    // app sinh, n8n gửi lại nguyên văn
  "brands": [{ "name": "Chin-su", "tier": 1 }],
  "location": "Vietnam and Southeast Asia",
  "role": "Marketing and brand",
  "chase": "chin-su brand manager",    // rỗng nếu không dùng
  "linkedin_urls": []
}
```

Trả `202` ngay lập tức: `{ "accepted": true, "job_id": "..." }`

Callback về `POST {APP_URL}/api/webhooks/n8n`:

```jsonc
{
  "job_id": "uuid",
  "kind": "search",
  "status": "done",
  "brands": [{
    "brand": "Chin-su",
    "candidates": [{
      "uid": "...", "name": "...", "title": "...",
      "location": "...", "past": ["..."], "linkedin_search": "..."
    }],
    "data_source": "signalhire",       // hoặc seed_verified / pasted_linkedin
    "chase_employer": "Masan Consumer",
    "chase_sub_brand": "Chin-su",
    "note": "câu giải thích cho BD đọc"
  }]
}
```

`data_source = "seed_verified"` nghĩa là contact lấy từ bộ đã xác minh tay,
reveal về sau **không tốn credit**.

### `POST /webhook/lead-reveal`

App gọi **sau khi** đã kiểm hạn mức và ghi dòng ledger `reserved`.

```jsonc
{
  "job_id": "uuid",
  "brand": "Chin-su",
  "uids": ["...", "https://linkedin.com/in/..."]   // chấp nhận cả uid lẫn URL
}
```

Callback mang về contact đã có email/phone, kèm `credits_used` thực tế để app
đối soát với số đã reserve. Lệch thì app điều chỉnh dòng ledger và ghi log —
đừng im lặng bỏ qua, lệch là dấu hiệu có gì đó sai.

### `POST /webhook/lead-enrich`

Sinh bio + org chart bằng LLM. Không tốn credit SignalHire. Có thể gọi sau,
không chặn luồng chính.

### `POST /webhook/lead-outreach`

Soạn và gửi mail outreach. App quyết định brand nào đi nhánh tự động, brand nào
để người viết tay — n8n chỉ thực thi.

---

## Sửa gì trong workflow pipeline

1. **Thay `Upload Brand List (Form)`** bằng Webhook node. Các Code node đọc
   `$('Upload Brand List (Form)')` phải trỏ sang node mới. Có khoảng 6 chỗ:
   `Map Uploaded Columns`, `Resolve Chase Target`, `Shape Candidates`,
   hai node SignalHire search, và `Build Selection Form`.

2. **Bỏ `Build Selection Form` và `BD Selection Gate`.** Việc chọn người
   chuyển về app. n8n trả candidate, app hiển thị, app gửi lại uid đã chọn.

3. **Bỏ `Back To Portal`.** Không còn redirect.

4. **Thêm HTTP Request node cuối mỗi nhánh** để callback về app.

5. **Giữ `Update Tracking Database`** ghi Google Sheets. Nó thành mirror, không
   còn là nguồn dữ liệu.

6. **Giữ `On Failure` / `Send Failure Alert`.** Nhớ set `errorWorkflow` trong
   settings, nếu không nhánh này không bao giờ chạy.

---

## Chưa xác minh

`SignalHire - Reveal Contacts` gọi `candidate/search` với mảng `items` nhưng
không gửi `callbackUrl`. API này thường trả kết quả bất đồng bộ. Nếu đúng vậy
thì phải thêm callbackUrl và tách reveal thành hai bước. **Kiểm tra bằng một
lần reveal thật trước khi dựng lớp credit lên trên**, vì kiến trúc ledger phụ
thuộc vào việc biết chính xác lúc nào credit thực sự bị tiêu.
