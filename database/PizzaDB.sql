/* =====================================================
   CSDL PizzaDB - Hệ thống đặt và bán bánh Pizza tại bàn
   Chạy toàn bộ script trên SQL Server (SSMS hoặc sqlcmd).
   Script sẽ XÓA và TẠO LẠI CSDL PizzaDB.
   ===================================================== */
USE master;
GO
IF DB_ID('PizzaDB') IS NOT NULL
BEGIN
    ALTER DATABASE PizzaDB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE PizzaDB;
END
GO
CREATE DATABASE PizzaDB;
GO
USE PizzaDB;
GO
CREATE TABLE NhanVien (
    MaNV VARCHAR(10) NOT NULL,
    HoTen NVARCHAR(100) NOT NULL,
    SoDienThoai VARCHAR(15) NULL,
    TenDangNhap VARCHAR(50) NOT NULL,
    MatKhau VARCHAR(255) NOT NULL,
    VaiTro VARCHAR(10) NOT NULL,
    KhuVucBep NVARCHAR(50) NULL,
    MaQuay VARCHAR(10) NULL,
    CapQuanLy INT NULL,
    CONSTRAINT PK_NhanVien PRIMARY KEY (MaNV),
    CONSTRAINT UQ_NhanVien_TenDangNhap UNIQUE (TenDangNhap),
    CONSTRAINT CK_NhanVien_VaiTro CHECK (VaiTro IN ('BEP', 'THUNGAN', 'QUANLY'))
);
GO
CREATE TABLE KhachHang (
    MaKH VARCHAR(10) NOT NULL,
    HoTen NVARCHAR(100) NULL,
    SoDienThoai VARCHAR(15) NOT NULL,
    DiemTichLuy INT NOT NULL DEFAULT 0,
    CONSTRAINT PK_KhachHang PRIMARY KEY (MaKH),
    CONSTRAINT UQ_KhachHang_SoDienThoai UNIQUE (SoDienThoai),
    CONSTRAINT CK_KhachHang_DiemTichLuy CHECK (DiemTichLuy >= 0)
);
GO
CREATE TABLE BanAn (
    MaBan VARCHAR(10) NOT NULL,
    SoBan INT NOT NULL,
    TrangThai NVARCHAR(20) NOT NULL DEFAULT N'Trống',
    CONSTRAINT PK_BanAn PRIMARY KEY (MaBan),
    CONSTRAINT UQ_BanAn_SoBan UNIQUE (SoBan),
    CONSTRAINT CK_BanAn_TrangThai CHECK (TrangThai IN (N'Trống', N'Đang phục vụ'))
);
GO
CREATE TABLE VoBanh (
    MaVo VARCHAR(10) NOT NULL,
    TenVo NVARCHAR(50) NOT NULL,
    PhuThu DECIMAL(12,0) NOT NULL DEFAULT 0,
    CONSTRAINT PK_VoBanh PRIMARY KEY (MaVo),
    CONSTRAINT UQ_VoBanh_TenVo UNIQUE (TenVo),
    CONSTRAINT CK_VoBanh_PhuThu CHECK (PhuThu >= 0)
);
GO
CREATE TABLE KichThuoc (
    MaKT VARCHAR(10) NOT NULL,
    TenKT NVARCHAR(20) NOT NULL,
    CONSTRAINT PK_KichThuoc PRIMARY KEY (MaKT),
    CONSTRAINT UQ_KichThuoc_TenKT UNIQUE (TenKT)
);
GO
CREATE TABLE ThanhPhan (
    MaTP VARCHAR(10) NOT NULL,
    TenTP NVARCHAR(100) NOT NULL,
    GiaThem DECIMAL(12,0) NOT NULL DEFAULT 0,
    SoLuongTon INT NOT NULL DEFAULT 0,
    CONSTRAINT PK_ThanhPhan PRIMARY KEY (MaTP),
    CONSTRAINT UQ_ThanhPhan_TenTP UNIQUE (TenTP),
    CONSTRAINT CK_ThanhPhan_GiaThem CHECK (GiaThem >= 0),
    CONSTRAINT CK_ThanhPhan_SoLuongTon CHECK (SoLuongTon >= 0)
);
GO
CREATE TABLE MonAn (
    MaMon VARCHAR(10) NOT NULL,
    TenMon NVARCHAR(100) NOT NULL,
    LoaiMon VARCHAR(10) NOT NULL,
    MoTa NVARCHAR(500) NULL,
    HinhAnh VARCHAR(255) NULL,
    DangBan BIT NOT NULL DEFAULT 1,
    CONSTRAINT PK_MonAn PRIMARY KEY (MaMon),
    CONSTRAINT UQ_MonAn_TenMon UNIQUE (TenMon),
    CONSTRAINT CK_MonAn_LoaiMon CHECK (LoaiMon IN ('PIZZA', 'NUOC'))
);
GO
CREATE TABLE BanhPizza (
    MaMon VARCHAR(10) NOT NULL,
    LoaiBanh NVARCHAR(20) NOT NULL,
    CONSTRAINT PK_BanhPizza PRIMARY KEY (MaMon),
    CONSTRAINT FK_BanhPizza_MaMon FOREIGN KEY (MaMon) REFERENCES MonAn(MaMon) ON DELETE CASCADE,
    CONSTRAINT CK_BanhPizza_LoaiBanh CHECK (LoaiBanh IN (N'Làm sẵn', N'Tự làm'))
);
GO
CREATE TABLE NuocUong (
    MaMon VARCHAR(10) NOT NULL,
    DonGia DECIMAL(12,0) NOT NULL,
    DungTich INT NULL,
    CONSTRAINT PK_NuocUong PRIMARY KEY (MaMon),
    CONSTRAINT FK_NuocUong_MaMon FOREIGN KEY (MaMon) REFERENCES MonAn(MaMon) ON DELETE CASCADE,
    CONSTRAINT CK_NuocUong_DonGia CHECK (DonGia > 0)
);
GO
CREATE TABLE GiaTheoKichThuoc (
    MaMon VARCHAR(10) NOT NULL,
    MaKT VARCHAR(10) NOT NULL,
    NgayApDung DATE NOT NULL,
    GiaBan DECIMAL(12,0) NOT NULL,
    CONSTRAINT PK_GiaTheoKichThuoc PRIMARY KEY (MaMon, MaKT, NgayApDung),
    CONSTRAINT FK_GiaTheoKichThuoc_MaMon FOREIGN KEY (MaMon) REFERENCES BanhPizza(MaMon) ON DELETE CASCADE,
    CONSTRAINT FK_GiaTheoKichThuoc_MaKT FOREIGN KEY (MaKT) REFERENCES KichThuoc(MaKT),
    CONSTRAINT CK_GiaTheoKichThuoc_GiaBan CHECK (GiaBan > 0)
);
GO
CREATE TABLE BanhPizza_ThanhPhan (
    MaMon VARCHAR(10) NOT NULL,
    MaTP VARCHAR(10) NOT NULL,
    CONSTRAINT PK_BanhPizza_ThanhPhan PRIMARY KEY (MaMon, MaTP),
    CONSTRAINT FK_BanhPizza_ThanhPhan_MaMon FOREIGN KEY (MaMon) REFERENCES BanhPizza(MaMon) ON DELETE CASCADE,
    CONSTRAINT FK_BanhPizza_ThanhPhan_MaTP FOREIGN KEY (MaTP) REFERENCES ThanhPhan(MaTP)
);
GO
CREATE TABLE DonHang (
    MaDon VARCHAR(12) NOT NULL,
    MaBan VARCHAR(10) NOT NULL,
    MaKH VARCHAR(10) NULL,
    MaNVBep VARCHAR(10) NULL,
    ThoiGianDat DATETIME NOT NULL DEFAULT GETDATE(),
    TrangThai VARCHAR(25) NOT NULL DEFAULT 'CHO_CHE_BIEN',
    TamTinh DECIMAL(14,0) NOT NULL DEFAULT 0,
    ThueVAT DECIMAL(14,0) NOT NULL DEFAULT 0,
    TongTien DECIMAL(14,0) NOT NULL DEFAULT 0,
    CONSTRAINT PK_DonHang PRIMARY KEY (MaDon),
    CONSTRAINT FK_DonHang_MaBan FOREIGN KEY (MaBan) REFERENCES BanAn(MaBan),
    CONSTRAINT FK_DonHang_MaKH FOREIGN KEY (MaKH) REFERENCES KhachHang(MaKH),
    CONSTRAINT FK_DonHang_MaNVBep FOREIGN KEY (MaNVBep) REFERENCES NhanVien(MaNV),
    CONSTRAINT CK_DonHang_TrangThai CHECK (TrangThai IN ('CHO_CHE_BIEN', 'CHUAN_BI_NGUYEN_LIEU', 'DANG_NUONG', 'HOAN_THANH', 'DA_PHUC_VU', 'DA_THANH_TOAN', 'DA_HUY'))
);
GO
CREATE TABLE ChiTietDonHang (
    MaCT INT IDENTITY(1,1) NOT NULL,
    MaDon VARCHAR(12) NOT NULL,
    MaMon VARCHAR(10) NOT NULL,
    MaVo VARCHAR(10) NULL,
    MaKT VARCHAR(10) NULL,
    SoLuong INT NOT NULL,
    DonGia DECIMAL(12,0) NOT NULL,
    ThanhTien AS (CAST(SoLuong * DonGia AS DECIMAL(14,0))) PERSISTED,
    TrangThaiCheBien VARCHAR(25) NOT NULL DEFAULT 'CHO_CHE_BIEN',
    GhiChu NVARCHAR(200) NULL,
    CONSTRAINT PK_ChiTietDonHang PRIMARY KEY (MaCT),
    CONSTRAINT FK_ChiTietDonHang_MaDon FOREIGN KEY (MaDon) REFERENCES DonHang(MaDon) ON DELETE CASCADE,
    CONSTRAINT FK_ChiTietDonHang_MaMon FOREIGN KEY (MaMon) REFERENCES MonAn(MaMon),
    CONSTRAINT FK_ChiTietDonHang_MaVo FOREIGN KEY (MaVo) REFERENCES VoBanh(MaVo),
    CONSTRAINT FK_ChiTietDonHang_MaKT FOREIGN KEY (MaKT) REFERENCES KichThuoc(MaKT),
    CONSTRAINT CK_ChiTietDonHang_SoLuong CHECK (SoLuong BETWEEN 1 AND 20),
    CONSTRAINT CK_ChiTietDonHang_DonGia CHECK (DonGia >= 0),
    CONSTRAINT CK_ChiTietDonHang_TrangThaiCheBien CHECK (TrangThaiCheBien IN ('CHO_CHE_BIEN', 'CHUAN_BI_NGUYEN_LIEU', 'DANG_NUONG', 'HOAN_THANH', 'DA_PHUC_VU', 'DA_THANH_TOAN', 'DA_HUY'))
);
GO
CREATE TABLE ChiTiet_ThanhPhanThem (
    MaCT INT NOT NULL,
    MaTP VARCHAR(10) NOT NULL,
    GiaThem DECIMAL(12,0) NOT NULL,
    CONSTRAINT PK_ChiTiet_ThanhPhanThem PRIMARY KEY (MaCT, MaTP),
    CONSTRAINT FK_ChiTiet_ThanhPhanThem_MaCT FOREIGN KEY (MaCT) REFERENCES ChiTietDonHang(MaCT) ON DELETE CASCADE,
    CONSTRAINT FK_ChiTiet_ThanhPhanThem_MaTP FOREIGN KEY (MaTP) REFERENCES ThanhPhan(MaTP),
    CONSTRAINT CK_ChiTiet_ThanhPhanThem_GiaThem CHECK (GiaThem >= 0)
);
GO
CREATE TABLE ThanhToan (
    MaTT VARCHAR(12) NOT NULL,
    MaDon VARCHAR(12) NOT NULL,
    MaNVThuNgan VARCHAR(10) NULL,
    HinhThuc VARCHAR(10) NOT NULL,
    SoTien DECIMAL(14,0) NOT NULL,
    ThoiGian DATETIME NOT NULL DEFAULT GETDATE(),
    TrangThai NVARCHAR(20) NOT NULL,
    TienKhachDua DECIMAL(14,0) NULL,
    TienThoi DECIMAL(14,0) NULL,
    SoTheRutGon CHAR(4) NULL,
    MaGiaoDich VARCHAR(50) NULL,
    CONSTRAINT PK_ThanhToan PRIMARY KEY (MaTT),
    CONSTRAINT UQ_ThanhToan_MaDon UNIQUE (MaDon),
    CONSTRAINT FK_ThanhToan_MaDon FOREIGN KEY (MaDon) REFERENCES DonHang(MaDon),
    CONSTRAINT FK_ThanhToan_MaNVThuNgan FOREIGN KEY (MaNVThuNgan) REFERENCES NhanVien(MaNV),
    CONSTRAINT CK_ThanhToan_HinhThuc CHECK (HinhThuc IN ('TIEN_MAT', 'THE')),
    CONSTRAINT CK_ThanhToan_SoTien CHECK (SoTien > 0),
    CONSTRAINT CK_ThanhToan_TrangThai CHECK (TrangThai IN (N'Đang xử lý', N'Thành công', N'Thất bại'))
);
GO
CREATE TABLE HoaDon (
    MaHD VARCHAR(12) NOT NULL,
    MaTT VARCHAR(12) NOT NULL,
    NgayLap DATETIME NOT NULL DEFAULT GETDATE(),
    ThueVAT DECIMAL(14,0) NOT NULL DEFAULT 0,
    TongTien DECIMAL(14,0) NOT NULL,
    HinhThucTT VARCHAR(10) NOT NULL,
    CONSTRAINT PK_HoaDon PRIMARY KEY (MaHD),
    CONSTRAINT UQ_HoaDon_MaTT UNIQUE (MaTT),
    CONSTRAINT FK_HoaDon_MaTT FOREIGN KEY (MaTT) REFERENCES ThanhToan(MaTT),
    CONSTRAINT CK_HoaDon_TongTien CHECK (TongTien >= 0)
);
GO
CREATE TABLE BaoCaoDoanhThu (
    MaBC INT IDENTITY(1,1) NOT NULL,
    MaNV VARCHAR(10) NOT NULL,
    NgayLap DATETIME NOT NULL DEFAULT GETDATE(),
    TuNgay DATE NOT NULL,
    DenNgay DATE NOT NULL,
    HinhThucTT VARCHAR(10) NULL,
    TongDoanhThu DECIMAL(16,0) NOT NULL DEFAULT 0,
    SoDonHang INT NOT NULL DEFAULT 0,
    CONSTRAINT PK_BaoCaoDoanhThu PRIMARY KEY (MaBC),
    CONSTRAINT FK_BaoCaoDoanhThu_MaNV FOREIGN KEY (MaNV) REFERENCES NhanVien(MaNV),
    CONSTRAINT CK_BaoCaoDoanhThu_DenNgay CHECK (DenNgay >= TuNgay)
);
GO

