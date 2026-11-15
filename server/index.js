// Máy chủ API - Hệ thống đặt và bán bánh Pizza tự động tại bàn ăn
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { query, transaction } = require('./db');
const {
  AppError, loadMenu, priceItems, loadOrder, recalcOrder, STATUS_FLOW, STATUS_LABEL,
} = require('./services');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

/* ------------------------------------------------------------------ */
/* Xác thực nhân viên (token lưu trong bộ nhớ máy chủ)                 */
/* ------------------------------------------------------------------ */
// Token ký HMAC (không lưu trạng thái) để chạy được trên môi trường serverless như Vercel
const SECRET = process.env.AUTH_SECRET || 'pizza-self-order-dev-secret';
const TOKEN_TTL = 12 * 3600 * 1000;
const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
const sessions = {
  set(_t, user) { /* token tự mang thông tin */ },
  delete() { /* token hết hạn tự nhiên */ },
  create(user) {
    const data = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + TOKEN_TTL })).toString('base64url');
    return `${data}.${sign(data)}`;
  },
  get(token) {
    const [data, sig] = String(token || '').split('.');
    if (!data || !sig || sign(data) !== sig) return undefined;
    try {
      const { exp, ...user } = JSON.parse(Buffer.from(data, 'base64url').toString());
      return exp > Date.now() ? user : undefined;
    } catch { return undefined; }
  },
};
// Thông báo cho nhân viên (gọi phục vụ, món không thể chế biến) lưu trong bảng ThongBao
async function ensureNotifyTable() {
  await query(`CREATE TABLE IF NOT EXISTS ThongBao (
    Id UUID PRIMARY KEY, Loai VARCHAR(50), NoiDung VARCHAR(500), SoBan INT NULL,
    ThoiGian TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
}
let notifyReady = null;
function notify(type, message, soBan) {
  notifyReady = notifyReady || ensureNotifyTable().catch((e) => { notifyReady = null; throw e; });
  return notifyReady
    .then(() => query('INSERT INTO ThongBao (Id, Loai, NoiDung, SoBan) VALUES (@id, @t, @m, @b)',
      { id: crypto.randomUUID(), t: type, m: message, b: soBan ?? null }))
    .catch((e) => console.error('notify', e));
}
async function recentNotifications() {
  notifyReady = notifyReady || ensureNotifyTable().catch((e) => { notifyReady = null; throw e; });
  await notifyReady;
  const rows = await query('SELECT Id, Loai, NoiDung, SoBan, ThoiGian FROM ThongBao ORDER BY ThoiGian DESC LIMIT 10');
  return rows.map((r) => ({ id: r.Id, type: r.Loai, message: r.NoiDung, soBan: r.SoBan, time: new Date(r.ThoiGian).toISOString() }));
}

function requireRole(...roles) {
  return (req, res, next) => {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const user = sessions.get(token);
    if (!user) return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại' });
    if (!roles.includes(user.vaiTro)) return res.status(403).json({ message: 'Bạn không có quyền thực hiện chức năng này' });
    req.user = user;
    next();
  };
}

app.post('/api/auth/login', wrap(async (req, res) => {
  const { tenDangNhap, matKhau } = req.body || {};
  if (!tenDangNhap || !matKhau) throw new AppError(400, 'Vui lòng nhập tên đăng nhập và mật khẩu');
  const hash = crypto.createHash('sha256').update(String(matKhau)).digest('hex').toUpperCase();
  const [u] = await query(
    'SELECT MaNV, HoTen, VaiTro FROM NhanVien WHERE TenDangNhap = @u AND MatKhau = @p',
    { u: String(tenDangNhap).trim(), p: hash },
  );
  if (!u) throw new AppError(401, 'Sai tên đăng nhập hoặc mật khẩu');
  const user = { maNV: u.MaNV, hoTen: u.HoTen, vaiTro: u.VaiTro };
  const token = sessions.create(user);
  res.json({ token, user });
}));

app.post('/api/auth/logout', (req, res) => {
  sessions.delete((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* KHÁCH HÀNG - màn hình cảm ứng tại bàn                              */
/* ------------------------------------------------------------------ */

// UC Xem thực đơn bánh Pizza và nước uống
app.get('/api/menu', wrap(async (req, res) => {
  res.json(await loadMenu());
}));

app.get('/api/tables/:soBan', wrap(async (req, res) => {
  const [t] = await query('SELECT MaBan, SoBan, TrangThai FROM BanAn WHERE SoBan = @s', { s: Number(req.params.soBan) || 0 });
  if (!t) throw new AppError(404, 'Không tìm thấy bàn');
  res.json({ maBan: t.MaBan, soBan: t.SoBan, trangThai: t.TrangThai });
}));

async function activeOrderId(run, soBan, lock = false) {
  const rows = await run(`
    SELECT d.MaDon FROM DonHang d
    JOIN BanAn b ON b.MaBan = d.MaBan
    WHERE b.SoBan = @s AND d.TrangThai NOT IN ('DA_THANH_TOAN', 'DA_HUY')
    ORDER BY d.ThoiGianDat DESC LIMIT 1 ${lock ? 'FOR UPDATE OF d' : ''}`, { s: Number(soBan) || 0 });
  return rows[0]?.MaDon || null;
}

// UC Theo dõi quy trình chế biến bánh: đơn đang phục vụ của bàn
app.get('/api/tables/:soBan/order', wrap(async (req, res) => {
  const maDon = await activeOrderId(query, req.params.soBan);
  if (maDon) return res.json({ order: await loadOrder(maDon) });
  // Không có đơn đang phục vụ: trả về đơn gần nhất trong 2 giờ (đã thanh toán / bị hủy) để hiển thị kết quả
  const [last] = await query(`
    SELECT d.MaDon FROM DonHang d JOIN BanAn b ON b.MaBan = d.MaBan
    WHERE b.SoBan = @s AND d.ThoiGianDat > (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') - INTERVAL '2 hours'
    ORDER BY d.ThoiGianDat DESC LIMIT 1`, { s: Number(req.params.soBan) || 0 });
  res.json({ order: null, lastOrder: last ? await loadOrder(last.MaDon) : null });
}));

// UC Xác nhận đơn đặt bánh và tính tổng tiền (gồm cả bánh Pizza và nước uống)
app.post('/api/orders', wrap(async (req, res) => {
  const { soBan, items } = req.body || {};
  const maDon = await transaction(async (run) => {
    const [ban] = await run('SELECT MaBan FROM BanAn WHERE SoBan = @s FOR UPDATE', { s: Number(soBan) || 0 });
    if (!ban) throw new AppError(404, 'Không tìm thấy bàn');

    let ma = await activeOrderId(run, soBan, true);
    let hasPizza = false;
    if (ma) {
      const p = await run(`SELECT COUNT(*) AS n FROM ChiTietDonHang c JOIN MonAn m ON m.MaMon = c.MaMon
                           WHERE c.MaDon = @ma AND m.LoaiMon = 'PIZZA' AND c.TrangThaiCheBien <> 'DA_HUY'`, { ma });
      hasPizza = p[0].n > 0;
    }
    const lines = await priceItems(items, { hasPizzaInOrder: hasPizza });

    if (!ma) {
      await run('LOCK TABLE DonHang IN SHARE ROW EXCLUSIVE MODE');
      const [{ next }] = await run(`SELECT COALESCE(MAX(CAST(SUBSTRING(MaDon, 3, 10) AS INT)), 0) + 1 AS next FROM DonHang`);
      ma = 'DH' + String(next).padStart(6, '0');
      await run(`INSERT INTO DonHang (MaDon, MaBan, TrangThai) VALUES (@ma, @ban, 'CHO_CHE_BIEN')`, { ma, ban: ban.MaBan });
    } else {
      // Gọi thêm món vào đơn đang phục vụ: đơn quay lại hàng chờ của bếp
      await run(`UPDATE DonHang SET TrangThai = 'CHO_CHE_BIEN' WHERE MaDon = @ma`, { ma });
    }

    for (const l of lines) {
      const [{ id }] = await run(`
        INSERT INTO ChiTietDonHang (MaDon, MaMon, MaVo, MaKT, SoLuong, DonGia, GhiChu)
        VALUES (@ma, @maMon, @maVo, @maKT, @soLuong, @donGia, @ghiChu)
        RETURNING MaCT AS id`,
      { ma, maMon: l.maMon, maVo: l.maVo, maKT: l.maKT, soLuong: l.soLuong, donGia: l.donGia, ghiChu: l.ghiChu });
      for (const t of l.thanhPhan) {
        await run('INSERT INTO ChiTiet_ThanhPhanThem (MaCT, MaTP, GiaThem) VALUES (@id, @tp, @gia)', { id, tp: t.maTP, gia: t.giaThem });
      }
    }
    await recalcOrder(run, ma);
    await run(`UPDATE BanAn SET TrangThai = N'Đang phục vụ' WHERE MaBan = @ban`, { ban: ban.MaBan });
    return ma;
  });
  res.status(201).json({ order: await loadOrder(maDon) });
}));

app.post('/api/tables/:soBan/call-staff', wrap(async (req, res) => {
  await notify('CALL', `Bàn ${req.params.soBan} cần nhân viên hỗ trợ`, Number(req.params.soBan));
  res.json({ message: 'Đã gọi nhân viên' });
}));

// Kiểm tra số thẻ theo thuật toán Luhn
function luhn(num) {
  let sum = 0;
  let dbl = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

/* ------------------------------------------------------------------ */
/* Thanh toán chuyển khoản qua SePay (VietQR + webhook)                */
/* ------------------------------------------------------------------ */
const SEPAY = {
  bank: process.env.SEPAY_BANK || 'MBBank',
  account: process.env.SEPAY_ACCOUNT || '',
  accountName: process.env.SEPAY_ACCOUNT_NAME || '',
  apiKey: process.env.SEPAY_API_KEY || '',
  prefix: (process.env.SEPAY_PREFIX || 'PZ').toUpperCase(),
};
const sepayContent = (maDon) => `${SEPAY.prefix}${maDon}`;

// Cho phép giá trị 'SEPAY' trong cột HinhThuc / HinhThucTT (CSDL tạo trước khi có SePay)
let sepaySchemaReady = null;
function ensureSepaySchema() {
  sepaySchemaReady = sepaySchemaReady || query(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_thanhtoan_hinhthuc' AND pg_get_constraintdef(oid) NOT LIKE '%SEPAY%') THEN
        ALTER TABLE ThanhToan DROP CONSTRAINT CK_ThanhToan_HinhThuc;
        ALTER TABLE ThanhToan ADD CONSTRAINT CK_ThanhToan_HinhThuc CHECK (HinhThuc IN ('TIEN_MAT', 'THE', 'SEPAY'));
      END IF;
    END $$`).catch((e) => { sepaySchemaReady = null; throw e; });
  return sepaySchemaReady;
}

/** Ghi nhận thanh toán thành công: ThanhToan + HoaDon, cập nhật đơn và bàn */
async function finalizePayment(run, o, { ht, tong, kd = null, thoi = null, the4 = null, gd = null }) {
  const so = o.MaDon.slice(2);
  await run(`INSERT INTO ThanhToan (MaTT, MaDon, HinhThuc, SoTien, TrangThai, TienKhachDua, TienThoi, SoTheRutGon, MaGiaoDich)
             VALUES (@tt, @maDon, @ht, @tong, N'Thành công', @kd, @thoi, @the4, @gd)`,
  { tt: 'TT' + so, maDon: o.MaDon, ht, tong, kd, thoi, the4, gd });
  await run(`INSERT INTO HoaDon (MaHD, MaTT, ThueVAT, TongTien, HinhThucTT) VALUES (@hd, @tt, @vat, @tong, @ht)`,
    { hd: 'HD' + so, tt: 'TT' + so, vat: Number(o.ThueVAT), tong, ht });
  await run(`UPDATE DonHang SET TrangThai = 'DA_THANH_TOAN' WHERE MaDon = @maDon`, { maDon: o.MaDon });
  await run(`UPDATE ChiTietDonHang SET TrangThaiCheBien = 'DA_PHUC_VU' WHERE MaDon = @maDon AND TrangThaiCheBien NOT IN ('DA_HUY')`, { maDon: o.MaDon });
  await run(`UPDATE BanAn SET TrangThai = N'Trống' WHERE MaBan = @b`, { b: o.MaBan });
}

/** Kiểm tra đơn có thể thanh toán; trả về dòng DonHang */
async function checkPayable(run, maDon, xacNhanChuaPhucVu) {
  const [o] = await run('SELECT MaDon, MaBan, TrangThai, TongTien, ThueVAT FROM DonHang WHERE MaDon = @maDon FOR UPDATE', { maDon });
  if (!o) throw new AppError(404, 'Không tìm thấy đơn hàng');
  const paid = await run(`SELECT 1 AS x FROM ThanhToan WHERE MaDon = @maDon AND TrangThai = N'Thành công'`, { maDon });
  if (o.TrangThai === 'DA_THANH_TOAN' || paid.length) throw new AppError(409, 'Đơn hàng đã được thanh toán');
  if (o.TrangThai === 'DA_HUY') throw new AppError(400, 'Đơn hàng đã bị hủy');
  if (Number(o.TongTien) <= 0) throw new AppError(400, 'Đơn hàng không có món cần thanh toán');
  const pending = await run(`SELECT COUNT(*) AS n FROM ChiTietDonHang WHERE MaDon = @maDon
                             AND TrangThaiCheBien NOT IN ('DA_PHUC_VU', 'DA_HUY')`, { maDon });
  if (pending[0].n > 0 && !xacNhanChuaPhucVu) throw new AppError(409, 'Còn món chưa được phục vụ', 'UNSERVED');
  return o;
}

// Tạo mã QR chuyển khoản cho đơn hàng
app.post('/api/orders/:maDon/sepay', wrap(async (req, res) => {
  if (!SEPAY.account) throw new AppError(503, 'Chưa cấu hình tài khoản nhận tiền SePay', 'SEPAY_OFF');
  const maDon = req.params.maDon;
  const o = await transaction((run) => checkPayable(run, maDon, req.body?.xacNhanChuaPhucVu));
  const soTien = Number(o.TongTien);
  const noiDung = sepayContent(maDon);
  const qrUrl = `https://qr.sepay.vn/img?acc=${encodeURIComponent(SEPAY.account)}&bank=${encodeURIComponent(SEPAY.bank)}`
    + `&amount=${soTien}&des=${encodeURIComponent(noiDung)}&template=compact`;
  res.json({ qrUrl, soTien, noiDung, nganHang: SEPAY.bank, soTaiKhoan: SEPAY.account, chuTaiKhoan: SEPAY.accountName });
}));

// Webhook SePay gọi khi tài khoản nhận được tiền
app.post('/api/sepay/webhook', wrap(async (req, res) => {
  const auth = String(req.headers.authorization || '');
  if (SEPAY.apiKey && auth !== `Apikey ${SEPAY.apiKey}`) return res.status(401).json({ success: false });
  const t = req.body || {};
  if (t.transferType !== 'in') return res.json({ success: true, ignored: 'not incoming' });
  const m = new RegExp(`${SEPAY.prefix}\\s*(DH\\d{6})`, 'i').exec(`${t.code || ''} ${t.content || ''} ${t.description || ''}`);
  if (!m) return res.json({ success: true, ignored: 'no order code' });
  const maDon = m[1].toUpperCase();
  await ensureSepaySchema();
  const result = await transaction(async (run) => {
    let o;
    try { o = await checkPayable(run, maDon, true); } catch (e) {
      if (e instanceof AppError) return { ignored: e.message };
      throw e;
    }
    const tong = Number(o.TongTien);
    if (Number(t.transferAmount) < tong) return { ignored: 'insufficient amount' };
    await finalizePayment(run, o, { ht: 'SEPAY', tong, gd: String(t.referenceCode || t.id || '').slice(0, 50) || null });
    return { paid: maDon };
  });
  if (result.paid) await notify('PAID', `Đơn ${maDon} đã thanh toán chuyển khoản qua SePay`, null);
  res.json({ success: true, ...result });
}));

// UC Thanh toán đơn hàng
app.post('/api/orders/:maDon/pay', wrap(async (req, res) => {
  const { hinhThuc, tienKhachDua, soThe, hetHan, cvv, xacNhanChuaPhucVu } = req.body || {};
  const maDon = req.params.maDon;

  await transaction(async (run) => {
    const [o] = await run('SELECT MaDon, MaBan, TrangThai, TongTien, ThueVAT FROM DonHang WHERE MaDon = @maDon FOR UPDATE', { maDon });
    if (!o) throw new AppError(404, 'Không tìm thấy đơn hàng');
    const paid = await run(`SELECT 1 AS x FROM ThanhToan WHERE MaDon = @maDon AND TrangThai = N'Thành công'`, { maDon });
    if (o.TrangThai === 'DA_THANH_TOAN' || paid.length) throw new AppError(409, 'Đơn hàng đã được thanh toán');
    if (o.TrangThai === 'DA_HUY') throw new AppError(400, 'Đơn hàng đã bị hủy');
    const tong = Number(o.TongTien);
    if (tong <= 0) throw new AppError(400, 'Đơn hàng không có món cần thanh toán');

    const pending = await run(`SELECT COUNT(*) AS n FROM ChiTietDonHang WHERE MaDon = @maDon
                               AND TrangThaiCheBien NOT IN ('DA_PHUC_VU', 'DA_HUY')`, { maDon });
    if (pending[0].n > 0 && !xacNhanChuaPhucVu) throw new AppError(409, 'Còn món chưa được phục vụ', 'UNSERVED');
    if (!hinhThuc) throw new AppError(400, 'Vui lòng chọn hình thức thanh toán');

    let khachDua = null; let thoi = null; let the4 = null; let maGD = null;
    if (hinhThuc === 'TIEN_MAT') {
      khachDua = Number(String(tienKhachDua ?? '').replace(/[^\d]/g, ''));
      if (!khachDua || khachDua < tong) throw new AppError(400, 'Số tiền không đủ');
      thoi = khachDua - tong;
    } else if (hinhThuc === 'THE') {
      const so = String(soThe || '').replace(/\D/g, '');
      const m = /^(\d{2})\/(\d{2})$/.exec(String(hetHan || '').trim());
      if (so.length < 13 || so.length > 19 || !luhn(so)) throw new AppError(400, 'Số thẻ không hợp lệ');
      if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) throw new AppError(400, 'Ngày hết hạn không hợp lệ');
      const exp = new Date(2000 + Number(m[2]), Number(m[1]), 0, 23, 59, 59);
      if (exp < new Date()) throw new AppError(400, 'Thẻ đã hết hạn');
      if (!/^\d{3,4}$/.test(String(cvv || ''))) throw new AppError(400, 'CVV không hợp lệ');
      // Cổng thanh toán mô phỏng (không lưu số thẻ, chỉ lưu 4 số cuối)
      if (so.endsWith('0002')) throw new AppError(402, 'Giao dịch thất bại: thẻ bị từ chối', 'DECLINED');
      if (so.endsWith('0119')) throw new AppError(504, 'Không kết nối được ngân hàng. Giao dịch đã hủy, vui lòng thanh toán bằng tiền mặt', 'TIMEOUT');
      the4 = so.slice(-4);
      maGD = 'GD' + Date.now();
    } else {
      throw new AppError(400, 'Vui lòng chọn hình thức thanh toán');
    }

    await finalizePayment(run, o, { ht: hinhThuc, tong, kd: khachDua, thoi, the4, gd: maGD });
  });
  res.json({ message: 'Thanh toán thành công – Cảm ơn quý khách', order: await loadOrder(maDon) });
}));

