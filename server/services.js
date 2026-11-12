// Nghiệp vụ dùng chung: thực đơn, tính giá, đơn hàng
const { query } = require('./db');

const VAT_RATE = 0.08;          // VAT 8%
const COMBO_DISCOUNT = 10000;   // Combo Pizza + Nước uống: giảm 10.000 đ mỗi phần nước
const MAX_PIZZA_QTY = 10;
const MAX_DRINK_QTY = 20;

// Thứ tự các trạng thái chế biến (chỉ được chuyển tiến, không chuyển ngược)
const STATUS_FLOW = ['CHO_CHE_BIEN', 'CHUAN_BI_NGUYEN_LIEU', 'DANG_NUONG', 'HOAN_THANH', 'DA_PHUC_VU'];
const STATUS_LABEL = {
  CHO_CHE_BIEN: 'Chờ chế biến',
  CHUAN_BI_NGUYEN_LIEU: 'Chuẩn bị nguyên liệu',
  DANG_NUONG: 'Đang nướng bánh',
  HOAN_THANH: 'Hoàn thành',
  DA_PHUC_VU: 'Đã phục vụ',
  DA_THANH_TOAN: 'Đã thanh toán',
  DA_HUY: 'Không thể chế biến',
};

class AppError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Đọc toàn bộ thực đơn kèm giá hiện hành theo kích thước */
async function loadMenu({ includeStopped = false } = {}) {
  const dishes = await query(`
    SELECT m.MaMon, m.TenMon, m.LoaiMon, m.MoTa, m.HinhAnh, m.DangBan,
           b.LoaiBanh, n.DonGia, n.DungTich
    FROM MonAn m
    LEFT JOIN BanhPizza b ON b.MaMon = m.MaMon
    LEFT JOIN NuocUong n ON n.MaMon = m.MaMon
    ${includeStopped ? '' : 'WHERE m.DangBan = 1'}
    ORDER BY m.LoaiMon DESC, m.MaMon`);

  // Giá hiện hành = bản ghi có NgayApDung lớn nhất nhưng không vượt quá hôm nay
  const prices = await query(`
    SELECT g.MaMon, g.MaKT, g.GiaBan
    FROM GiaTheoKichThuoc g
    WHERE g.NgayApDung = (SELECT MAX(g2.NgayApDung) FROM GiaTheoKichThuoc g2
                          WHERE g2.MaMon = g.MaMon AND g2.MaKT = g.MaKT
                            AND g2.NgayApDung <= CAST(GETDATE() AS DATE))`);

  const fixed = await query(`
    SELECT bt.MaMon, t.MaTP, t.TenTP, t.SoLuongTon
    FROM BanhPizza_ThanhPhan bt JOIN ThanhPhan t ON t.MaTP = bt.MaTP`);

  const toppings = await query(`SELECT MaTP, TenTP, GiaThem, SoLuongTon FROM ThanhPhan WHERE GiaThem > 0 ORDER BY MaTP`);
  const crusts = await query(`SELECT MaVo, TenVo, PhuThu FROM VoBanh ORDER BY PhuThu, MaVo`);
  const sizes = await query(`SELECT MaKT, TenKT FROM KichThuoc`);
  const sizeOrder = { S: 1, M: 2, L: 3 };
  sizes.sort((a, b) => (sizeOrder[a.MaKT] || 9) - (sizeOrder[b.MaKT] || 9));

  const items = dishes.map((d) => {
    const isPizza = d.LoaiMon === 'PIZZA';
    const gia = {};
    prices.filter((p) => p.MaMon === d.MaMon).forEach((p) => { gia[p.MaKT] = Number(p.GiaBan); });
    const tp = fixed.filter((f) => f.MaMon === d.MaMon);
    // Món làm sẵn "tạm hết" khi một thành phần cố định đã hết hàng
    const tamHet = isPizza && tp.some((f) => f.SoLuongTon <= 0);
    return {
      maMon: d.MaMon,
      tenMon: d.TenMon,
      loaiMon: d.LoaiMon,
      loaiBanh: d.LoaiBanh || null,
      moTa: d.MoTa,
      hinhAnh: d.HinhAnh,
      dangBan: !!d.DangBan,
      tamHet,
      gia: isPizza ? gia : null,
      giaTu: isPizza ? Math.min(...Object.values(gia).concat([Infinity])) : Number(d.DonGia),
      donGia: isPizza ? null : Number(d.DonGia),
      dungTich: d.DungTich,
      thanhPhan: tp.map((f) => f.TenTP),
    };
  });

  return {
    items,
    toppings: toppings.map((t) => ({ maTP: t.MaTP, tenTP: t.TenTP, giaThem: Number(t.GiaThem), tamHet: t.SoLuongTon <= 0 })),
    crusts: crusts.map((c) => ({ maVo: c.MaVo, tenVo: c.TenVo, phuThu: Number(c.PhuThu) })),
    sizes: sizes.map((s) => ({ maKT: s.MaKT, tenKT: s.TenKT })),
    vatRate: VAT_RATE,
    comboDiscount: COMBO_DISCOUNT,
  };
}

