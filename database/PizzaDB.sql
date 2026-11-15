/* =====================================================
   CSDL PizzaDB - Hệ thống đặt và bán bánh Pizza tại bàn
   Chạy trên PostgreSQL (psql, pgAdmin hoặc: npm run init-db).
   Script sẽ XÓA và TẠO LẠI toàn bộ bảng trong CSDL đang kết nối.
   ===================================================== */
DROP TABLE IF EXISTS ThongBao, BaoCaoDoanhThu, HoaDon, ThanhToan, ChiTiet_ThanhPhanThem, ChiTietDonHang, DonHang,
  BanhPizza_ThanhPhan, GiaTheoKichThuoc, NuocUong, BanhPizza, MonAn, ThanhPhan, KichThuoc, VoBanh, BanAn, KhachHang, NhanVien CASCADE;

CREATE TABLE NhanVien (
    MaNV VARCHAR(10) NOT NULL,
    HoTen VARCHAR(100) NOT NULL,
    SoDienThoai VARCHAR(15) NULL,
    TenDangNhap VARCHAR(50) NOT NULL,
    MatKhau VARCHAR(255) NOT NULL,
    VaiTro VARCHAR(10) NOT NULL,
    KhuVucBep VARCHAR(50) NULL,
    MaQuay VARCHAR(10) NULL,
    CapQuanLy INT NULL,
    CONSTRAINT PK_NhanVien PRIMARY KEY (MaNV),
    CONSTRAINT UQ_NhanVien_TenDangNhap UNIQUE (TenDangNhap),
    CONSTRAINT CK_NhanVien_VaiTro CHECK (VaiTro IN ('BEP', 'THUNGAN', 'QUANLY'))
);

CREATE TABLE KhachHang (
    MaKH VARCHAR(10) NOT NULL,
    HoTen VARCHAR(100) NULL,
    SoDienThoai VARCHAR(15) NOT NULL,
    DiemTichLuy INT NOT NULL DEFAULT 0,
    CONSTRAINT PK_KhachHang PRIMARY KEY (MaKH),
    CONSTRAINT UQ_KhachHang_SoDienThoai UNIQUE (SoDienThoai),
    CONSTRAINT CK_KhachHang_DiemTichLuy CHECK (DiemTichLuy >= 0)
);

CREATE TABLE BanAn (
    MaBan VARCHAR(10) NOT NULL,
    SoBan INT NOT NULL,
    TrangThai VARCHAR(20) NOT NULL DEFAULT 'Trống',
    CONSTRAINT PK_BanAn PRIMARY KEY (MaBan),
    CONSTRAINT UQ_BanAn_SoBan UNIQUE (SoBan),
    CONSTRAINT CK_BanAn_TrangThai CHECK (TrangThai IN ('Trống', 'Đang phục vụ'))
);

CREATE TABLE VoBanh (
    MaVo VARCHAR(10) NOT NULL,
    TenVo VARCHAR(50) NOT NULL,
    PhuThu NUMERIC(12,0) NOT NULL DEFAULT 0,
    CONSTRAINT PK_VoBanh PRIMARY KEY (MaVo),
    CONSTRAINT UQ_VoBanh_TenVo UNIQUE (TenVo),
    CONSTRAINT CK_VoBanh_PhuThu CHECK (PhuThu >= 0)
);

CREATE TABLE KichThuoc (
    MaKT VARCHAR(10) NOT NULL,
    TenKT VARCHAR(20) NOT NULL,
    CONSTRAINT PK_KichThuoc PRIMARY KEY (MaKT),
    CONSTRAINT UQ_KichThuoc_TenKT UNIQUE (TenKT)
);