app.get('/api/orders/:maDon', wrap(async (req, res) => {
  const o = await loadOrder(req.params.maDon);
  if (!o) throw new AppError(404, 'Không tìm thấy đơn hàng');
  res.json({ order: o });
}));

/* ------------------------------------------------------------------ */
/* NHÂN VIÊN BẾP - Tiếp nhận đơn hàng và cập nhật trạng thái làm bánh  */
/* ------------------------------------------------------------------ */
const kitchen = requireRole('BEP', 'QUANLY');

app.get('/api/kitchen/orders', kitchen, wrap(async (req, res) => {
  const rows = await query(`
    SELECT MaDon FROM DonHang
    WHERE TrangThai IN ('CHO_CHE_BIEN', 'CHUAN_BI_NGUYEN_LIEU', 'DANG_NUONG', 'HOAN_THANH')
    ORDER BY ThoiGianDat`); // FIFO: đơn đặt trước hiển thị trước
  const orders = [];
  for (const r of rows) orders.push(await loadOrder(r.MaDon));
  const [stats] = await query(`
    SELECT
      (SELECT COUNT(*) FROM DonHang WHERE TrangThai IN ('DA_PHUC_VU', 'DA_THANH_TOAN') AND CAST(ThoiGianDat AS DATE) = CAST(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh' AS DATE)) AS daXong,
      (SELECT COUNT(*) FROM DonHang WHERE TrangThai = 'DA_HUY' AND CAST(ThoiGianDat AS DATE) = CAST(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh' AS DATE)) AS daHuy`);
  res.json({ orders, stats, notifications: await recentNotifications(), serverTime: new Date().toISOString() });
}));