/**
 * Kiểm tra và tính giá các món khách gửi lên. Giá luôn được tính lại ở máy chủ,
 * không tin giá do màn hình tại bàn gửi.
 */
async function priceItems(rawItems, { hasPizzaInOrder = false } = {}) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new AppError(400, 'Bạn chưa chọn món nào');
  }
  const menu = await loadMenu();
  const byId = new Map(menu.items.map((i) => [i.maMon, i]));
  const containsPizza = hasPizzaInOrder || rawItems.some((r) => byId.get(r.maMon)?.loaiMon === 'PIZZA');

  return rawItems.map((r) => {
    const dish = byId.get(r.maMon);
    if (!dish) throw new AppError(400, 'Món ăn không tồn tại hoặc đã ngừng bán');
    if (dish.tamHet) throw new AppError(409, `Món "${dish.tenMon}" tạm hết, vui lòng chọn món khác`);
    const soLuong = Number(r.soLuong);
    if (!Number.isInteger(soLuong) || soLuong < 1) throw new AppError(400, 'Số lượng không hợp lệ');

    if (dish.loaiMon === 'NUOC') {
      if (soLuong > MAX_DRINK_QTY) throw new AppError(400, `Tối đa ${MAX_DRINK_QTY} phần mỗi loại`);
      const combo = !!r.combo && containsPizza;
      const donGia = Math.max(0, dish.donGia - (combo ? COMBO_DISCOUNT : 0));
      return { maMon: dish.maMon, tenMon: dish.tenMon, soLuong, donGia, maVo: null, maKT: null, thanhPhan: [], ghiChu: combo ? 'Combo Pizza + Nước uống' : (r.ghiChu || null) };
    }

    if (soLuong > MAX_PIZZA_QTY) throw new AppError(400, `Tối đa ${MAX_PIZZA_QTY} bánh mỗi lần đặt`);
    const crust = menu.crusts.find((c) => c.maVo === r.maVo);
    const size = menu.sizes.find((s) => s.maKT === r.maKT);
    if (!crust || !size) throw new AppError(400, 'Vui lòng chọn đầy đủ vỏ bánh và kích thước');
    const base = dish.gia[size.maKT];
    if (!base) throw new AppError(400, 'Món chưa có giá cho kích thước này');

    let extras = [];
    if (dish.loaiBanh === 'Tự làm') {
      const ids = Array.isArray(r.thanhPhan) ? [...new Set(r.thanhPhan)] : [];
      if (ids.length === 0) throw new AppError(400, 'Vui lòng chọn ít nhất một thành phần');
      extras = ids.map((id) => {
        const t = menu.toppings.find((x) => x.maTP === id);
        if (!t) throw new AppError(400, 'Thành phần không hợp lệ');
        if (t.tamHet) throw new AppError(409, `Thành phần "${t.tenTP}" tạm hết`);
        return t;
      });
    }
    // Giá bánh = giá theo kích thước + phụ thu vỏ + giá thành phần thêm
    const donGia = base + crust.phuThu + extras.reduce((s, t) => s + t.giaThem, 0);
    return {
      maMon: dish.maMon, tenMon: dish.tenMon, soLuong, donGia,
      maVo: crust.maVo, maKT: size.maKT,
      thanhPhan: extras.map((t) => ({ maTP: t.maTP, giaThem: t.giaThem })),
      ghiChu: r.ghiChu ? String(r.ghiChu).slice(0, 200) : null,
    };
  });
}

