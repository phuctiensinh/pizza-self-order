// Màn hình nhân viên: Đăng nhập, Màn hình bếp, Quản lý thực đơn, Báo cáo doanh thu
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  api, ApiError, auth, clock, download, localISODate, minutesAgo, money,
  type Menu, type MenuItem, type Order, type StaffUser,
} from "./api";
import { navigate } from "./store";
import { Alert, Badge, Button, Field, FoodImage, Icon, Modal, useToast, usePolling } from "./ui";

const ROLE_TEXT: Record<string, string> = { BEP: "Nhân viên bếp", QUANLY: "Quản lý nhà hàng", THUNGAN: "Thu ngân" };
const homeOf = (u: StaffUser) => (u.vaiTro === "QUANLY" ? "/quan-ly/thuc-don" : "/bep");

/* ====================== Đăng nhập nhân viên ====================== */
export function LoginScreen() {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!u.trim() || !p) { setError("Vui lòng nhập tên đăng nhập và mật khẩu"); return; }
    setBusy(true); setError("");
    try {
      const r = await api<{ token: string; user: StaffUser }>("/api/auth/login", { method: "POST", body: { tenDangNhap: u, matKhau: p } });
      if (r.user.vaiTro === "THUNGAN") { setError("Tài khoản thu ngân không có quyền vào trang quản trị"); return; }
      auth.save(r.token, r.user);
      navigate(homeOf(r.user));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể đăng nhập");
    } finally { setBusy(false); }
  };

  return (
    <div className="login-screen">
      <div className="login-art">
        <div className="art-copy">
          <span className="eyebrow light">Vận hành thông minh mỗi ngày</span>
          <h2>Món ngon đúng hẹn,<br />trải nghiệm trọn vẹn.</h2>
          <p>Quản lý bếp, thực đơn và doanh thu trên cùng một hệ thống.</p>
        </div>
        <div className="pizza-orbit"><span>🍕</span></div>
      </div>
      <div className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <button type="button" className="logo-large logo-button" onClick={() => navigate("/")}><span>🍕</span> Pizza <b>Self-Order</b></button>
          <div className="login-heading">
            <span className="eyebrow">Dành cho nhân viên</span>
            <h1>Chào mừng trở lại</h1>
            <p>Đăng nhập để bắt đầu ca làm việc của bạn.</p>
          </div>
          {error && <Alert tone="error" title="Không thể đăng nhập">{error}</Alert>}
          <Field label="Tên đăng nhập" value={u} onChange={setU} autoFocus />
          <Field label="Mật khẩu" value={p} onChange={setP} type="password" />
          <Button className="wide" type="submit" icon="arrow" loading={busy}>Đăng nhập</Button>
          <div className="support">Tài khoản mẫu: <b>quanly</b> / <b>bep</b> – mật khẩu <b>123456</b></div>
        </form>
      </div>
    </div>
  );
}

/* ====================== Khung trang nhân viên ====================== */
function useStaff(roles: StaffUser["vaiTro"][]) {
  const user = auth.user;
  const ok = !!user && !!auth.token;
  useEffect(() => { if (!ok) navigate("/dang-nhap"); }, [ok]);
  return { user, allowed: ok && roles.includes(user!.vaiTro) };
}

function handleAuthError(e: unknown) {
  if (e instanceof ApiError && e.status === 401) { auth.clear(); navigate("/dang-nhap"); return true; }
  return false;
}

function StaffShell({ active, children }: { active: "kitchen" | "manage" | "report"; children: ReactNode }) {
  const user = auth.user!;
  const logout = async () => { await api("/api/auth/logout", { method: "POST" }).catch(() => null); auth.clear(); navigate("/dang-nhap"); };
  const initials = user.hoTen.split(" ").slice(-2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div className="staff-shell">
      <aside className="staff-sidebar">
        <div className="logo-large"><span>🍕</span><div>Pizza<b>Self-Order</b></div></div>
        <nav>
          <small>VẬN HÀNH</small>
          <button className={active === "kitchen" ? "active" : ""} onClick={() => navigate("/bep")}><Icon name="clock" />Màn hình bếp</button>
          {user.vaiTro === "QUANLY" && <>
            <small>QUẢN LÝ</small>
            <button className={active === "manage" ? "active" : ""} onClick={() => navigate("/quan-ly/thuc-don")}><Icon name="menu" />Thực đơn</button>
            <button className={active === "report" ? "active" : ""} onClick={() => navigate("/quan-ly/bao-cao")}><Icon name="chart" />Báo cáo</button>
          </>}
        </nav>
        <div className="staff-profile"><div className="avatar">{initials}</div><span><b>{user.hoTen}</b><small>{ROLE_TEXT[user.vaiTro]}</small></span><button onClick={logout} title="Đăng xuất" aria-label="Đăng xuất"><Icon name="logout" size={18} /></button></div>
      </aside>
      <div className="staff-main">{children}</div>
    </div>
  );
}