app.post('/api/kitchen/orders/:maDon/advance', kitchen, wrap(async (req, res) => {
  const maDon = req.params.maDon;
  const { from } = req.body || {};
  await transaction(async (run) => {
    const [o] = await run('SELECT TrangThai FROM DonHang WHERE MaDon = @maDon FOR UPDATE', { maDon });
    if (!o) throw new AppError(404, 'Không tìm thấy đơn hàng');
    if (from && from !== o.TrangThai) throw new AppError(409, `Đơn đã được cập nhật sang "${STATUS_LABEL[o.TrangThai]}", vui lòng làm mới`);
    const idx = STATUS_FLOW.indexOf(o.TrangThai);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) throw new AppError(400, 'Không thể chuyển trạng thái cho đơn này');
    const next = STATUS_FLOW[idx + 1];
    const before = STATUS_FLOW.slice(0, idx + 1).map((s) => `'${s}'`).join(',');
    await run('UPDATE DonHang SET TrangThai = @next, MaNVBep = @nv WHERE MaDon = @maDon', { next, nv: req.user.maNV, maDon });
    await run(`UPDATE ChiTietDonHang SET TrangThaiCheBien = @next WHERE MaDon = @maDon AND TrangThaiCheBien IN (${before})`, { next, maDon });
  });
  res.json({ order: await loadOrder(maDon) });
}));

