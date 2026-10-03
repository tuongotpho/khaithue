# Kê khai thuế quý (thay HTKK cho công ty nhỏ)

App làm 2 tờ khai quý: **01/GTGT** (kèm phụ lục giảm thuế 10% → 8%) và **05/KK-TNCN**, xuất file XML để nộp trên thuedientu.gdt.gov.vn.

## Tổng quan doanh nghiệp (tab 📊)

Nạp **toàn bộ hồ sơ thuế từ năm thành lập** (chọn cả thư mục): tờ khai XML mọi mẫu, chứng từ nộp tiền XML, hoá đơn XML, Excel “Danh sách hóa đơn”. App:

- lập sổ từng quý: tờ khai 01/GTGT (lần đầu / bổ sung / bị trả về / thiếu), TNCN, doanh thu, hoá đơn bán ra, phải nộp, đã nộp, đầu kỳ;
- thẻ số liệu theo năm + biểu đồ doanh thu / mua vào theo quý;
- **cảnh báo cần xử lý**: thiếu tờ khai quý đã quá hạn, nộp thiếu so với chứng từ, doanh thu tờ khai lệch tổng hoá đơn, đứt chuỗi đầu kỳ – cuối kỳ, hạn nộp sắp tới;
- lưu tờ khai loại khác (môn bài, quyết toán, BCTC...) để tra cứu.

Bấm **Kê khai** ở một quý để chuyển sang làm tờ khai quý đó.

## Lưu trên mây (Firebase)

Đăng nhập Google → hồ sơ (file gốc + số liệu) lưu vào Firebase project `app-from-ai`, database `khaithue`, bucket `khaithue`. Mỗi tài khoản chỉ thấy hồ sơ của mình (`firebase/*.rules`, kiểm bằng `npm run test:quyen`). Chưa đăng nhập thì chỉ lưu trên máy.

## Dùng hằng quý

Mở trang web (Vercel), hoặc nhấp đúp `KeKhaiThue.html` để dùng không cần mạng.

1. Kéo **tất cả** file vào một chỗ:
   - các **tờ khai XML đã nộp** → app tự điền thông tin công ty, [22], số liệu TNCN, lập sổ theo dõi các quý;
   - các file Excel **"DANH SÁCH HÓA ĐƠN"** của quý cần khai → app tự nhận hoá đơn nào bán ra, hoá đơn nào mua vào (kể cả file gộp, file kiểu cũ bỏ trống MST), tự chọn quý.
2. Xem cảnh báo ⚠️ / ⛔, xem số phải nộp, kiểm số liệu TNCN.
3. Bấm **Tải XML** → nộp trên cổng thuế: *Nộp tờ khai XML* → ký bằng USB token.
4. Có thông báo chấp nhận thì kéo file đã nộp vào lại để sổ theo dõi ghi nhận. Bị trả về thì tích “CQT trả về”.

Nhiều công ty: kéo XML của công ty khác vào là có thêm công ty, chọn ở bước 2. Thông tin công ty sửa tay được.

Dữ liệu chỉ xử lý và lưu trên trình duyệt của máy đang dùng. Trang web bị cấm gửi dữ liệu ra ngoài (`connect-src 'none'` trong `vercel.json`).

## Quy tắc tính (đã đối chiếu với tờ khai nộp thật)

- Bỏ hoá đơn **đã bị thay thế / huỷ**. Cùng một hoá đơn có trong nhiều file thì chỉ tính một lần.
- Hoá đơn có ngày lập **ngoài quý** mặc định không tính, nhưng có thể tích chọn để tính.
- [33] = 10% × [32] − tổng thuế được giảm ở phụ lục. Đây là cách HTKK tính, có thể lệch 1–2 đồng so với cộng thuế trên từng hoá đơn.
- Phụ lục mục II: gộp theo người mua, thuế được giảm = 2% giá trị, làm tròn theo từng người mua.
- Phụ lục mục I: chỉ kê hàng mua vào **chịu thuế 8%**. Hoá đơn lẫn 8% và 10% thì app tự tách và hiện cảnh báo.
- [40a] / [41] / [43] tính theo đúng công thức ghi trong đặc tả XSD của HTKK.

## Bảo vệ tự động

- **Đầu kỳ – cuối kỳ:** theo quy tắc cơ quan thuế, *“[22] phải = [43] trên TK lần đầu của kỳ liền kề trước”*. App lấy [22] từ bản **lần đầu**, không lấy bản bổ sung. Lệch thì app **khoá nút xuất file**. Quý trước có khai bổ sung thì app nhắc khai phần chênh ở [37]/[38].
- **Số hoá đơn bán ra:** hụt số giữa chừng thì app nhắc kiểm xem đã tải đủ file các tháng chưa.

## Dành cho người sửa mã

```
cd app
npm install
npm run dev        # chạy thử
npm test           # chạy test; đối chiếu số liệu thật chỉ chạy khi có du-lieu-rieng/doi-chieu.json
npm run kiem-xsd   # kiểm XML xuất ra theo XSD trong bộ cài HTKK (cần Python + lxml)
npm run test:quyen # luật phân quyền + đồng bộ mây trên máy giả lập Firebase (cần Java + firebase-tools)
npm run gia-lap    # bật máy giả lập; rồi `npm run dev:gia-lap` để chạy app nối vào đó
npm run dong-goi   # build + chép thành KeKhaiThue.html (bản dùng không cần mạng)
```

## Đưa lên mạng (GitHub + Vercel)

- Đẩy code lên GitHub thì GitHub Actions chạy test + build (`.github/workflows/kiem-tra.yml`).
- Vercel nối với repo thì **tự deploy mỗi lần push**. Cấu hình nằm sẵn trong `vercel.json`, không phải chỉnh gì trên Vercel. Test hỏng thì Vercel không đưa bản lỗi lên.
- `du-lieu-rieng/` (dữ liệu thật để đối chiếu) đã bị loại khỏi git trong `.gitignore`.

## Cấu trúc

- `app/src/core/`: phần tính toán, không phụ thuộc giao diện.
- `reference/htkk/`: XSD và mẫu XML chép từ bộ cài HTKK (bản 2.8.3 cho GTGT, 2.9.3 cho TNCN).
- Ca đối chiếu với tờ khai thật: `du-lieu-rieng/doi-chieu.json` (chỉ trên máy, không đưa lên git).