/* =====================================================
   DỮ LIỆU MẪU
   Mật khẩu lưu dạng băm SHA-256 (chuỗi hex).
   Tài khoản mẫu (mật khẩu đều là 123456):
     quanly  - Quản lý nhà hàng
     bep     - Nhân viên bếp
     thungan - Thu ngân
   ===================================================== */
INSERT INTO NhanVien (MaNV, HoTen, SoDienThoai, TenDangNhap, MatKhau, VaiTro, KhuVucBep, MaQuay, CapQuanLy) VALUES
('NV01', N'Nguyễn Văn An', '0901000001', 'quanly',  CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', '123456'), 2), 'QUANLY',  NULL, NULL, 1),
('NV02', N'Trần Thị Bình', '0901000002', 'bep',     CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', '123456'), 2), 'BEP',     N'Lò nướng 1', NULL, NULL),
('NV03', N'Lê Minh Châu',  '0901000003', 'thungan', CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', '123456'), 2), 'THUNGAN', NULL, 'Q01', NULL);
GO
INSERT INTO KhachHang (MaKH, HoTen, SoDienThoai, DiemTichLuy) VALUES
('KH01', N'Phạm Thu Hà', '0912000001', 120),
('KH02', N'Võ Quốc Huy', '0912000002', 40);
GO
DECLARE @b INT = 1;
WHILE @b <= 12
BEGIN
    INSERT INTO BanAn (MaBan, SoBan) VALUES ('B' + RIGHT('0' + CAST(@b AS VARCHAR), 2), @b);
    SET @b += 1;
END
GO
INSERT INTO VoBanh (MaVo, TenVo, PhuThu) VALUES ('VO1', N'Giòn', 0), ('VO2', N'Dày', 10000);
INSERT INTO KichThuoc (MaKT, TenKT) VALUES ('S', N'Nhỏ'), ('M', N'Trung'), ('L', N'Lớn');
INSERT INTO ThanhPhan (MaTP, TenTP, GiaThem, SoLuongTon) VALUES
('TP01', N'Phô mai', 15000, 200),
('TP02', N'Xúc xích', 20000, 150),
('TP03', N'Nấm', 12000, 120),
('TP04', N'Hải sản', 35000, 0),      -- hết hàng: minh họa trạng thái "Tạm hết"
('TP05', N'Ô liu', 10000, 80),
('TP06', N'Sốt cà chua', 0, 500),
('TP07', N'Pepperoni', 25000, 100),
('TP08', N'Gà nướng BBQ', 30000, 90),
('TP09', N'Thơm (dứa)', 10000, 60),
('TP10', N'Ớt chuông', 8000, 70);
GO
INSERT INTO MonAn (MaMon, TenMon, LoaiMon, MoTa, HinhAnh, DangBan) VALUES
('PZ01', N'Margherita cổ điển', 'PIZZA', N'Sốt cà chua, mozzarella tươi và lá húng quế', 'https://images.unsplash.com/photo-1762922425226-9411194abb68?auto=format&fit=crop&w=800&q=80', 1),
('PZ02', N'Pepperoni đặc biệt', 'PIZZA', N'Pepperoni hun khói, phô mai mozzarella', 'https://images.unsplash.com/photo-1682979041136-80601d43700d?auto=format&fit=crop&w=800&q=80', 1),
('PZ03', N'Pizza theo ý bạn', 'PIZZA', N'Tự chọn vỏ bánh, kích thước và thành phần thêm', 'https://images.unsplash.com/photo-1762922425256-621f056e1ebb?auto=format&fit=crop&w=800&q=80', 1),
('PZ04', N'Hải sản nhiệt đới', 'PIZZA', N'Tôm, mực, thơm và sốt kem tỏi', 'https://images.unsplash.com/photo-1682979041136-80601d43700d?auto=format&fit=crop&w=800&q=80', 1),
('PZ05', N'Gà BBQ nấm', 'PIZZA', N'Gà nướng BBQ, nấm, ớt chuông và phô mai', 'https://images.unsplash.com/photo-1762922425226-9411194abb68?auto=format&fit=crop&w=800&q=80', 1),
('PZ06', N'Rau củ nướng', 'PIZZA', N'Ớt chuông, nấm, ô liu và phô mai', 'https://images.unsplash.com/photo-1762922425256-621f056e1ebb?auto=format&fit=crop&w=800&q=80', 0),
('NU01', N'Coca-Cola', 'NUOC', N'Lon 330 ml, dùng kèm đá', NULL, 1),
('NU02', N'Nước chanh tươi', 'NUOC', N'Chanh tươi vắt, ít đường', NULL, 1),
('NU03', N'Trà đào cam sả', 'NUOC', N'Trà đào, cam vàng và sả tươi', NULL, 1),
('NU04', N'Pepsi', 'NUOC', N'Lon 330 ml, dùng kèm đá', NULL, 1),
('NU05', N'Nước suối', 'NUOC', N'Chai 500 ml', NULL, 1);
GO
INSERT INTO BanhPizza (MaMon, LoaiBanh) VALUES
('PZ01', N'Làm sẵn'), ('PZ02', N'Làm sẵn'), ('PZ03', N'Tự làm'), ('PZ04', N'Làm sẵn'), ('PZ05', N'Làm sẵn'), ('PZ06', N'Làm sẵn');
INSERT INTO NuocUong (MaMon, DonGia, DungTich) VALUES
('NU01', 25000, 330), ('NU02', 30000, 400), ('NU03', 35000, 500), ('NU04', 25000, 330), ('NU05', 15000, 500);
GO
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
GO

/* Đơn hàng đã thanh toán trong 30 ngày gần nhất (dữ liệu cho báo cáo doanh thu) */
SET NOCOUNT ON;
DECLARE @d INT = 30, @n INT, @i INT, @ma VARCHAR(12), @seq INT = 1, @ban VARCHAR(10),
        @t DATETIME, @tam DECIMAL(14,0), @vat DECIMAL(14,0), @tong DECIMAL(14,0), @ht VARCHAR(10),
        @mon VARCHAR(10), @kt VARCHAR(10), @gia DECIMAL(12,0), @sl INT, @tt VARCHAR(12);
WHILE @d >= 1
BEGIN
    SET @n = 5 + ABS(CHECKSUM(NEWID())) % 8;
    SET @i = 0;
    WHILE @i < @n
    BEGIN
        SET @ma = 'DH' + RIGHT('000000' + CAST(@seq AS VARCHAR), 6);
        SET @tt = 'TT' + RIGHT('000000' + CAST(@seq AS VARCHAR), 6);
        SET @ban = 'B' + RIGHT('0' + CAST(1 + ABS(CHECKSUM(NEWID())) % 12 AS VARCHAR), 2);
        SET @t = DATEADD(MINUTE, 600 + ABS(CHECKSUM(NEWID())) % 660, CAST(CAST(DATEADD(DAY, -@d, GETDATE()) AS DATE) AS DATETIME));
        INSERT INTO DonHang (MaDon, MaBan, MaNVBep, ThoiGianDat, TrangThai) VALUES (@ma, @ban, 'NV02', @t, 'DA_THANH_TOAN');

        SET @mon = (SELECT TOP 1 MaMon FROM BanhPizza WHERE MaMon <> 'PZ06' ORDER BY NEWID());
        SET @sl = ABS(CHECKSUM(NEWID())) % 3;
        SET @kt = CASE @sl WHEN 0 THEN 'S' WHEN 1 THEN 'M' ELSE 'L' END;
        SET @gia = (SELECT TOP 1 GiaBan FROM GiaTheoKichThuoc WHERE MaMon = @mon AND MaKT = @kt AND NgayApDung <= @t ORDER BY NgayApDung DESC);
        SET @sl = 1 + ABS(CHECKSUM(NEWID())) % 2;
        INSERT INTO ChiTietDonHang (MaDon, MaMon, MaVo, MaKT, SoLuong, DonGia, TrangThaiCheBien) VALUES (@ma, @mon, 'VO1', @kt, @sl, @gia, 'DA_PHUC_VU');

        SET @mon = (SELECT TOP 1 MaMon FROM NuocUong ORDER BY NEWID());
        SET @gia = (SELECT DonGia FROM NuocUong WHERE MaMon = @mon);
        INSERT INTO ChiTietDonHang (MaDon, MaMon, SoLuong, DonGia, TrangThaiCheBien) VALUES (@ma, @mon, 1 + ABS(CHECKSUM(NEWID())) % 3, @gia, 'DA_PHUC_VU');

        SET @tam = (SELECT SUM(ThanhTien) FROM ChiTietDonHang WHERE MaDon = @ma);
        SET @vat = ROUND(@tam * 0.08, 0);
        SET @tong = @tam + @vat;
        UPDATE DonHang SET TamTinh = @tam, ThueVAT = @vat, TongTien = @tong WHERE MaDon = @ma;

        SET @ht = CASE WHEN ABS(CHECKSUM(NEWID())) % 100 < 58 THEN 'TIEN_MAT' ELSE 'THE' END;
        INSERT INTO ThanhToan (MaTT, MaDon, MaNVThuNgan, HinhThuc, SoTien, ThoiGian, TrangThai, TienKhachDua, TienThoi, SoTheRutGon, MaGiaoDich)
        VALUES (@tt, @ma, 'NV03', @ht, @tong, DATEADD(MINUTE, 45, @t), N'Thành công',
                CASE WHEN @ht = 'TIEN_MAT' THEN CEILING(@tong / 50000.0) * 50000 END,
                CASE WHEN @ht = 'TIEN_MAT' THEN CEILING(@tong / 50000.0) * 50000 - @tong END,
                CASE WHEN @ht = 'THE' THEN '4242' END,
                CASE WHEN @ht = 'THE' THEN 'GD' + CAST(@seq AS VARCHAR) END);
        INSERT INTO HoaDon (MaHD, MaTT, NgayLap, ThueVAT, TongTien, HinhThucTT)
        VALUES ('HD' + RIGHT('000000' + CAST(@seq AS VARCHAR), 6), @tt, DATEADD(MINUTE, 45, @t), @vat, @tong, @ht);

        SET @seq += 1;
        SET @i += 1;
    END
    SET @d -= 1;
END
GO