app.post('/api/kitchen/orders/:maDon/reject', kitchen, wrap(async (req, res) => {
  const maDon = req.params.maDon;
  const { maCT, lyDo, ghiChu } = req.body || {};
  if (!lyDo) throw new AppError(400, 'Vui lòng chọn lý do không thể chế biến');
  const note = `Không thể chế biến: ${lyDo}${ghiChu ? ' – ' + String(ghiChu).slice(0, 100) : ''}`.slice(0, 200);
  let soBan = null;
  await transaction(async (run) => {
    const [o] = await run(`SELECT d.TrangThai, d.MaBan, b.SoBan FROM DonHang d JOIN BanAn b ON b.MaBan = d.MaBan WHERE d.MaDon = @maDon FOR UPDATE OF d`, { maDon });
    if (!o) throw new AppError(404, 'Không tìm thấy đơn hàng');
    if (['DA_THANH_TOAN', 'DA_HUY'].includes(o.TrangThai)) throw new AppError(400, 'Đơn hàng đã kết thúc');
    soBan = o.SoBan;
    const cond = maCT ? 'AND MaCT = @maCT' : '';
    await run(`UPDATE ChiTietDonHang SET TrangThaiCheBien = 'DA_HUY', GhiChu = @note
               WHERE MaDon = @maDon AND TrangThaiCheBien NOT IN ('HOAN_THANH', 'DA_PHUC_VU', 'DA_HUY') ${cond}`,
    { maDon, note, maCT: Number(maCT) || 0 });
    const [left] = await run(`SELECT COUNT(*) AS n FROM ChiTietDonHang WHERE MaDon = @maDon AND TrangThaiCheBien <> 'DA_HUY'`, { maDon });
    if (left.n === 0) {
      await run(`UPDATE DonHang SET TrangThai = 'DA_HUY' WHERE MaDon = @maDon`, { maDon });
      await run(`UPDATE BanAn SET TrangThai = N'Trống' WHERE MaBan = @b`, { b: o.MaBan });
    }
    await recalcOrder(run, maDon);
  });
  await notify('REJECT', `Đơn ${maDon} (Bàn ${soBan}): ${note}`, soBan);
  res.json({ order: await loadOrder(maDon) });
}));