CREATE TABLE ThanhPhan (
    MaTP VARCHAR(10) NOT NULL,
    TenTP VARCHAR(100) NOT NULL,
    GiaThem NUMERIC(12,0) NOT NULL DEFAULT 0,
    SoLuongTon INT NOT NULL DEFAULT 0,
    CONSTRAINT PK_ThanhPhan PRIMARY KEY (MaTP),
    CONSTRAINT UQ_ThanhPhan_TenTP UNIQUE (TenTP),
    CONSTRAINT CK_ThanhPhan_GiaThem CHECK (GiaThem >= 0),
    CONSTRAINT CK_ThanhPhan_SoLuongTon CHECK (SoLuongTon >= 0)
);

CREATE TABLE MonAn (
    MaMon VARCHAR(10) NOT NULL,
    TenMon VARCHAR(100) NOT NULL,
    LoaiMon VARCHAR(10) NOT NULL,
    MoTa VARCHAR(500) NULL,
    HinhAnh VARCHAR(255) NULL,
    DangBan SMALLINT NOT NULL DEFAULT 1,
    CONSTRAINT PK_MonAn PRIMARY KEY (MaMon),
    CONSTRAINT UQ_MonAn_TenMon UNIQUE (TenMon),
    CONSTRAINT CK_MonAn_LoaiMon CHECK (LoaiMon IN ('PIZZA', 'NUOC')),
    CONSTRAINT CK_MonAn_DangBan CHECK (DangBan IN (0, 1))
);

CREATE TABLE BanhPizza (
    MaMon VARCHAR(10) NOT NULL,
    LoaiBanh VARCHAR(20) NOT NULL,
    CONSTRAINT PK_BanhPizza PRIMARY KEY (MaMon),
    CONSTRAINT FK_BanhPizza_MaMon FOREIGN KEY (MaMon) REFERENCES MonAn(MaMon) ON DELETE CASCADE,
    CONSTRAINT CK_BanhPizza_LoaiBanh CHECK (LoaiBanh IN ('Làm sẵn', 'Tự làm'))
);

CREATE TABLE NuocUong (
    MaMon VARCHAR(10) NOT NULL,
    DonGia NUMERIC(12,0) NOT NULL,
    DungTich INT NULL,
    CONSTRAINT PK_NuocUong PRIMARY KEY (MaMon),
    CONSTRAINT FK_NuocUong_MaMon FOREIGN KEY (MaMon) REFERENCES MonAn(MaMon) ON DELETE CASCADE,
    CONSTRAINT CK_NuocUong_DonGia CHECK (DonGia > 0)
);

CREATE TABLE GiaTheoKichThuoc (
    MaMon VARCHAR(10) NOT NULL,
    MaKT VARCHAR(10) NOT NULL,
    NgayApDung DATE NOT NULL,
    GiaBan NUMERIC(12,0) NOT NULL,
    CONSTRAINT PK_GiaTheoKichThuoc PRIMARY KEY (MaMon, MaKT, NgayApDung),
    CONSTRAINT FK_GiaTheoKichThuoc_MaMon FOREIGN KEY (MaMon) REFERENCES BanhPizza(MaMon) ON DELETE CASCADE,
    CONSTRAINT FK_GiaTheoKichThuoc_MaKT FOREIGN KEY (MaKT) REFERENCES KichThuoc(MaKT),
    CONSTRAINT CK_GiaTheoKichThuoc_GiaBan CHECK (GiaBan > 0)
);

CREATE TABLE BanhPizza_ThanhPhan (
    MaMon VARCHAR(10) NOT NULL,
    MaTP VARCHAR(10) NOT NULL,
    CONSTRAINT PK_BanhPizza_ThanhPhan PRIMARY KEY (MaMon, MaTP),
    CONSTRAINT FK_BanhPizza_ThanhPhan_MaMon FOREIGN KEY (MaMon) REFERENCES BanhPizza(MaMon) ON DELETE CASCADE,
    CONSTRAINT FK_BanhPizza_ThanhPhan_MaTP FOREIGN KEY (MaTP) REFERENCES ThanhPhan(MaTP)
);