function StaffHeader({ title, subtitle, action, bell }: { title: string; subtitle: string; action?: ReactNode; bell?: ReactNode }) {
  const now = new Date();
  return (
    <header className="staff-header">
      <div><h1>{title}</h1><p>{subtitle}</p></div>
      <div className="staff-header-actions">{action}{bell}<div className="date-box"><small>Hôm nay</small><b>{now.getDate()} tháng {String(now.getMonth() + 1).padStart(2, "0")}, {now.getFullYear()}</b></div></div>
    </header>
  );
}

function Forbidden() {
  return <div className="staff-content"><div className="empty-state"><div className="empty-icon"><Icon name="close" size={28} /></div><h2>Bạn không có quyền thực hiện chức năng này</h2><p>Chức năng chỉ dành cho tài khoản Quản lý nhà hàng.</p><Button variant="secondary" onClick={() => navigate("/bep")}>Về màn hình bếp</Button></div></div>;
}

/* ====================== Màn hình bếp ====================== */
type Notification = { id: string; type: string; message: string; time: string };
const NEXT_ACTION: Record<string, string> = {
  CHO_CHE_BIEN: "Bắt đầu làm",
  CHUAN_BI_NGUYEN_LIEU: "Đưa vào lò nướng",
  DANG_NUONG: "Hoàn thành",
  HOAN_THANH: "Đã phục vụ",
};
const REASONS = ["Hết nguyên liệu", "Thiết bị gặp sự cố", "Yêu cầu không phù hợp"];

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.18].forEach((t) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = 880; g.gain.value = 0.15;
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.12);
    });
  } catch { /* trình duyệt chặn âm thanh */ }
}