/* ------------------------------------------------------------------ */
/* QUẢN LÝ - Quản lý thực đơn và giá bán                               */
/* ------------------------------------------------------------------ */
const manager = requireRole('QUANLY');

app.get('/api/admin/dishes', manager, wrap(async (req, res) => {
  const menu = await loadMenu({ includeStopped: true });
  const used = await query('SELECT DISTINCT MaMon FROM ChiTietDonHang');
  const updated = await query('SELECT MaMon, MAX(NgayApDung) AS NgayCapNhat FROM GiaTheoKichThuoc GROUP BY MaMon');
  const usedSet = new Set(used.map((u) => u.MaMon));
  menu.items = menu.items.map((i) => ({
    ...i,
    daCoDonHang: usedSet.has(i.maMon),
    ngayCapNhat: updated.find((u) => u.MaMon === i.maMon)?.NgayCapNhat || null,
  }));
  res.json(menu);
}));

function parsePrice(v) {
  if (v === '' || v == null) throw new AppError(400, 'Vui lòng nhập giá bán', 'PRICE');
  const s = String(v).replace(/[.\s,đ]/g, '');
  if (!/^-?\d+$/.test(s)) throw new AppError(400, 'Giá phải là số', 'PRICE');
  const n = Number(s);
  if (n <= 0 || n > 10000000) throw new AppError(400, 'Giá không hợp lệ', 'PRICE');
  return n;
}