CREATE TABLE DonHang (
    MaDon VARCHAR(12) NOT NULL,
    MaBan VARCHAR(10) NOT NULL,
    MaKH VARCHAR(10) NULL,
    MaNVBep VARCHAR(10) NULL,
    ThoiGianDat TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh'),
    TrangThai VARCHAR(25) NOT NULL DEFAULT 'CHO_CHE_BIEN',
    TamTinh NUMERIC(14,0) NOT NULL DEFAULT 0,
    ThueVAT NUMERIC(14,0) NOT NULL DEFAULT 0,
    TongTien NUMERIC(14,0) NOT NULL DEFAULT 0,
    CONSTRAINT PK_DonHang PRIMARY KEY (MaDon),
    CONSTRAINT FK_DonHang_MaBan FOREIGN KEY (MaBan) REFERENCES BanAn(MaBan),
    CONSTRAINT FK_DonHang_MaKH FOREIGN KEY (MaKH) REFERENCES KhachHang(MaKH),
    CONSTRAINT FK_DonHang_MaNVBep FOREIGN KEY (MaNVBep) REFERENCES NhanVien(MaNV),
    CONSTRAINT CK_DonHang_TrangThai CHECK (TrangThai IN ('CHO_CHE_BIEN', 'CHUAN_BI_NGUYEN_LIEU', 'DANG_NUONG', 'HOAN_THANH', 'DA_PHUC_VU', 'DA_THANH_TOAN', 'DA_HUY'))
);

CREATE TABLE ChiTietDonHang (
    MaCT INT GENERATED BY DEFAULT AS IDENTITY,
    MaDon VARCHAR(12) NOT NULL,
    MaMon VARCHAR(10) NOT NULL,
    MaVo VARCHAR(10) NULL,
    MaKT VARCHAR(10) NULL,
    SoLuong INT NOT NULL,
    DonGia NUMERIC(12,0) NOT NULL,
    ThanhTien NUMERIC(14,0) GENERATED ALWAYS AS (SoLuong * DonGia) STORED,
    TrangThaiCheBien VARCHAR(25) NOT NULL DEFAULT 'CHO_CHE_BIEN',
    GhiChu VARCHAR(200) NULL,
    CONSTRAINT PK_ChiTietDonHang PRIMARY KEY (MaCT),
    CONSTRAINT FK_ChiTietDonHang_MaDon FOREIGN KEY (MaDon) REFERENCES DonHang(MaDon) ON DELETE CASCADE,
    CONSTRAINT FK_ChiTietDonHang_MaMon FOREIGN KEY (MaMon) REFERENCES MonAn(MaMon),
    CONSTRAINT FK_ChiTietDonHang_MaVo FOREIGN KEY (MaVo) REFERENCES VoBanh(MaVo),
    CONSTRAINT FK_ChiTietDonHang_MaKT FOREIGN KEY (MaKT) REFERENCES KichThuoc(MaKT),
    CONSTRAINT CK_ChiTietDonHang_SoLuong CHECK (SoLuong BETWEEN 1 AND 20),
    CONSTRAINT CK_ChiTietDonHang_DonGia CHECK (DonGia >= 0),
    CONSTRAINT CK_ChiTietDonHang_TrangThaiCheBien CHECK (TrangThaiCheBien IN ('CHO_CHE_BIEN', 'CHUAN_BI_NGUYEN_LIEU', 'DANG_NUONG', 'HOAN_THANH', 'DA_PHUC_VU', 'DA_THANH_TOAN', 'DA_HUY'))
);

