# Tổng quan Business - Dự án Quản lý Phòng Trọ

## 1. Mục tiêu dự án

Xây dựng hệ thống phần mềm giúp chủ nhà và nhân viên vận hành quản lý toàn diện khu trọ.  
**Mục tiêu MVP:** Chủ nhà có thể hoàn tất toàn bộ chu trình quản lý (từ tạo hợp đồng, quản lý cư dân & CCCD, chốt số điện nước, tự động tính hóa đơn đến thu tiền) hoàn toàn trên phần mềm mà không phụ thuộc vào Excel/Spreadsheet.

---

## 2. Phương pháp phát triển

- **Tracer Bullet:** Triển khai các tính năng theo chiều dọc (từ Cơ sở dữ liệu -> Backend API -> Giao diện UI) thành một luồng hoàn chỉnh. Lát cắt đầu tiên (Slice 1) sẽ chứng minh toàn bộ vòng đời quản lý phòng: _Thêm cư dân -> Nhập chỉ số điện nước -> Tự động tính hóa đơn -> Thu tiền_.
- **Workflow:** Áp dụng quy trình kiểm soát chặt chẽ cho các mảng quan trọng (quản lý tài chính, lưu trữ thông tin/ảnh CCCD của người thuê và phân quyền nhân viên) để đảm bảo an toàn và chính xác.

---

## 3. Các phân hệ nghiệp vụ chính (Business Areas)

### 3.1. Nền tảng (Foundations)

- **Mô hình dữ liệu:** Thiết kế chặt chẽ hỗ trợ mối quan hệ **1 Phòng – Nhiều Cư dân**, gán vai trò đại diện (**KEY**), lưu trữ lịch sử hợp đồng, chỉ số điện/nước và nhật ký hóa đơn qua các tháng.
- **Hệ thống thiết kế (Design System):** Giao diện thân thiện, tối ưu thao tác nhập liệu nhanh số điện/nước và xem/tải lên hình ảnh CCCD trên cả Web và Mobile.

### 3.2. Vận hành thuê phòng (Rental Operations)

#### A. Quản lý Phòng & Cư dân (Tenant Management)

- **Danh mục phòng:** Theo dõi trạng thái phòng theo thời gian thực (Trống, Đang thuê, Bảo trì).
- **Quản lý cư dân:**
  - Mô hình: **1 phòng chứa nhiều người**, trong đó bắt buộc chọn **1 người làm KEY (Đại diện phòng)** để chịu trách nhiệm pháp lý và liên lạc chính.
  - Thông tin định danh lưu trữ cho mỗi cư dân:
    - Họ và tên
    - Giới tính
    - Năm sinh
    - Số điện thoại
    - Địa chỉ thường trú
    - Hình ảnh 2 mặt CCCD (Mặt trước & Mặt sau)

#### B. Hợp đồng & Tiền cọc

- Quản lý vòng đời hợp đồng (Tạo mới, Gia hạn, Thanh lý).
- Gắn người đại diện (**KEY**) vào hợp đồng và ghi nhận tiền cọc.

#### C. Quản lý Chỉ số & Đơn giá (Utilities & Pricing)

- **Cấu hình đơn giá:** Thiết lập đơn giá Điện (đ/kWh - ví dụ: 3,500đ) và Nước (đ/m³ - ví dụ: 17,000đ).
- **Chốt chỉ số hàng tháng:**
  - Nhập **Chỉ số cũ** và **Chỉ số mới** cho Điện và Nước.
  - Tự động tính **Lượng tiêu thụ**:
    $$\text{Lượng tiêu thụ} = \text{Chỉ số mới} - \text{Chỉ số cũ}$$
  - Cảnh báo tự động nếu _Chỉ số mới < Chỉ số cũ_ hoặc lượng tiêu thụ tăng/giảm đột biến.

#### D. Hóa đơn & Thanh toán (Invoicing & Billing)

- **Tự động tính toán hóa đơn:**
  - $\text{Tiền điện} = \text{Lượng điện tiêu thụ} \times \text{Đơn giá điện}$ _(Ví dụ: $215 \times 3,500 = 752,500$đ)_
  - $\text{Tiền nước} = \text{Lượng nước tiêu thụ} \times \text{Đơn giá nước}$ _(Ví dụ: $3 \times 17,000 = 51,000$đ)_
  - $\text{Tổng hóa đơn} = \text{Tiền phòng} + \text{Tiền điện} + \text{Tiền nước} + \text{Dịch vụ khác}$ _(Ví dụ: $2,800,000 + 752,500 + 51,000 = 3,603,500$đ)_
- **Quản lý thanh toán:** Theo dõi trạng thái (Chưa thanh toán, Thanh toán 1 phần, Đã thanh toán), quản lý công nợ và lưu vết chỉnh sửa/hủy hóa đơn.

#### E. Phân quyền nhân viên

- Cấp quyền chi tiết cho nhân viên (ví dụ: Nhân viên chỉ được nhập chỉ số & ghi nhận thu tiền; Chủ nhà có quyền sửa đơn giá, tạo/xóa hợp đồng và xem báo cáo).

---

### 3.3. Giám sát vận hành (Oversight)

- **Bảng tổng quan (Dashboard):** Thống kê nhanh doanh thu, công nợ, danh sách phòng trống, danh sách người đại diện (**KEY**) từng phòng.
- **Nhắc việc tự động:** Cảnh báo tự động về hợp đồng sắp hết hạn, phòng chưa chốt số điện/nước, hóa đơn chưa thanh toán.
- **Quản lý sự cố:** Ghi nhận phản ánh hư hỏng từ phòng, giao việc sửa chữa và hạch toán chi phí phát sinh vào hóa đơn.
- **Nhật ký hệ thống (Audit Log):** Truy vết các thao tác quan trọng (sửa tiền, cập nhật chỉ số, xóa cư dân).

---

## 4. Các chức năng mở rộng (Deferred - Post MVP)

- Quản lý chuỗi nhiều khu trọ cho cùng một chủ nhà.
- Portal/App dành riêng cho người thuê (xem hóa đơn, upload CCCD, gửi yêu cầu sửa chữa).
- Thanh toán qua mã QR động (VietQR) và tự động đối soát tài khoản ngân hàng.
- Tự động gửi thông báo hóa đơn/nhắc nợ qua Zalo ZNS / SMS / Email cho người đại diện (**KEY**).
- Tự động quét và trích xuất thông tin từ ảnh CCCD (OCR).