function validateDish(body) {
  const tenMon = String(body.tenMon || '').trim();
  if (!tenMon) throw new AppError(400, 'Vui lòng nhập tên món', 'NAME');
  if (tenMon.length > 100) throw new AppError(400, 'Tên món tối đa 100 ký tự', 'NAME');
  const loaiMon = body.loaiMon === 'NUOC' ? 'NUOC' : 'PIZZA';
  const out = {
    tenMon, loaiMon,
    loaiBanh: body.loaiBanh === 'Tự làm' ? 'Tự làm' : 'Làm sẵn',
    moTa: body.moTa ? String(body.moTa).slice(0, 500) : null,
    hinhAnh: body.hinhAnh ? String(body.hinhAnh).slice(0, 255) : null,
    dangBan: body.dangBan === false ? 0 : 1,
    thanhPhan: Array.isArray(body.thanhPhan) ? body.thanhPhan : [],
  };
  if (loaiMon === 'PIZZA') {
    const g = body.gia || {};
    out.gia = { S: parsePrice(g.S), M: parsePrice(g.M), L: parsePrice(g.L) };
  } else {
    out.donGia = parsePrice(body.donGia);
    out.dungTich = Number(body.dungTich) || null;
  }
  return out;
}

async function assertUniqueName(run, tenMon, exceptMa = '') {
  const dup = await run('SELECT MaMon FROM MonAn WHERE LOWER(TenMon) = LOWER(CAST(@t AS VARCHAR)) AND MaMon <> @m', { t: tenMon, m: exceptMa });
  if (dup.length) throw new AppError(409, 'Món đã tồn tại', 'NAME');
}

app.post('/api/admin/dishes', manager, wrap(async (req, res) => {
  const d = validateDish(req.body || {});
  const maMon = await transaction(async (run) => {
    await assertUniqueName(run, d.tenMon);
    const prefix = d.loaiMon === 'PIZZA' ? 'PZ' : 'NU';
    await run('LOCK TABLE MonAn IN SHARE ROW EXCLUSIVE MODE');
    const [{ next }] = await run(`SELECT COALESCE(MAX(CAST(SUBSTRING(MaMon, 3, 8) AS INT)), 0) + 1 AS next
                                  FROM MonAn WHERE MaMon LIKE @p`, { p: prefix + '%' });
    const ma = prefix + String(next).padStart(2, '0');
    await run(`INSERT INTO MonAn (MaMon, TenMon, LoaiMon, MoTa, HinhAnh, DangBan) VALUES (@ma, @t, @l, @mt, @ha, @db)`,
      { ma, t: d.tenMon, l: d.loaiMon, mt: d.moTa, ha: d.hinhAnh, db: d.dangBan });
    if (d.loaiMon === 'PIZZA') {
      await run('INSERT INTO BanhPizza (MaMon, LoaiBanh) VALUES (@ma, @lb)', { ma, lb: d.loaiBanh });
      for (const kt of ['S', 'M', 'L']) {
        await run(`INSERT INTO GiaTheoKichThuoc (MaMon, MaKT, NgayApDung, GiaBan) VALUES (@ma, @kt, CAST(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh' AS DATE), @g)`, { ma, kt, g: d.gia[kt] });
      }
      const tps = new Set(['TP06', ...d.thanhPhan]);
      for (const tp of tps) await run('INSERT INTO BanhPizza_ThanhPhan (MaMon, MaTP) SELECT CAST(@ma AS VARCHAR), MaTP FROM ThanhPhan WHERE MaTP = @tp', { ma, tp });
    } else {
      await run('INSERT INTO NuocUong (MaMon, DonGia, DungTich) VALUES (@ma, @g, @dt)', { ma, g: d.donGia, dt: d.dungTich });
    }
    return ma;
  });
  res.status(201).json({ maMon, message: 'Đã thêm món vào thực đơn' });
}));