CREATE TABLE ChiTiet_ThanhPhanThem (
    MaCT INT NOT NULL,
    MaTP VARCHAR(10) NOT NULL,
    GiaThem NUMERIC(12,0) NOT NULL,
    CONSTRAINT PK_ChiTiet_ThanhPhanThem PRIMARY KEY (MaCT, MaTP),
    CONSTRAINT FK_ChiTiet_ThanhPhanThem_MaCT FOREIGN KEY (MaCT) REFERENCES ChiTietDonHang(MaCT) ON DELETE CASCADE,
    CONSTRAINT FK_ChiTiet_ThanhPhanThem_MaTP FOREIGN KEY (MaTP) REFERENCES ThanhPhan(MaTP),
    CONSTRAINT CK_ChiTiet_ThanhPhanThem_GiaThem CHECK (GiaThem >= 0)
);

CREATE TABLE ThanhToan (
    MaTT VARCHAR(12) NOT NULL,
    MaDon VARCHAR(12) NOT NULL,
    MaNVThuNgan VARCHAR(10) NULL,
    HinhThuc VARCHAR(10) NOT NULL,
    SoTien NUMERIC(14,0) NOT NULL,
    ThoiGian TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh'),
    TrangThai VARCHAR(20) NOT NULL,
    TienKhachDua NUMERIC(14,0) NULL,
    TienThoi NUMERIC(14,0) NULL,
    SoTheRutGon CHAR(4) NULL,
    MaGiaoDich VARCHAR(50) NULL,
    CONSTRAINT PK_ThanhToan PRIMARY KEY (MaTT),
    CONSTRAINT UQ_ThanhToan_MaDon UNIQUE (MaDon),
    CONSTRAINT FK_ThanhToan_MaDon FOREIGN KEY (MaDon) REFERENCES DonHang(MaDon),
    CONSTRAINT FK_ThanhToan_MaNVThuNgan FOREIGN KEY (MaNVThuNgan) REFERENCES NhanVien(MaNV),
    CONSTRAINT CK_ThanhToan_HinhThuc CHECK (HinhThuc IN ('TIEN_MAT', 'THE', 'SEPAY')),
    CONSTRAINT CK_ThanhToan_SoTien CHECK (SoTien > 0),
    CONSTRAINT CK_ThanhToan_TrangThai CHECK (TrangThai IN ('Đang xử lý', 'Thành công', 'Thất bại'))
);

CREATE TABLE HoaDon (
    MaHD VARCHAR(12) NOT NULL,
    MaTT VARCHAR(12) NOT NULL,
    NgayLap TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh'),
    ThueVAT NUMERIC(14,0) NOT NULL DEFAULT 0,
    TongTien NUMERIC(14,0) NOT NULL,
    HinhThucTT VARCHAR(10) NOT NULL,
    CONSTRAINT PK_HoaDon PRIMARY KEY (MaHD),
    CONSTRAINT UQ_HoaDon_MaTT UNIQUE (MaTT),
    CONSTRAINT FK_HoaDon_MaTT FOREIGN KEY (MaTT) REFERENCES ThanhToan(MaTT),
    CONSTRAINT CK_HoaDon_TongTien CHECK (TongTien > 0)
);

CREATE TABLE BaoCaoDoanhThu (
    MaBC INT GENERATED BY DEFAULT AS IDENTITY,
    MaNV VARCHAR(10) NOT NULL,
    NgayLap TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh'),
    TuNgay DATE NOT NULL,
    DenNgay DATE NOT NULL,
    HinhThucTT VARCHAR(10) NULL,
    TongDoanhThu NUMERIC(16,0) NOT NULL DEFAULT 0,
    SoDonHang INT NOT NULL DEFAULT 0,
    CONSTRAINT PK_BaoCaoDoanhThu PRIMARY KEY (MaBC),
    CONSTRAINT FK_BaoCaoDoanhThu_MaNV FOREIGN KEY (MaNV) REFERENCES NhanVien(MaNV),
    CONSTRAINT CK_BaoCaoDoanhThu_DenNgay CHECK (DenNgay >= TuNgay)
);