export function KitchenScreen() {
  const { allowed } = useStaff(["BEP", "QUANLY"]);
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState({ daXong: 0, daHuy: 0 });
  const [notes, setNotes] = useState<Notification[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string>("");
  const [reject, setReject] = useState<Order | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const known = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ orders: Order[]; stats: { daXong: number; daHuy: number }; notifications: Notification[] }>("/api/kitchen/orders");
      const waiting = r.orders.filter((o) => o.trangThai === "CHO_CHE_BIEN").map((o) => o.maDon + o.items.length);
      if (known.current && waiting.some((k) => !known.current!.has(k))) { beep(); toast("Có đơn hàng mới!", "info"); }
      known.current = new Set(waiting);
      setOrders(r.orders); setStats(r.stats); setNotes(r.notifications); setError(""); setLoaded(true);
    } catch (e) {
      if (!handleAuthError(e)) setError(e instanceof ApiError ? e.message : "Mất kết nối");
    }
  }, [toast]);
  usePolling(() => { if (allowed) load(); }, 2000, [allowed]);

  const advance = async (o: Order) => {
    setBusy(o.maDon);
    try {
      await api(`/api/kitchen/orders/${o.maDon}/advance`, { method: "POST", body: { from: o.trangThai } });
      await load();
    } catch (e) {
      if (!handleAuthError(e)) toast(e instanceof ApiError ? e.message : "Cập nhật thất bại, vui lòng thử lại", "error");
    } finally { setBusy(""); }
  };

  if (!auth.user) return null;
  const cols = [
    { title: "Chờ chế biến", tone: "waiting", list: orders.filter((o) => o.trangThai === "CHO_CHE_BIEN") },
    { title: "Đang làm", tone: "doing", list: orders.filter((o) => ["CHUAN_BI_NGUYEN_LIEU", "DANG_NUONG"].includes(o.trangThai)) },
    { title: "Hoàn thành", tone: "done", list: orders.filter((o) => o.trangThai === "HOAN_THANH") },
  ];
  const bell = (
    <div className="bell-wrap">
      <button className="notification" onClick={() => setShowNotes(!showNotes)} aria-label="Thông báo"><Icon name="bell" size={18} />{notes.length > 0 && <i>{notes.length}</i>}</button>
      {showNotes && <div className="notes-pop">{notes.length ? notes.map((n) => <div key={n.id}><Badge tone={n.type === "CALL" ? "warning" : "danger"}>{n.type === "CALL" ? "Gọi phục vụ" : "Không chế biến"}</Badge><p>{n.message}</p><small>{new Date(n.time).toLocaleTimeString("vi-VN")}</small></div>) : <p className="muted">Chưa có thông báo</p>}</div>}
    </div>
  );

  return (
    <StaffShell active="kitchen">
      <StaffHeader title="Màn hình bếp" subtitle="Theo dõi và cập nhật trạng thái đơn hàng theo thời gian thực" bell={bell}
        action={<div className={`live-status ${error ? "offline" : ""}`}><span /> {error ? "Mất kết nối – đang thử lại" : "Đang trực tuyến"}</div>} />
      <main className="staff-content kitchen-content">
        <div className="kitchen-toolbar">
          <div className="shift-info"><span>Đơn đang xử lý</span><b>{orders.length} đơn</b></div>
          <div className="kitchen-kpis"><span><b>{cols[0].list.length}</b> Đơn đang chờ</span><span><b>{stats.daXong}</b> Đã phục vụ hôm nay</span><span><b>{stats.daHuy}</b> Đơn bị hủy</span></div>
          <Button variant="secondary" icon="refresh" onClick={load}>Làm mới</Button>
        </div>
        {!loaded && !error ? <div className="loading-page"><span className="spinner" />Đang tải đơn hàng…</div> : (
          <div className="kanban">
            {cols.map((c) => (
              <section className={`kanban-column ${c.tone}`} key={c.title}>
                <div className="kanban-title"><span className="kanban-dot" /><h2>{c.title}</h2><b>{c.list.length}</b></div>
                <div className="ticket-stack">
                  {c.list.length === 0 && <div className="ticket-empty">Không có đơn</div>}
                  {c.list.map((o) => {
                    const age = minutesAgo(o.thoiGianDat);
                    const active = o.items.filter((i) => i.trangThai !== "DA_HUY");
                    return (
                      <article className="order-ticket" key={o.maDon}>
                        <div className="ticket-head"><div><span>Bàn {o.soBan}</span><b>#{o.maDon}</b></div><Badge tone={age >= 15 && c.tone !== "done" ? "danger" : c.tone === "done" ? "success" : "neutral"}><Icon name="clock" size={13} /> {age} phút</Badge></div>
                        <div className="ticket-time">Đặt lúc {clock(o.thoiGianDat)} · <b>{o.trangThaiText}</b></div>
                        <ul>{o.items.map((i) => <li key={i.maCT} className={i.trangThai === "DA_HUY" ? "struck" : i.trangThai === "DA_PHUC_VU" ? "served" : ""}>
                          {i.soLuong} × {i.tenMon}{i.kichThuoc ? ` (${i.kichThuoc}, vỏ ${i.vo?.toLowerCase()})` : ""}
                          {i.thanhPhanThem.length > 0 && <small> + {i.thanhPhanThem.join(", ")}</small>}
                          {i.trangThai === "DA_HUY" && <small className="reject-note"> – {i.ghiChu}</small>}
                        </li>)}</ul>
                        {active.some((i) => i.ghiChu && i.trangThai !== "DA_HUY") && <div className="ticket-note">Ghi chú: <b>{active.filter((i) => i.ghiChu).map((i) => i.ghiChu).join("; ")}</b></div>}
                        <div className="ticket-actions">
                          <Button variant={c.tone === "done" ? "secondary" : "primary"} onClick={() => advance(o)} icon="arrow" loading={busy === o.maDon}>{NEXT_ACTION[o.trangThai]}</Button>
                          {c.tone !== "done" && <button className="reject-order" onClick={() => setReject(o)}>Không thể chế biến</button>}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
      {reject && <RejectDialog order={reject} onClose={() => setReject(null)} onDone={() => { setReject(null); load(); toast("Đã báo không thể chế biến cho khách và quản lý"); }} />}
    </StaffShell>
  );
}

function RejectDialog({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: () => void }) {
  const items = order.items.filter((i) => !["HOAN_THANH", "DA_PHUC_VU", "DA_HUY"].includes(i.trangThai));
  const [maCT, setMaCT] = useState<string>("");
  const [lyDo, setLyDo] = useState("");
  const [ghiChu, setGhiChu] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!lyDo) { setError("Vui lòng chọn lý do không thể chế biến"); return; }
    setBusy(true);
    try {
      await api(`/api/kitchen/orders/${order.maDon}/reject`, { method: "POST", body: { maCT: maCT ? Number(maCT) : null, lyDo, ghiChu } });
      onDone();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Thao tác thất bại"); } finally { setBusy(false); }
  };
  return (
    <Modal title="Không thể chế biến món" onClose={onClose}>
      <p>Đơn #{order.maDon} · Bàn {order.soBan}. Chọn lý do để khách và quản lý được thông báo.</p>
      <div className="dialog-fields">
        <label className="field"><span>Món không thể chế biến</span><select value={maCT} onChange={(e) => setMaCT(e.target.value)}><option value="">Tất cả món chưa hoàn thành ({items.length})</option>{items.map((i) => <option key={i.maCT} value={i.maCT}>{i.soLuong} × {i.tenMon}{i.kichThuoc ? ` (${i.kichThuoc})` : ""}</option>)}</select></label>
        <label className="field"><span>Lý do</span><select value={lyDo} onChange={(e) => { setLyDo(e.target.value); setError(""); }} className={error ? "input-error" : ""}><option value="">— Chọn lý do —</option>{REASONS.map((r) => <option key={r}>{r}</option>)}</select>{error && <small className="field-error">{error}</small>}</label>
        <Field label="Ghi chú thêm" value={ghiChu} onChange={setGhiChu} placeholder="Nhập thông tin chi tiết…" maxLength={100} />
      </div>
      <div className="modal-actions"><Button variant="secondary" onClick={onClose}>Quay lại</Button><Button variant="danger" onClick={submit} loading={busy}>Xác nhận báo lỗi</Button></div>
    </Modal>
  );
}

/* ====================== Quản lý thực đơn và giá bán ====================== */
type DishForm = {
  maMon?: string; tenMon: string; phanLoai: "Làm sẵn" | "Tự làm" | "NUOC"; moTa: string; hinhAnh: string;
  giaS: string; giaM: string; giaL: string; donGia: string; dungTich: string; dangBan: boolean; thanhPhan: string[];
};
const emptyForm: DishForm = { tenMon: "", phanLoai: "Làm sẵn", moTa: "", hinhAnh: "", giaS: "", giaM: "", giaL: "", donGia: "", dungTich: "", dangBan: true, thanhPhan: [] };

export function ManageScreen() {
  const { allowed } = useStaff(["QUANLY"]);
  const toast = useToast();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("Tất cả");
  const [status, setStatus] = useState("all");
  const [form, setForm] = useState<DishForm | null>(null);
  const [del, setDel] = useState<MenuItem | null>(null);

  const load = useCallback(async () => {
    try { setMenu(await api<Menu>("/api/admin/dishes")); setError(""); }
    catch (e) { if (!handleAuthError(e)) setError(e instanceof ApiError ? e.message : "Không thể tải dữ liệu"); }
  }, []);
  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  if (!auth.user) return null;
  if (!allowed) return <StaffShell active="manage"><StaffHeader title="Quản lý thực đơn" subtitle="Cập nhật món ăn, giá bán và trạng thái phục vụ" /><Forbidden /></StaffShell>;

  const items = (menu?.items || []).filter((i) =>
    (type === "Tất cả" || (type === "Pizza" ? i.loaiMon === "PIZZA" : i.loaiMon === "NUOC"))
    && (status === "all" || (status === "on" ? i.dangBan : !i.dangBan))
    && i.tenMon.toLowerCase().includes(search.trim().toLowerCase()));
  const count = (t: string) => (menu?.items || []).filter((i) => t === "Tất cả" || (t === "Pizza" ? i.loaiMon === "PIZZA" : i.loaiMon === "NUOC")).length;

  const toggleStatus = async (i: MenuItem) => {
    try { const r = await api<{ message: string }>(`/api/admin/dishes/${i.maMon}/status`, { method: "PATCH", body: { dangBan: !i.dangBan } }); toast(r.message); load(); }
    catch (e) { if (!handleAuthError(e)) toast(e instanceof ApiError ? e.message : "Thao tác thất bại", "error"); }
  };
  const edit = (i: MenuItem) => setForm({
    maMon: i.maMon, tenMon: i.tenMon, phanLoai: i.loaiMon === "NUOC" ? "NUOC" : (i.loaiBanh as "Làm sẵn" | "Tự làm"),
    moTa: i.moTa || "", hinhAnh: i.hinhAnh || "",
    giaS: String(i.gia?.S ?? ""), giaM: String(i.gia?.M ?? ""), giaL: String(i.gia?.L ?? ""),
    donGia: String(i.donGia ?? ""), dungTich: String(i.dungTich ?? ""), dangBan: i.dangBan,
    thanhPhan: (menu?.toppings || []).filter((t) => i.thanhPhan.includes(t.tenTP)).map((t) => t.maTP),
  });

  return (
    <StaffShell active="manage">
      <StaffHeader title="Quản lý thực đơn" subtitle="Cập nhật món ăn, giá bán và trạng thái phục vụ" action={<Button onClick={() => setForm({ ...emptyForm })} icon="plus">Thêm món</Button>} />
      <main className="staff-content manage-content">
        {error && <Alert tone="error" title={error} />}
        <div className="table-toolbar">
          <label className="search-box compact"><Icon name="search" /><input placeholder="Tìm kiếm món…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
          <div className="filter-chips">{["Tất cả", "Pizza", "Nước uống"].map((t) => <button key={t} className={type === t ? "active" : ""} onClick={() => setType(t)}>{t} <span>{count(t)}</span></button>)}</div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Lọc trạng thái"><option value="all">Tất cả trạng thái</option><option value="on">Đang bán</option><option value="off">Ngừng bán</option></select>
        </div>
        <div className="data-table">
          <div className="table-head"><span>MÓN ĂN</span><span>PHÂN LOẠI</span><span>GIÁ BÁN (NHỎ / TRUNG / LỚN)</span><span>TRẠNG THÁI</span><span>THAO TÁC</span></div>
          {!menu && !error && <div className="table-row"><span className="muted">Đang tải…</span></div>}
          {menu && items.length === 0 && <div className="table-empty">Không có món phù hợp</div>}
          {items.map((i) => (
            <div className="table-row" key={i.maMon}>
              <div className="dish-cell"><FoodImage src={i.hinhAnh} alt={i.tenMon} drink={i.loaiMon === "NUOC"} /><span><b>{i.tenMon}</b><small>Mã món: {i.maMon}{i.tamHet ? " · Tạm hết nguyên liệu" : ""}</small></span></div>
              <span><Badge tone={i.loaiBanh === "Tự làm" ? "warning" : i.loaiMon === "NUOC" ? "neutral" : "success"}>{i.loaiMon === "NUOC" ? "Nước uống" : `Pizza ${i.loaiBanh?.toLowerCase()}`}</Badge></span>
              <span className="price-cell">{i.loaiMon === "PIZZA" ? ["S", "M", "L"].map((k) => (i.gia?.[k] || 0).toLocaleString("vi-VN")).join(" / ") : money(i.donGia || 0)}</span>
              <span><Badge tone={i.dangBan ? "success" : "danger"}>{i.dangBan ? "Đang bán" : "Ngừng bán"}</Badge></span>
              <div className="row-actions">
                <button title="Sửa" aria-label="Sửa" onClick={() => edit(i)}><Icon name="edit" size={18} /></button>
                <button title={i.dangBan ? "Ngừng bán" : "Mở bán"} aria-label={i.dangBan ? "Ngừng bán" : "Mở bán"} onClick={() => toggleStatus(i)}><Icon name={i.dangBan ? "eye" : "check"} size={18} /></button>
                <button title="Xóa" aria-label="Xóa" onClick={() => setDel(i)}><Icon name="trash" size={18} /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="table-pagination"><span>Hiển thị {items.length} trong {menu?.items.length || 0} món</span></div>
      </main>
      {form && menu && <DishDrawer form={form} menu={menu} onClose={() => setForm(null)} onSaved={(m) => { setForm(null); toast(m); load(); }} />}
      {del && <DeleteDialog dish={del} onClose={() => setDel(null)} onDone={(m, ok) => { setDel(null); toast(m, ok ? "success" : "error"); load(); }} />}
    </StaffShell>
  );
}

function DeleteDialog({ dish, onClose, onDone }: { dish: MenuItem; onClose: () => void; onDone: (m: string, ok: boolean) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { const r = await api<{ message: string }>(`/api/admin/dishes/${dish.maMon}`, { method: "DELETE" }); onDone(r.message, true); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Không thể xóa"); } finally { setBusy(false); }
  };
  const stop = async () => {
    await api(`/api/admin/dishes/${dish.maMon}/status`, { method: "PATCH", body: { dangBan: false } }).catch(() => null);
    onDone("Món đã chuyển sang Ngừng bán", true);
  };
  return (
    <Modal title={`Xóa “${dish.tenMon}”?`} onClose={onClose}>
      <p>Món sẽ bị xóa vĩnh viễn khỏi thực đơn. Món đã có trong đơn hàng chỉ có thể chuyển sang “Ngừng bán”.</p>
      {error && <Alert tone="error" title="Không thể xóa">{error}</Alert>}
      <div className="modal-actions"><Button variant="secondary" onClick={onClose}>Hủy</Button>{error ? <Button onClick={stop}>Chuyển sang Ngừng bán</Button> : <Button variant="danger" onClick={go} loading={busy}>Xóa món</Button>}</div>
    </Modal>
  );
}

function DishDrawer({ form: initial, menu, onClose, onSaved }: { form: DishForm; menu: Menu; onClose: () => void; onSaved: (m: string) => void }) {
  const [f, setF] = useState<DishForm>(initial);
  const [errors, setErrors] = useState<{ name?: string; price?: string; general?: string }>({});
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{ tenKT: string; ngayApDung: string; giaBan: number }[]>([]);
  const isDrink = f.phanLoai === "NUOC";
  const set = (patch: Partial<DishForm>) => { setF({ ...f, ...patch }); setErrors({}); };

  useEffect(() => {
    if (initial.maMon && initial.phanLoai !== "NUOC") api<typeof history>(`/api/admin/dishes/${initial.maMon}/prices`).then(setHistory).catch(() => null);
  }, [initial.maMon, initial.phanLoai]);

  const save = async () => {
    // Kiểm tra phía giao diện trước khi gửi
    const e: typeof errors = {};
    if (!f.tenMon.trim()) e.name = "Vui lòng nhập tên món";
    const prices = isDrink ? [f.donGia] : [f.giaS, f.giaM, f.giaL];
    if (prices.some((p) => !p.trim())) e.price = "Vui lòng nhập giá bán";
    else if (prices.some((p) => !/^-?\d+$/.test(p.replace(/[.\s,]/g, "")))) e.price = "Giá phải là số";
    else if (prices.some((p) => Number(p.replace(/[.\s,]/g, "")) <= 0)) e.price = "Giá không hợp lệ";
    if (Object.keys(e).length) { setErrors(e); return; }

    setBusy(true);
    const body = {
      tenMon: f.tenMon, loaiMon: isDrink ? "NUOC" : "PIZZA", loaiBanh: isDrink ? null : f.phanLoai,
      moTa: f.moTa, hinhAnh: f.hinhAnh, dangBan: f.dangBan, thanhPhan: f.thanhPhan,
      gia: { S: f.giaS, M: f.giaM, L: f.giaL }, donGia: f.donGia, dungTich: f.dungTich,
    };
    try {
      const r = await api<{ message: string }>(f.maMon ? `/api/admin/dishes/${f.maMon}` : "/api/admin/dishes", { method: f.maMon ? "PUT" : "POST", body });
      onSaved(r.message);
    } catch (err) {
      if (err instanceof ApiError && err.code === "NAME") setErrors({ name: err.message });
      else if (err instanceof ApiError && err.code === "PRICE") setErrors({ price: err.message });
      else setErrors({ general: err instanceof ApiError ? err.message : "Lưu thất bại" });
    } finally { setBusy(false); }
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head"><div><span className="eyebrow">{f.maMon ? `Mã món ${f.maMon}` : "Món mới"}</span><h2>{f.maMon ? "Cập nhật món" : "Thêm món vào thực đơn"}</h2></div><button onClick={onClose} aria-label="Đóng"><Icon name="close" /></button></div>
        <div className="drawer-body">
          {errors.general && <Alert tone="error" title={errors.general} />}
          <div className="drawer-preview"><FoodImage src={f.hinhAnh || null} alt="Ảnh món" drink={isDrink} /></div>
          <Field label="Đường dẫn ảnh món ăn (URL)" value={f.hinhAnh} onChange={(v) => set({ hinhAnh: v })} placeholder="https://…" />
          <Field label="Tên món" value={f.tenMon} onChange={(v) => set({ tenMon: v })} error={errors.name} maxLength={100} />
          <label className="field"><span>Phân loại</span>
            <select value={f.phanLoai} disabled={!!f.maMon && (initial.phanLoai === "NUOC") !== isDrink} onChange={(e) => set({ phanLoai: e.target.value as DishForm["phanLoai"] })}>
              {(!f.maMon || initial.phanLoai !== "NUOC") && <><option value="Làm sẵn">Pizza làm sẵn</option><option value="Tự làm">Pizza tự làm</option></>}
              {(!f.maMon || initial.phanLoai === "NUOC") && <option value="NUOC">Nước uống</option>}
            </select>
          </label>
          {isDrink ? (
            <div className="form-row"><Field label="Giá bán (đ)" value={f.donGia} onChange={(v) => set({ donGia: v })} error={errors.price} inputMode="numeric" /><Field label="Dung tích (ml)" value={f.dungTich} onChange={(v) => set({ dungTich: v.replace(/\D/g, "") })} inputMode="numeric" /></div>
          ) : (
            <div className="price-grid">
              <Field label="Giá cỡ Nhỏ" value={f.giaS} onChange={(v) => set({ giaS: v })} inputMode="numeric" />
              <Field label="Giá cỡ Trung" value={f.giaM} onChange={(v) => set({ giaM: v })} inputMode="numeric" />
              <Field label="Giá cỡ Lớn" value={f.giaL} onChange={(v) => set({ giaL: v })} inputMode="numeric" />
              {errors.price && <small className="field-error span-3">{errors.price}</small>}
            </div>
          )}
          {f.phanLoai === "Làm sẵn" && !f.maMon && (
            <div className="field"><span>Thành phần cố định (luôn có sốt cà chua)</span><div className="chip-pick">{menu.toppings.map((t) => <button type="button" key={t.maTP} className={f.thanhPhan.includes(t.maTP) ? "active" : ""} onClick={() => set({ thanhPhan: f.thanhPhan.includes(t.maTP) ? f.thanhPhan.filter((x) => x !== t.maTP) : [...f.thanhPhan, t.maTP] })}>{t.tenTP}</button>)}</div></div>
          )}
          <label className="field"><span>Mô tả ngắn</span><textarea value={f.moTa} onChange={(e) => set({ moTa: e.target.value })} maxLength={500} /></label>
          <label className="switch-row"><span><b>Mở bán ngay</b><small>Món sẽ hiển thị trên thực đơn khách hàng</small></span><input type="checkbox" checked={f.dangBan} onChange={(e) => set({ dangBan: e.target.checked })} /></label>
          {history.length > 0 && (
            <div className="price-history"><b>Lịch sử giá</b>{history.slice(0, 9).map((h, i) => <p key={i}><span>{new Date(h.ngayApDung).toISOString().slice(0, 10).split("-").reverse().join("/")} · {h.tenKT}</span><span>{money(h.giaBan)}</span></p>)}<small>Thay đổi giá không ảnh hưởng đơn hàng đã xác nhận.</small></div>
          )}
        </div>
        <div className="drawer-actions"><Button variant="secondary" onClick={onClose}>Hủy</Button><Button onClick={save} loading={busy}>Lưu món</Button></div>
      </aside>
    </div>
  );
}

/* ====================== Báo cáo thống kê doanh thu ====================== */
type Report = {
  tuNgay: string; denNgay: string; hinhThuc: string | null; tongDoanhThu: number; soDon: number; tangTruong: number | null;
  theoNgay: { ngay: string; tong: number; soDon: number }[];
  theoHinhThuc: { hinhThuc: string; tong: number; soDon: number }[];
  monBanChay: { maMon: string; tenMon: string; hinhAnh: string | null; loaiMon: string; soLuong: number; doanhThu: number }[];
};
const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));

export function ReportScreen() {
  const { allowed } = useStaff(["QUANLY"]);
  const toast = useToast();
  const todayStr = localISODate();
  const [tu, setTu] = useState(localISODate(new Date(Date.now() - 6 * 86400000)));
  const [den, setDen] = useState(todayStr);
  const [ht, setHt] = useState("ALL");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const params = () => new URLSearchParams({ tuNgay: tu, denNgay: den, hinhThuc: ht }).toString();
  const load = async () => {
    setError("");
    if (!tu || !den) { setError("Vui lòng chọn đầy đủ khoảng thời gian"); return; }
    if (tu > den) { setError("Khoảng thời gian không hợp lệ"); return; }
    if (den > todayStr) { setError("Ngày kết thúc không được vượt quá ngày hiện tại"); return; }
    setBusy(true);
    try { setReport(await api<Report>(`/api/admin/reports?${params()}`)); }
    catch (e) { if (!handleAuthError(e)) setError(e instanceof ApiError ? e.message : "Không thể tạo báo cáo"); }
    finally { setBusy(false); }
  };
  useEffect(() => { if (allowed) load(); }, [allowed]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportCsv = async () => {
    try { await download(`/api/admin/reports/export?${params()}`); toast("Đã xuất báo cáo Excel (CSV)"); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Không thể xuất báo cáo", "error"); }
  };
  const exportPdf = () => {
    if (!report || !report.soDon) { toast("Không có dữ liệu để xuất báo cáo", "error"); return; }
    window.print();
  };

  if (!auth.user) return null;
  if (!allowed) return <StaffShell active="report"><StaffHeader title="Báo cáo doanh thu" subtitle="Tổng quan hiệu quả kinh doanh" /><Forbidden /></StaffShell>;

  const max = Math.max(1, ...(report?.theoNgay || []).map((d) => d.tong));
  const top = Math.ceil(max / 1e6) * 1e6 || 1e6;
  const cash = report?.theoHinhThuc.find((m) => m.hinhThuc === "TIEN_MAT");
  const card = report?.theoHinhThuc.find((m) => m.hinhThuc === "THE");
  const cashPct = report && report.tongDoanhThu ? ((cash?.tong || 0) / report.tongDoanhThu) * 100 : 0;
  const best = report?.monBanChay.find((m) => m.loaiMon === "PIZZA") || report?.monBanChay[0];
  const fmtD = (s: string) => s.split("-").reverse().slice(0, 2).join("/");
  const many = (report?.theoNgay.length || 0) > 16;

  return (
    <StaffShell active="report">
      <StaffHeader title="Báo cáo doanh thu" subtitle="Tổng quan hiệu quả kinh doanh và xu hướng bán hàng"
        action={<div className="export-actions no-print"><Button variant="secondary" icon="download" onClick={exportCsv}>Xuất Excel</Button><Button variant="secondary" icon="print" onClick={exportPdf}>Xuất PDF</Button></div>} />
      <main className="staff-content report-content print-area">
        <section className="report-filters no-print">
          <label className="field"><span>Từ ngày</span><input type="date" value={tu} onChange={(e) => setTu(e.target.value)} /></label>
          <label className="field"><span>Đến ngày</span><input type="date" value={den} onChange={(e) => setDen(e.target.value)} /></label>
          <label className="field"><span>Hình thức thanh toán</span><select value={ht} onChange={(e) => setHt(e.target.value)}><option value="ALL">Tất cả hình thức</option><option value="TIEN_MAT">Tiền mặt</option><option value="THE">Thẻ tín dụng</option></select></label>
          <Button onClick={load} loading={busy}>Xem báo cáo</Button>
        </section>
        {error && <div className="report-alert"><Alert tone="error" title={error} /></div>}
        <h2 className="print-only">Báo cáo doanh thu {report && `${fmtD(report.tuNgay)}/${report.tuNgay.slice(0, 4)} – ${fmtD(report.denNgay)}/${report.denNgay.slice(0, 4)}`}</h2>
        {report && !report.soDon ? (
          <div className="empty-state report-empty"><div className="empty-icon"><Icon name="chart" size={30} /></div><h2>Không có dữ liệu doanh thu</h2><p>Hãy thử thay đổi khoảng thời gian hoặc hình thức thanh toán.</p></div>
        ) : report && (
          <>
            <section className="kpi-grid">
              <Kpi label="Tổng doanh thu" value={money(report.tongDoanhThu)} change={report.tangTruong == null ? "—" : `${report.tangTruong >= 0 ? "+" : ""}${(report.tangTruong * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`} note="so với kỳ trước" tone="red" icon="chart" />
              <Kpi label="Số đơn" value={String(report.soDon)} change={`${Math.round(report.tongDoanhThu / report.soDon).toLocaleString("vi-VN")} đ`} note="trung bình mỗi đơn" tone="green" icon="cart" />
              <Kpi label="Món bán chạy nhất" value={best?.tenMon || "—"} change={`${best?.soLuong || 0} phần`} note={best ? `${((best.doanhThu / report.tongDoanhThu) * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}% doanh thu` : ""} tone="yellow" icon="menu" />
            </section>
            <section className="charts-grid">
              <div className="chart-card revenue-chart">
                <div className="chart-title"><div><h2>Doanh thu theo ngày</h2><p>{fmtD(report.tuNgay)} – {fmtD(report.denNgay)}</p></div>{report.tangTruong != null && <Badge tone={report.tangTruong >= 0 ? "success" : "danger"}>{report.tangTruong >= 0 ? "+" : ""}{(report.tangTruong * 100).toFixed(1)}% so với kỳ trước</Badge>}</div>
                <div className="bar-chart">
                  <div className="y-axis">{[1, 0.75, 0.5, 0.25, 0].map((r) => <span key={r}>{short(top * r)}</span>)}</div>
                  <div className={`bars ${many ? "dense" : ""}`}>{report.theoNgay.map((d) => (
                    <div className="bar-wrap" key={d.ngay} title={`${fmtD(d.ngay)}: ${money(d.tong)} (${d.soDon} đơn)`}>
                      <div className="bar-value">{d.tong === max && !many ? short(d.tong) : ""}</div>
                      <div className={`bar ${d.tong === max ? "highlight" : ""}`} style={{ height: `${(d.tong / top) * 100}%` }} />
                      <span>{many ? d.ngay.slice(8) : fmtD(d.ngay)}</span>
                    </div>
                  ))}</div>
                </div>
              </div>
              <div className="chart-card donut-card">
                <div className="chart-title"><div><h2>Hình thức thanh toán</h2><p>Tỷ trọng theo doanh thu</p></div></div>
                <div className="donut-wrap"><div className="donut" style={{ background: `conic-gradient(var(--red) 0 ${cashPct}%, var(--yellow) ${cashPct}% 100%)` }}><div><strong>{short(report.tongDoanhThu)}</strong><small>Tổng</small></div></div></div>
                <div className="donut-legend">
                  <div><span className="legend-dot cash" /><span>Tiền mặt<small>{cash?.soDon || 0} đơn</small></span><b>{cashPct.toFixed(1)}%</b></div>
                  <div><span className="legend-dot credit" /><span>Thẻ tín dụng<small>{card?.soDon || 0} đơn</small></span><b>{(report.tongDoanhThu ? 100 - cashPct : 0).toFixed(1)}%</b></div>
                </div>
              </div>
            </section>
            <section className="top-products">
              <div className="chart-title"><div><h2>Món ăn nổi bật</h2><p>Xếp hạng theo doanh thu</p></div></div>
              <div className="product-ranking">{report.monBanChay.slice(0, 3).map((m, i) => (
                <div key={m.maMon}><span className="rank">0{i + 1}</span><FoodImage src={m.hinhAnh} alt={m.tenMon} drink={m.loaiMon === "NUOC"} /><span><b>{m.tenMon}</b><small>{m.soLuong} phần đã bán</small></span><div className="mini-progress"><i style={{ width: `${(m.doanhThu / report.monBanChay[0].doanhThu) * 100}%` }} /></div><strong>{money(m.doanhThu)}</strong></div>
              ))}</div>
            </section>
          </>
        )}
      </main>
    </StaffShell>
  );
}

function Kpi({ label, value, change, note, tone, icon }: { label: string; value: string; change: string; note: string; tone: string; icon: "chart" | "cart" | "menu" }) {
  return <article className={`kpi-card ${tone}`}><div className="kpi-icon"><Icon name={icon} /></div><div><span>{label}</span><h2>{value}</h2><p><b>{change}</b> {note}</p></div></article>;
}

export { homeOf };