app.put('/api/admin/dishes/:ma', manager, wrap(async (req, res) => {
  const ma = req.params.ma;
  const d = validateDish(req.body || {});
  await transaction(async (run) => {
    const [cur] = await run('SELECT LoaiMon FROM MonAn WHERE MaMon = @ma FOR UPDATE', { ma });
    if (!cur) throw new AppError(404, 'Không tìm thấy món');
    if (cur.LoaiMon !== d.loaiMon) throw new AppError(400, 'Không thể đổi loại món (Pizza / Nước uống)');
    await assertUniqueName(run, d.tenMon, ma);
    await run('UPDATE MonAn SET TenMon = @t, MoTa = @mt, HinhAnh = @ha, DangBan = @db WHERE MaMon = @ma',
      { ma, t: d.tenMon, mt: d.moTa, ha: d.hinhAnh, db: d.dangBan });
    if (d.loaiMon === 'PIZZA') {
      await run('UPDATE BanhPizza SET LoaiBanh = @lb WHERE MaMon = @ma', { ma, lb: d.loaiBanh });
      // Giá mới được lưu thành một dòng mới (lịch sử giá); đơn đã xác nhận giữ nguyên giá cũ
      for (const kt of ['S', 'M', 'L']) {
        const [cur] = await run(`SELECT GiaBan FROM GiaTheoKichThuoc WHERE MaMon = @ma AND MaKT = @kt AND NgayApDung <= CAST(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh' AS DATE)
                                 ORDER BY NgayApDung DESC LIMIT 1`, { ma, kt });
        if (!cur || Number(cur.GiaBan) !== d.gia[kt]) {
          await run(`INSERT INTO GiaTheoKichThuoc (MaMon, MaKT, NgayApDung, GiaBan) VALUES (@ma, @kt, CAST(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh' AS DATE), @g)
                     ON CONFLICT (MaMon, MaKT, NgayApDung) DO UPDATE SET GiaBan = EXCLUDED.GiaBan`, { ma, kt, g: d.gia[kt] });
        }
      }
    } else {
      await run('UPDATE NuocUong SET DonGia = @g, DungTich = @dt WHERE MaMon = @ma', { ma, g: d.donGia, dt: d.dungTich });
    }
  });
  res.json({ message: 'Đã lưu thay đổi' });
}));

app.patch('/api/admin/dishes/:ma/status', manager, wrap(async (req, res) => {
  const r = await query('UPDATE MonAn SET DangBan = @db WHERE MaMon = @ma RETURNING 1 AS n', { ma: req.params.ma, db: req.body?.dangBan ? 1 : 0 });
  if (!r[0]?.n) throw new AppError(404, 'Không tìm thấy món');
  res.json({ message: req.body?.dangBan ? 'Món đã được mở bán' : 'Món đã chuyển sang Ngừng bán' });
}));

app.delete('/api/admin/dishes/:ma', manager, wrap(async (req, res) => {
  const ma = req.params.ma;
  const used = await query('SELECT 1 AS x FROM ChiTietDonHang WHERE MaMon = @ma LIMIT 1', { ma });
  if (used.length) throw new AppError(409, 'Món đã có trong đơn hàng nên không thể xóa, chỉ có thể chuyển sang "Ngừng bán"');
  const r = await query('DELETE FROM MonAn WHERE MaMon = @ma RETURNING 1 AS n', { ma });
  if (!r[0]?.n) throw new AppError(404, 'Không tìm thấy món');
  res.json({ message: 'Đã xóa món' });
}));

app.get('/api/admin/dishes/:ma/prices', manager, wrap(async (req, res) => {
  const rows = await query(`SELECT g.MaKT, k.TenKT, g.NgayApDung, g.GiaBan FROM GiaTheoKichThuoc g
                            JOIN KichThuoc k ON k.MaKT = g.MaKT WHERE g.MaMon = @ma ORDER BY g.NgayApDung DESC, g.MaKT`, { ma: req.params.ma });
  res.json(rows.map((r) => ({ maKT: r.MaKT, tenKT: r.TenKT, ngayApDung: r.NgayApDung, giaBan: Number(r.GiaBan) })));
}));

/* ------------------------------------------------------------------ */
/* QUẢN LÝ - Xem báo cáo thống kê doanh thu                            */
/* ------------------------------------------------------------------ */
function reportParams(q) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const tuNgay = String(q.tuNgay || '');
  const denNgay = String(q.denNgay || '');
  if (!re.test(tuNgay) || !re.test(denNgay)) throw new AppError(400, 'Vui lòng chọn đầy đủ khoảng thời gian');
  if (tuNgay > denNgay) throw new AppError(400, 'Khoảng thời gian không hợp lệ');
  if (denNgay > today()) throw new AppError(400, 'Ngày kết thúc không được vượt quá ngày hiện tại');
  const hinhThuc = ['TIEN_MAT', 'THE', 'SEPAY'].includes(q.hinhThuc) ? q.hinhThuc : null;
  return { tuNgay, denNgay, hinhThuc };
}

