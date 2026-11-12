# Pizza Self-Order – Hệ thống đặt và bán bánh Pizza tự động tại bàn ăn

Đồ án học phần Phân tích thiết kế hướng đối tượng (HK1 2026–2027).
Ứng dụng web gồm 3 phân hệ:

| Phân hệ | Người dùng | Đường dẫn |
|---|---|---|
| Màn hình cảm ứng tại bàn | Khách hàng | `#/ban/<số bàn>` (ví dụ `#/ban/5`) |
| Màn hình bếp | Nhân viên bếp | `#/bep` |
| Trang quản trị | Quản lý nhà hàng | `#/quan-ly/thuc-don`, `#/quan-ly/bao-cao` |

Giao diện được thiết kế trên Figma (Figma Make) và cài đặt lại bằng React.

## Công nghệ

- **Giao diện:** React 18 + TypeScript, Vite, Tailwind CSS 4 (thư mục `client/`)
- **Máy chủ API:** Node.js + Express (thư mục `server/`)
- **Cơ sở dữ liệu:** Microsoft SQL Server – CSDL `PizzaDB`, 17 bảng (thư mục `database/`)
- Kết nối CSDL bằng thư viện `mssql` (driver `msnodesqlv8`, ODBC Driver 18 for SQL Server)

## Cài đặt và chạy

Yêu cầu: Node.js ≥ 18, SQL Server 2019 trở lên, ODBC Driver 18 for SQL Server.

1. **Tạo CSDL:** mở `database/PizzaDB.sql` trong SSMS và chạy (F5), hoặc:
   ```bash
   sqlcmd -S localhost -E -C -I -f 65001 -i database/PizzaDB.sql
   ```
   Script tạo lại CSDL `PizzaDB` cùng dữ liệu mẫu (thực đơn, 12 bàn, tài khoản nhân viên, đơn hàng 30 ngày gần nhất cho báo cáo).

2. **Cài thư viện và build giao diện:**
   ```bash
   npm run setup
   ```

3. **Chạy máy chủ:**
   ```bash
   npm start
   ```
   Mở <http://localhost:3000>.

Mặc định máy chủ kết nối SQL Server cục bộ bằng Windows Authentication. Có thể đổi chuỗi kết nối bằng biến môi trường `DB_CONN`, ví dụ dùng tài khoản SQL:

```
DB_CONN=Driver={ODBC Driver 18 for SQL Server};Server=localhost;Database=PizzaDB;Uid=sa;Pwd=<mật khẩu>;TrustServerCertificate=yes;
```

Khi phát triển giao diện: chạy `npm start` (API, cổng 3000) và `npm run dev --prefix client` (Vite, cổng 5173, tự chuyển tiếp `/api`).

## Tài khoản mẫu

| Tên đăng nhập | Mật khẩu | Vai trò |
|---|---|---|
| `quanly` | `123456` | Quản lý nhà hàng (bếp, thực đơn, báo cáo) |
| `bep` | `123456` | Nhân viên bếp |

## Dữ liệu dùng để thử nghiệm

- Thành phần **Hải sản** có tồn kho bằng 0 → món *Hải sản nhiệt đới* và thành phần Hải sản hiển thị “Tạm hết”.
- Món *Rau củ nướng* đang ở trạng thái “Ngừng bán”.
- Nước uống chưa có ảnh → hiển thị ảnh mặc định.
- Thanh toán thẻ là **cổng thanh toán mô phỏng** (không lưu số thẻ, chỉ lưu 4 số cuối):
  - `4242 4242 4242 4242` – giao dịch thành công
  - `4000 0000 0000 0002` – thẻ bị từ chối (“Giao dịch thất bại”)
  - `4000 0000 0000 0119` – không kết nối được ngân hàng, giao dịch bị hủy

## Chức năng (10 Use Case)

1. Xem thực đơn bánh Pizza và nước uống (lọc theo nhóm, tìm kiếm không dấu)
2. Chọn loại bánh Pizza (làm sẵn / tự làm)
3. Tùy chỉnh đặc tính bánh (vỏ, kích thước, thành phần thêm, số lượng 1–10)
4. Đặt nước uống đi kèm (1–20 phần, gợi ý combo Pizza + Nước uống giảm 10.000 đ/phần)
5. Xác nhận đơn đặt bánh và tính tổng tiền (VAT 8%)
6. Theo dõi quy trình chế biến bánh (tự cập nhật mỗi 3 giây, gọi nhân viên)
7. Tiếp nhận đơn hàng và cập nhật trạng thái làm bánh (Kanban, âm báo đơn mới, báo không thể chế biến kèm lý do)
8. Thanh toán đơn hàng (tiền mặt / thẻ tín dụng, tính tiền thối, in hóa đơn)
9. Quản lý thực đơn và giá bán (thêm, sửa, ngừng bán, xóa; lưu lịch sử giá theo kích thước)
10. Xem báo cáo thống kê doanh thu (lọc theo thời gian và hình thức thanh toán, biểu đồ, xuất Excel/PDF)

## Cấu trúc thư mục

```
pizza-self-order/
├─ database/PizzaDB.sql     Script tạo CSDL + dữ liệu mẫu
├─ server/
│  ├─ index.js              Các API (khách hàng, bếp, quản lý)
│  ├─ services.js           Nghiệp vụ: thực đơn, tính giá, đơn hàng
│  └─ db.js                 Kết nối SQL Server
└─ client/src/
   ├─ customer.tsx          Màn hình tại bàn: thực đơn, tùy chỉnh, đơn hàng, theo dõi, thanh toán
   ├─ staff.tsx             Đăng nhập, màn hình bếp, quản lý thực đơn, báo cáo
   ├─ ui.tsx, api.ts, store.ts
   └─ index.css             Hệ thống thiết kế (từ Figma)
```