CREATE TABLE ThongBao (
    Id UUID PRIMARY KEY,
    Loai VARCHAR(50),
    NoiDung VARCHAR(500),
    SoBan INT NULL,
    ThoiGian TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

/* =====================================================
   DỮ LIỆU MẪU
   Mật khẩu lưu dạng băm SHA-256 (chuỗi hex in hoa).
   Tài khoản mẫu (mật khẩu đều là 123456):
     quanly  - Quản lý nhà hàng
     bep     - Nhân viên bếp
     thungan - Thu ngân
   ===================================================== */
INSERT INTO NhanVien (MaNV, HoTen, SoDienThoai, TenDangNhap, MatKhau, VaiTro, KhuVucBep, MaQuay, CapQuanLy) VALUES
('NV01', 'Nguyễn Văn An', '0901000001', 'quanly',  UPPER(encode(sha256('123456'::bytea), 'hex')), 'QUANLY',  NULL, NULL, 1),
('NV02', 'Trần Thị Bình', '0901000002', 'bep',     UPPER(encode(sha256('123456'::bytea), 'hex')), 'BEP',     'Lò nướng 1', NULL, NULL),
('NV03', 'Lê Minh Châu',  '0901000003', 'thungan', UPPER(encode(sha256('123456'::bytea), 'hex')), 'THUNGAN', NULL, 'Q01', NULL);

INSERT INTO KhachHang (MaKH, HoTen, SoDienThoai, DiemTichLuy) VALUES
('KH01', 'Phạm Thu Hà', '0912000001', 120),
('KH02', 'Võ Quốc Huy', '0912000002', 40);

INSERT INTO BanAn (MaBan, SoBan)
SELECT 'B' || LPAD(b::TEXT, 2, '0'), b FROM generate_series(1, 12) AS b;

INSERT INTO VoBanh (MaVo, TenVo, PhuThu) VALUES ('VO1', 'Giòn', 0), ('VO2', 'Dày', 10000);
INSERT INTO KichThuoc (MaKT, TenKT) VALUES ('S', 'Nhỏ'), ('M', 'Trung'), ('L', 'Lớn');
INSERT INTO ThanhPhan (MaTP, TenTP, GiaThem, SoLuongTon) VALUES
('TP01', 'Phô mai', 15000, 200),
('TP02', 'Xúc xích', 20000, 150),
('TP03', 'Nấm', 12000, 120),
('TP04', 'Hải sản', 35000, 0),      -- hết hàng: minh họa trạng thái "Tạm hết"
('TP05', 'Ô liu', 10000, 80),
('TP06', 'Sốt cà chua', 0, 500),
('TP07', 'Pepperoni', 25000, 100),
('TP08', 'Gà nướng BBQ', 30000, 90),
('TP09', 'Thơm (dứa)', 10000, 60),
('TP10', 'Ớt chuông', 8000, 70);

INSERT INTO MonAn (MaMon, TenMon, LoaiMon, MoTa, HinhAnh, DangBan) VALUES
('PZ01', 'Margherita cổ điển', 'PIZZA', 'Sốt cà chua, mozzarella tươi và lá húng quế', 'https://images.unsplash.com/photo-1762922425226-9411194abb68?auto=format&fit=crop&w=800&q=80', 1),
('PZ02', 'Pepperoni đặc biệt', 'PIZZA', 'Pepperoni hun khói, phô mai mozzarella', 'https://images.unsplash.com/photo-1682979041136-80601d43700d?auto=format&fit=crop&w=800&q=80', 1),
('PZ03', 'Pizza theo ý bạn', 'PIZZA', 'Tự chọn vỏ bánh, kích thước và thành phần thêm', 'https://images.unsplash.com/photo-1762922425256-621f056e1ebb?auto=format&fit=crop&w=800&q=80', 1),
('PZ04', 'Hải sản nhiệt đới', 'PIZZA', 'Tôm, mực, thơm và sốt kem tỏi', 'https://images.unsplash.com/photo-1682979041136-80601d43700d?auto=format&fit=crop&w=800&q=80', 1),
('PZ05', 'Gà BBQ nấm', 'PIZZA', 'Gà nướng BBQ, nấm, ớt chuông và phô mai', 'https://images.unsplash.com/photo-1762922425226-9411194abb68?auto=format&fit=crop&w=800&q=80', 1),
('PZ06', 'Rau củ nướng', 'PIZZA', 'Ớt chuông, nấm, ô liu và phô mai', 'https://images.unsplash.com/photo-1762922425256-621f056e1ebb?auto=format&fit=crop&w=800&q=80', 0),
('NU01', 'Coca-Cola', 'NUOC', 'Lon 330 ml, dùng kèm đá', NULL, 1),
('NU02', 'Nước chanh tươi', 'NUOC', 'Chanh tươi vắt, ít đường', NULL, 1),
('NU03', 'Trà đào cam sả', 'NUOC', 'Trà đào, cam vàng và sả tươi', NULL, 1),
('NU04', 'Pepsi', 'NUOC', 'Lon 330 ml, dùng kèm đá', NULL, 1),
('NU05', 'Nước suối', 'NUOC', 'Chai 500 ml', NULL, 1);

INSERT INTO BanhPizza (MaMon, LoaiBanh) VALUES
('PZ01', 'Làm sẵn'), ('PZ02', 'Làm sẵn'), ('PZ03', 'Tự làm'), ('PZ04', 'Làm sẵn'), ('PZ05', 'Làm sẵn'), ('PZ06', 'Làm sẵn');
INSERT INTO NuocUong (MaMon, DonGia, DungTich) VALUES
('NU01', 25000, 330), ('NU02', 30000, 400), ('NU03', 35000, 500), ('NU04', 25000, 330), ('NU05', 15000, 500);

-- Giá theo kích thước (lưu cả lịch sử giá qua cột NgayApDung)
INSERT INTO GiaTheoKichThuoc (MaMon, MaKT, NgayApDung, GiaBan) VALUES
('PZ01','S','2026-01-01', 85000), ('PZ01','M','2026-01-01', 115000), ('PZ01','L','2026-01-01', 150000),
('PZ01','S','2026-09-01', 90000), ('PZ01','M','2026-09-01', 120000), ('PZ01','L','2026-09-01', 155000),
('PZ02','S','2026-01-01', 125000), ('PZ02','M','2026-01-01', 155000), ('PZ02','L','2026-01-01', 189000),
('PZ03','S','2026-01-01', 85000), ('PZ03','M','2026-01-01', 110000), ('PZ03','L','2026-01-01', 145000),
('PZ04','S','2026-01-01', 149000), ('PZ04','M','2026-01-01', 179000), ('PZ04','L','2026-01-01', 219000),
('PZ05','S','2026-01-01', 119000), ('PZ05','M','2026-01-01', 149000), ('PZ05','L','2026-01-01', 185000),
('PZ06','S','2026-01-01', 95000), ('PZ06','M','2026-01-01', 125000), ('PZ06','L','2026-01-01', 159000);
-- Thành phần cố định của bánh làm sẵn; bánh tự làm luôn có nền sốt cà chua
INSERT INTO BanhPizza_ThanhPhan (MaMon, MaTP) VALUES
('PZ01','TP06'), ('PZ01','TP01'),
('PZ02','TP06'), ('PZ02','TP01'), ('PZ02','TP07'),
('PZ03','TP06'),
('PZ04','TP06'), ('PZ04','TP04'), ('PZ04','TP09'),
('PZ05','TP06'), ('PZ05','TP08'), ('PZ05','TP03'), ('PZ05','TP10'), ('PZ05','TP01'),
('PZ06','TP06'), ('PZ06','TP10'), ('PZ06','TP03'), ('PZ06','TP05'), ('PZ06','TP01');

/* Đơn hàng đã thanh toán trong 30 ngày gần nhất (dữ liệu cho báo cáo doanh thu) */
DO $$
DECLARE
  d INT; n INT; i INT; seq INT := 1;
  ma VARCHAR(12); tt VARCHAR(12); ban VARCHAR(10); t TIMESTAMP;
  tam NUMERIC(14,0); vat NUMERIC(14,0); tong NUMERIC(14,0); ht VARCHAR(10);
  mon VARCHAR(10); kt VARCHAR(10); gia NUMERIC(12,0); sl INT;
BEGIN
  FOR d IN REVERSE 30..1 LOOP
    n := 5 + floor(random() * 8)::INT;
    FOR i IN 1..n LOOP
      ma := 'DH' || LPAD(seq::TEXT, 6, '0');
      tt := 'TT' || LPAD(seq::TEXT, 6, '0');
      ban := 'B' || LPAD((1 + floor(random() * 12)::INT)::TEXT, 2, '0');
      t := (CAST(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh' AS DATE) - d) + make_interval(mins => 600 + floor(random() * 660)::INT);
      INSERT INTO DonHang (MaDon, MaBan, MaNVBep, ThoiGianDat, TrangThai) VALUES (ma, ban, 'NV02', t, 'DA_THANH_TOAN');

      SELECT MaMon INTO mon FROM BanhPizza WHERE MaMon <> 'PZ06' ORDER BY random() LIMIT 1;
      kt := (ARRAY['S', 'M', 'L'])[1 + floor(random() * 3)::INT];
      SELECT GiaBan INTO gia FROM GiaTheoKichThuoc WHERE MaMon = mon AND MaKT = kt AND NgayApDung <= t ORDER BY NgayApDung DESC LIMIT 1;
      sl := 1 + floor(random() * 2)::INT;
      INSERT INTO ChiTietDonHang (MaDon, MaMon, MaVo, MaKT, SoLuong, DonGia, TrangThaiCheBien) VALUES (ma, mon, 'VO1', kt, sl, gia, 'DA_PHUC_VU');

      SELECT MaMon, DonGia INTO mon, gia FROM NuocUong ORDER BY random() LIMIT 1;
      INSERT INTO ChiTietDonHang (MaDon, MaMon, SoLuong, DonGia, TrangThaiCheBien) VALUES (ma, mon, 1 + floor(random() * 3)::INT, gia, 'DA_PHUC_VU');

      SELECT SUM(ThanhTien) INTO tam FROM ChiTietDonHang WHERE MaDon = ma;
      vat := ROUND(tam * 0.08, 0);
      tong := tam + vat;
      UPDATE DonHang SET TamTinh = tam, ThueVAT = vat, TongTien = tong WHERE MaDon = ma;

      ht := CASE WHEN random() < 0.58 THEN 'TIEN_MAT' ELSE 'THE' END;
      INSERT INTO ThanhToan (MaTT, MaDon, MaNVThuNgan, HinhThuc, SoTien, ThoiGian, TrangThai, TienKhachDua, TienThoi, SoTheRutGon, MaGiaoDich)
      VALUES (tt, ma, 'NV03', ht, tong, t + INTERVAL '45 minutes', 'Thành công',
              CASE WHEN ht = 'TIEN_MAT' THEN CEIL(tong / 50000.0) * 50000 END,
              CASE WHEN ht = 'TIEN_MAT' THEN CEIL(tong / 50000.0) * 50000 - tong END,
              CASE WHEN ht = 'THE' THEN '4242' END,
              CASE WHEN ht = 'THE' THEN 'GD' || seq END);
      INSERT INTO HoaDon (MaHD, MaTT, NgayLap, ThueVAT, TongTien, HinhThucTT)
      VALUES ('HD' || LPAD(seq::TEXT, 6, '0'), tt, t + INTERVAL '45 minutes', vat, tong, ht);

      seq := seq + 1;
    END LOOP;
  END LOOP;
END $$;