async function buildReport({ tuNgay, denNgay, hinhThuc }) {
  const where = `t.TrangThai = N'Thành công' AND CAST(t.ThoiGian AS DATE) BETWEEN CAST(@tu AS DATE) AND CAST(@den AS DATE)
                 ${hinhThuc ? 'AND t.HinhThuc = @ht' : ''}`;
  const p = { tu: tuNgay, den: denNgay, ht: hinhThuc || '' };
  const [sum] = await query(`SELECT COALESCE(SUM(t.SoTien), 0) AS tong, COUNT(*) AS soDon FROM ThanhToan t WHERE ${where}`, p);
  const days = Math.round((new Date(denNgay) - new Date(tuNgay)) / 86400000) + 1;
  const [prev] = await query(`SELECT COALESCE(SUM(t.SoTien), 0) AS tong FROM ThanhToan t
     WHERE t.TrangThai = N'Thành công' AND CAST(t.ThoiGian AS DATE) BETWEEN CAST(@tu AS DATE) - CAST(@n AS INT) AND CAST(@tu AS DATE) - 1
     ${hinhThuc ? 'AND t.HinhThuc = @ht' : ''}`, { ...p, n: days });
  const byDay = await query(`SELECT TO_CHAR(CAST(t.ThoiGian AS DATE), 'YYYY-MM-DD') AS ngay, SUM(t.SoTien) AS tong, COUNT(*) AS soDon
                             FROM ThanhToan t WHERE ${where} GROUP BY CAST(t.ThoiGian AS DATE) ORDER BY ngay`, p);
  const byMethod = await query(`SELECT t.HinhThuc, SUM(t.SoTien) AS tong, COUNT(*) AS soDon FROM ThanhToan t WHERE ${where} GROUP BY t.HinhThuc`, p);
  const top = await query(`SELECT m.MaMon, m.TenMon, m.HinhAnh, m.LoaiMon, SUM(c.SoLuong) AS soLuong, SUM(c.ThanhTien) AS doanhThu
                           FROM ThanhToan t JOIN ChiTietDonHang c ON c.MaDon = t.MaDon JOIN MonAn m ON m.MaMon = c.MaMon
                           WHERE ${where} AND c.TrangThaiCheBien <> 'DA_HUY'
                           GROUP BY m.MaMon, m.TenMon, m.HinhAnh, m.LoaiMon ORDER BY SUM(c.ThanhTien) DESC LIMIT 5`, p);

  // Đủ các ngày trong khoảng (ngày không có doanh thu = 0)
  const series = [];
  for (let i = 0; i < days && days <= 400; i++) {
    const dt = new Date(new Date(tuNgay).getTime() + i * 86400000).toISOString().slice(0, 10);
    const f = byDay.find((b) => b.ngay === dt);
    series.push({ ngay: dt, tong: f ? Number(f.tong) : 0, soDon: f ? f.soDon : 0 });
  }
  const tong = Number(sum.tong);
  const prevTong = Number(prev.tong);
  return {
    tuNgay, denNgay, hinhThuc,
    tongDoanhThu: tong,
    soDon: sum.soDon,
    tangTruong: prevTong > 0 ? (tong - prevTong) / prevTong : null,
    theoNgay: series,
    theoHinhThuc: byMethod.map((m) => ({ hinhThuc: m.HinhThuc, tong: Number(m.tong), soDon: m.soDon })),
    monBanChay: top.map((t) => ({ maMon: t.MaMon, tenMon: t.TenMon, hinhAnh: t.HinhAnh, loaiMon: t.LoaiMon, soLuong: t.soLuong, doanhThu: Number(t.doanhThu) })),
  };
}

app.get('/api/admin/reports', manager, wrap(async (req, res) => {
  const params = reportParams(req.query);
  const report = await buildReport(params);
  await query(`INSERT INTO BaoCaoDoanhThu (MaNV, TuNgay, DenNgay, HinhThucTT, TongDoanhThu, SoDonHang)
               VALUES (@nv, @tu, @den, @ht, @tong, @sd)`,
  { nv: req.user.maNV, tu: params.tuNgay, den: params.denNgay, ht: params.hinhThuc, tong: report.tongDoanhThu, sd: report.soDon });
  res.json(report);
}));

app.get('/api/admin/reports/export', manager, wrap(async (req, res) => {
  const params = reportParams(req.query);
  const r = await buildReport(params);
  if (!r.soDon) throw new AppError(404, 'Không có dữ liệu để xuất báo cáo');
  const ht = { TIEN_MAT: 'Tiền mặt', THE: 'Thẻ tín dụng', SEPAY: 'Chuyển khoản (SePay)' };
  const lines = [
    ['BÁO CÁO DOANH THU - PIZZA SELF-ORDER'],
    ['Từ ngày', r.tuNgay, 'Đến ngày', r.denNgay, 'Hình thức', r.hinhThuc ? ht[r.hinhThuc] : 'Tất cả'],
    ['Tổng doanh thu', r.tongDoanhThu, 'Số đơn', r.soDon],
    [],
    ['Ngày', 'Số đơn', 'Doanh thu (đ)'],
    ...r.theoNgay.map((d) => [d.ngay, d.soDon, d.tong]),
    [],
    ['Hình thức thanh toán', 'Số đơn', 'Doanh thu (đ)'],
    ...r.theoHinhThuc.map((m) => [ht[m.hinhThuc], m.soDon, m.tong]),
    [],
    ['Món bán chạy', 'Số lượng', 'Doanh thu (đ)'],
    ...r.monBanChay.map((m) => [m.tenMon, m.soLuong, m.doanhThu]),
  ];
  const csv = '﻿' + lines.map((l) => l.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="bao-cao-doanh-thu_${r.tuNgay}_${r.denNgay}.csv"`);
  res.send(csv);
}));

/* ------------------------------------------------------------------ */
app.get('/api/health', wrap(async (req, res) => {
  await query('SELECT 1 AS ok');
  res.json({ ok: true });
}));

app.use('/api', (req, res) => res.status(404).json({ message: 'Không tìm thấy API' }));

// Phục vụ giao diện đã build (client/dist)
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// Xử lý lỗi chung
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err instanceof AppError) return res.status(err.status).json({ message: err.message, code: err.code });
  console.error(err);
  res.status(500).json({ message: 'Lỗi hệ thống, vui lòng thử lại' });
});

module.exports = app;
const PORT = Number(process.env.PORT) || 3000;
if (require.main === module) app.listen(PORT, () => console.log(`Pizza Self-Order đang chạy tại http://localhost:${PORT}`));