/** Đọc chi tiết một đơn hàng */
async function loadOrder(maDon) {
  const [o] = await query(`
    SELECT d.MaDon, d.MaBan, b.SoBan, d.ThoiGianDat, d.TrangThai, d.TamTinh, d.ThueVAT, d.TongTien, d.MaNVBep
    FROM DonHang d JOIN BanAn b ON b.MaBan = d.MaBan WHERE d.MaDon = @maDon`, { maDon });
  if (!o) return null;
  const lines = await query(`
    SELECT c.MaCT, c.MaMon, m.TenMon, m.LoaiMon, m.HinhAnh, c.SoLuong, c.DonGia, c.ThanhTien,
           c.TrangThaiCheBien, c.GhiChu, v.TenVo, k.TenKT, k.MaKT
    FROM ChiTietDonHang c
    JOIN MonAn m ON m.MaMon = c.MaMon
    LEFT JOIN VoBanh v ON v.MaVo = c.MaVo
    LEFT JOIN KichThuoc k ON k.MaKT = c.MaKT
    WHERE c.MaDon = @maDon ORDER BY c.MaCT`, { maDon });
  const extras = await query(`
    SELECT x.MaCT, t.TenTP FROM ChiTiet_ThanhPhanThem x
    JOIN ThanhPhan t ON t.MaTP = x.MaTP
    JOIN ChiTietDonHang c ON c.MaCT = x.MaCT WHERE c.MaDon = @maDon`, { maDon });
  const [pay] = await query(`
    SELECT t.MaTT, t.HinhThuc, t.SoTien, t.ThoiGian, t.TienKhachDua, t.TienThoi, t.SoTheRutGon, h.MaHD
    FROM ThanhToan t LEFT JOIN HoaDon h ON h.MaTT = t.MaTT
    WHERE t.MaDon = @maDon AND t.TrangThai = N'Thành công'`, { maDon });

  return {
    maDon: o.MaDon,
    maBan: o.MaBan,
    soBan: o.SoBan,
    thoiGianDat: o.ThoiGianDat,
    trangThai: o.TrangThai,
    trangThaiText: STATUS_LABEL[o.TrangThai],
    tamTinh: Number(o.TamTinh),
    thueVAT: Number(o.ThueVAT),
    tongTien: Number(o.TongTien),
    items: lines.map((l) => ({
      maCT: l.MaCT,
      maMon: l.MaMon,
      tenMon: l.TenMon,
      loaiMon: l.LoaiMon,
      hinhAnh: l.HinhAnh,
      soLuong: l.SoLuong,
      donGia: Number(l.DonGia),
      thanhTien: Number(l.ThanhTien),
      trangThai: l.TrangThaiCheBien,
      trangThaiText: STATUS_LABEL[l.TrangThaiCheBien],
      ghiChu: l.GhiChu,
      vo: l.TenVo,
      kichThuoc: l.TenKT,
      thanhPhanThem: extras.filter((e) => e.MaCT === l.MaCT).map((e) => e.TenTP),
    })),
    thanhToan: pay ? {
      maTT: pay.MaTT, maHD: pay.MaHD, hinhThuc: pay.HinhThuc, soTien: Number(pay.SoTien), thoiGian: pay.ThoiGian,
      tienKhachDua: pay.TienKhachDua == null ? null : Number(pay.TienKhachDua),
      tienThoi: pay.TienThoi == null ? null : Number(pay.TienThoi),
      soTheRutGon: pay.SoTheRutGon,
    } : null,
  };
}

/** Tính lại tạm tính, VAT, tổng tiền của đơn (không tính món bị hủy) */
async function recalcOrder(run, maDon) {
  await run(`
    UPDATE DonHang SET
      TamTinh = x.Tam, ThueVAT = ROUND(x.Tam * ${VAT_RATE}, 0), TongTien = x.Tam + ROUND(x.Tam * ${VAT_RATE}, 0)
    FROM DonHang d
    CROSS APPLY (SELECT ISNULL(SUM(ThanhTien), 0) AS Tam FROM ChiTietDonHang
                 WHERE MaDon = d.MaDon AND TrangThaiCheBien <> 'DA_HUY') x
    WHERE d.MaDon = @maDon`, { maDon });
}

module.exports = {
  AppError, loadMenu, priceItems, loadOrder, recalcOrder,
  STATUS_FLOW, STATUS_LABEL, VAT_RATE, MAX_PIZZA_QTY, MAX_DRINK_QTY,
};
