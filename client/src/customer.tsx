// Màn hình cảm ứng tại bàn ăn (Khách hàng)
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, clock, dateText, money, type Menu, type MenuItem, type Order } from "./api";
import { linePrice, lineDetails, navigate, useCart, type CartLine } from "./store";
import { Alert, Badge, Button, Field, FoodImage, Icon, Modal, Stepper, useToast, usePolling } from "./ui";

const MAX_PIZZA = 10;
const MAX_DRINK = 20;

type Ctx = {
  soBan: number;
  menu: Menu;
  order: Order | null;
  lastOrder: Order | null;
  online: boolean;
  refreshOrder: () => Promise<void>;
};

export function CustomerApp({ soBan, sub, param, query }: { soBan: number; sub: string; param?: string; query: URLSearchParams }) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [menuError, setMenuError] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [online, setOnline] = useState(true);
  const [tableOk, setTableOk] = useState<boolean | null>(null);

  const loadMenu = useCallback(() => {
    setMenuError(false);
    api<Menu>("/api/menu").then(setMenu).catch(() => setMenuError(true));
  }, []);
  useEffect(() => {
    loadMenu();
    api(`/api/tables/${soBan}`).then(() => setTableOk(true)).catch((e) => setTableOk(e instanceof ApiError && e.status === 404 ? false : true));
  }, [soBan, loadMenu]);

  const refreshOrder = useCallback(async () => {
    try {
      const r = await api<{ order: Order | null; lastOrder?: Order | null }>(`/api/tables/${soBan}/order`);
      setOrder(r.order);
      setLastOrder(r.lastOrder || null);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, [soBan]);
  // Trạng thái chế biến được cập nhật mỗi 3 giây (yêu cầu độ trễ ≤ 5 giây)
  usePolling(refreshOrder, 3000, [soBan]);

  if (tableOk === false) {
    return <div className="customer-screen"><div className="empty-page"><div className="empty-plate"><Icon name="close" size={36} /></div><h1>Không tìm thấy bàn số {soBan}</h1><p>Vui lòng liên hệ nhân viên để được hỗ trợ.</p><Button onClick={() => navigate("/")}>Về trang chính</Button></div></div>;
  }
  if (menuError) {
    return <div className="customer-screen"><TopBar soBan={soBan} /><div className="empty-page"><div className="empty-plate"><Icon name="refresh" size={36} /></div><h1>Không thể tải thực đơn, vui lòng thử lại</h1><p>Kết nối đến máy chủ đang gặp sự cố.</p><Button onClick={loadMenu} icon="refresh">Thử lại</Button></div></div>;
  }
  if (!menu) return <div className="customer-screen"><TopBar soBan={soBan} /><div className="loading-page"><span className="spinner" />Đang tải thực đơn…</div></div>;

  const ctx: Ctx = { soBan, menu, order, lastOrder, online, refreshOrder };
  switch (sub) {
    case "tuy-chinh": return <CustomizeScreen ctx={ctx} maMon={param || ""} editKey={query.get("sua") || undefined} />;
    case "don-hang": return <CartScreen ctx={ctx} />;
    case "theo-doi": return <TrackingScreen ctx={ctx} />;
    case "thanh-toan": return <PaymentScreen ctx={ctx} />;
    default: return <MenuScreen ctx={ctx} combo={query.get("combo") === "1"} />;
  }
}

function TopBar({ soBan, onCart }: { soBan: number; onCart?: () => void }) {
  const { count } = useCart(soBan);
  return (
    <header className="topbar">
      <button className="brand" onClick={() => navigate(`/ban/${soBan}`)} aria-label="Về thực đơn">
        <span className="brand-mark">🍕</span><span>Pizza <b>Self-Order</b></span>
      </button>
      <div className="top-actions">
        <button className="track-link" onClick={() => navigate(`/ban/${soBan}/theo-doi`)}><Icon name="clock" size={18} />Đơn của bàn</button>
        <div className="table-pill"><span className="live-dot" />Bàn {soBan}</div>
        <button className="cart-button" onClick={onCart || (() => navigate(`/ban/${soBan}/don-hang`))} aria-label="Mở đơn hàng">
          <Icon name="cart" size={24} />
          {count > 0 && <span className="cart-badge">{count}</span>}
        </button>
      </div>
    </header>
  );
}

/* ====================== Xem thực đơn ====================== */
const CATEGORIES = ["Tất cả", "Bánh làm sẵn", "Bánh tự làm", "Nước uống"] as const;

function MenuScreen({ ctx, combo }: { ctx: Ctx; combo: boolean }) {
  const { menu, soBan } = ctx;
  const toast = useToast();
  const cart = useCart(soBan);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>(combo ? "Nước uống" : "Tất cả");
  const [comboMode, setComboMode] = useState(combo);
  const [drink, setDrink] = useState<MenuItem | null>(null);

  useEffect(() => { if (combo) { setComboMode(true); setCategory("Nước uống"); } }, [combo]);

  const match = (i: MenuItem, c: string) =>
    c === "Tất cả" || (c === "Nước uống" ? i.loaiMon === "NUOC" : i.loaiBanh === (c === "Bánh làm sẵn" ? "Làm sẵn" : "Tự làm"));
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
  const visible = menu.items.filter((i) => match(i, category) && norm(`${i.tenMon} ${i.moTa || ""}`).includes(norm(query.trim())));
  const hasPizza = cart.lines.some((l) => menu.items.find((i) => i.maMon === l.maMon)?.loaiMon === "PIZZA")
    || !!ctx.order?.items.some((i) => i.loaiMon === "PIZZA" && i.trangThai !== "DA_HUY");

  const choose = (item: MenuItem) => {
    if (item.tamHet) { toast("Món này tạm hết, vui lòng chọn món khác", "error"); return; }
    if (item.loaiMon === "PIZZA") navigate(`/ban/${soBan}/tuy-chinh/${item.maMon}`);
    else setDrink(item);
  };

  return (
    <div className="customer-screen">
      <TopBar soBan={soBan} />
      <main className="menu-content">
        <div className="page-intro">
          <div><span className="eyebrow">Hôm nay bạn muốn ăn gì?</span><h1>Thực đơn</h1></div>
          <label className="search-box"><Icon name="search" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm món…" aria-label="Tìm món" />{query && <button className="clear-search" onClick={() => setQuery("")} aria-label="Xóa từ khóa"><Icon name="close" size={16} /></button>}</label>
        </div>
        {comboMode && hasPizza && (
          <div className="combo-banner"><span className="combo-icon">🥤</span><div><b>Đang áp dụng giá combo Pizza + Nước uống</b><p>Mỗi phần nước uống được giảm {money(menu.comboDiscount)}.</p></div><button onClick={() => setComboMode(false)}>Tắt combo</button></div>
        )}
        <div className="category-row" role="tablist">
          {CATEGORIES.map((c) => <button key={c} role="tab" aria-selected={category === c} className={category === c ? "active" : ""} onClick={() => setCategory(c)}>{c}<span>{menu.items.filter((i) => match(i, c)).length}</span></button>)}
        </div>
        {menu.items.length === 0 ? (
          <div className="empty-state"><div className="empty-icon"><Icon name="menu" size={28} /></div><h2>Thực đơn đang được cập nhật</h2><p>Vui lòng quay lại sau ít phút hoặc gọi nhân viên hỗ trợ.</p></div>
        ) : visible.length ? (
          <div className="food-grid">
            {visible.map((item) => {
              const comboPrice = item.loaiMon === "NUOC" && comboMode && hasPizza;
              return (
                <article className={`food-card ${item.tamHet ? "sold" : ""}`} key={item.maMon} onClick={() => choose(item)}>
                  <div className="food-image"><FoodImage src={item.hinhAnh} alt={item.tenMon} drink={item.loaiMon === "NUOC"} />{item.tamHet && <div className="sold-overlay"><Badge tone="danger">Tạm hết</Badge></div>}</div>
                  <div className="food-info">
                    <Badge tone={item.loaiMon === "NUOC" ? "neutral" : item.loaiBanh === "Tự làm" ? "warning" : "success"}>{item.loaiMon === "NUOC" ? "Nước uống" : item.loaiBanh}</Badge>
                    <h3>{item.tenMon}</h3><p>{item.moTa}</p>
                    <div className="food-bottom">
                      <div><small>{item.loaiMon === "PIZZA" ? "Giá từ" : comboPrice ? "Giá combo" : "Giá"}</small>
                        <strong>{comboPrice ? <><s>{money(item.giaTu)}</s> {money(item.giaTu - menu.comboDiscount)}</> : money(item.giaTu)}</strong></div>
                      <Button disabled={item.tamHet} icon={item.loaiMon === "PIZZA" ? "chevron" : "plus"}>{item.loaiMon === "PIZZA" ? "Chọn" : "Thêm"}</Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : <div className="empty-state"><div className="empty-icon"><Icon name="search" size={28} /></div><h2>Không tìm thấy món phù hợp</h2><p>Thử tìm kiếm với từ khóa khác hoặc xem toàn bộ thực đơn.</p><Button variant="secondary" onClick={() => { setQuery(""); setCategory("Tất cả"); }}>Xem tất cả món</Button></div>}
      </main>
      {drink && <DrinkDialog ctx={ctx} item={drink} combo={comboMode && hasPizza} onClose={() => setDrink(null)} />}
    </div>
  );
}

/* ====================== Đặt nước uống đi kèm ====================== */
function DrinkDialog({ ctx, item, combo, onClose }: { ctx: Ctx; item: MenuItem; combo: boolean; onClose: () => void }) {
  const cart = useCart(ctx.soBan);
  const toast = useToast();
  const [qty, setQty] = useState(1);
  const [raw, setRaw] = useState("1");
  const [error, setError] = useState("");
  const price = (item.donGia || 0) - (combo ? ctx.menu.comboDiscount : 0);

  const setFromInput = (v: string) => {
    setRaw(v);
    const n = Number(v);
    if (!/^\d+$/.test(v) || n < 1) { setError("Số lượng không hợp lệ, vui lòng nhập lại"); return; }
    if (n > MAX_DRINK) { setError(`Tối đa ${MAX_DRINK} phần mỗi loại`); setQty(MAX_DRINK); return; }
    setError(""); setQty(n);
  };
  const add = () => {
    if (error && !/Tối đa/.test(error)) return;
    const existing = cart.lines.find((l) => l.maMon === item.maMon && !!l.combo === combo);
    if (existing) {
      const n = Math.min(MAX_DRINK, existing.soLuong + qty);
      if (existing.soLuong + qty > MAX_DRINK) toast(`Tối đa ${MAX_DRINK} phần mỗi loại`, "error");
      cart.update(existing.key, { soLuong: n });
    } else cart.add({ maMon: item.maMon, soLuong: qty, combo });
    toast(`Đã thêm ${qty} × ${item.tenMon} vào đơn`);
    onClose();
  };
  return (
    <Modal title={item.tenMon} onClose={onClose} symbol="🥤">
      <p>{item.moTa}{item.dungTich ? ` · ${item.dungTich} ml` : ""}</p>
      <div className="drink-row">
        <div><small>{combo ? "Giá combo" : "Đơn giá"}</small><strong>{money(price)}</strong></div>
        <Stepper value={qty} onChange={(v) => { setQty(v); setRaw(String(v)); setError(""); }} max={MAX_DRINK} onLimit={() => setError(`Tối đa ${MAX_DRINK} phần mỗi loại`)} />
      </div>
      <Field label="Hoặc nhập số lượng" value={raw} onChange={setFromInput} inputMode="numeric" error={error} />
      <div className="confirm-order"><span>Thành tiền</span><b>{money(price * qty)}</b></div>
      <div className="modal-actions"><Button variant="secondary" onClick={onClose}>Hủy</Button><Button onClick={add} icon="cart">Thêm vào đơn</Button></div>
    </Modal>
  );
}

/* ====================== Chọn loại bánh + Tùy chỉnh đặc tính bánh ====================== */
function CustomizeScreen({ ctx, maMon, editKey }: { ctx: Ctx; maMon: string; editKey?: string }) {
  const { menu, soBan } = ctx;
  const cart = useCart(soBan);
  const toast = useToast();
  const editing = editKey ? cart.lines.find((l) => l.key === editKey) : undefined;
  const pizzas = menu.items.filter((i) => i.loaiMon === "PIZZA");
  const [dishId, setDishId] = useState(editing?.maMon || maMon);
  const dish = pizzas.find((p) => p.maMon === dishId);
  const [crust, setCrust] = useState(editing?.maVo || menu.crusts[0]?.maVo || "");
  const [size, setSize] = useState(editing?.maKT || "M");
  const [toppings, setToppings] = useState<string[]>(editing?.thanhPhan || []);
  const [qty, setQty] = useState(editing?.soLuong || 1);
  const [error, setError] = useState("");
  const [comboAsk, setComboAsk] = useState(false);

  if (!dish) {
    return <div className="customer-screen"><TopBar soBan={soBan} /><div className="empty-page"><div className="empty-plate">🍕</div><h1>Món này không còn trên thực đơn</h1><p>Vui lòng chọn món khác.</p><Button onClick={() => navigate(`/ban/${soBan}`)}>Xem thực đơn</Button></div></div>;
  }
  const custom = dish.loaiBanh === "Tự làm";
  const line: CartLine = { key: "", maMon: dish.maMon, maVo: crust, maKT: size, thanhPhan: custom ? toppings : [], soLuong: qty };
  const unit = linePrice(menu, line, true);
  const toggle = (id: string) => {
    const t = menu.toppings.find((x) => x.maTP === id);
    if (t?.tamHet) { toast("Thành phần này tạm hết", "error"); return; }
    setToppings((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setError("");
  };
  const submit = () => {
    if (dish.tamHet) { toast("Món này tạm hết", "error"); return; }
    if (!crust || !size) { setError("Vui lòng chọn đầy đủ vỏ bánh và kích thước"); return; }
    if (custom && toppings.length === 0) {
      setError("Vui lòng chọn ít nhất một thành phần");
      toast("Vui lòng chọn ít nhất một thành phần", "error");
      return;
    }
    if (editing) {
      cart.update(editing.key, { maMon: dish.maMon, maVo: crust, maKT: size, thanhPhan: line.thanhPhan, soLuong: qty });
      toast("Đã cập nhật món trong đơn");
      navigate(`/ban/${soBan}/don-hang`);
      return;
    }
    cart.add({ maMon: dish.maMon, maVo: crust, maKT: size, thanhPhan: line.thanhPhan, soLuong: qty });
    toast("Đã thêm bánh vào giỏ hàng");
    setComboAsk(true); // gợi ý combo Pizza + Nước uống
  };

  return (
    <div className="customer-screen">
      <TopBar soBan={soBan} />
      <main className="customize-layout">
        <section className="pizza-visual">
          <button className="back-link" onClick={() => navigate(editing ? `/ban/${soBan}/don-hang` : `/ban/${soBan}`)}>‹ {editing ? "Quay lại đơn hàng" : "Quay lại thực đơn"}</button>
          <div className="pizza-photo-wrap"><div className="photo-ring" /><FoodImage src={dish.hinhAnh} alt={dish.tenMon} /><span className="fresh-note">Nguyên liệu<br /><b>tươi mỗi ngày</b></span></div>
          <div className="visual-copy"><Badge tone={custom ? "warning" : "success"}>{dish.loaiBanh}</Badge><h1>{dish.tenMon}</h1><p>{dish.moTa}</p></div>
        </section>
        <section className="custom-options">
          <div className="custom-scroll">
            <span className="eyebrow">Bước 1/3 · Chọn loại bánh và tùy chỉnh</span><h2>Chọn theo sở thích</h2>
            <OptionTitle number="1" title="Loại bánh" optional={false} />
            <div className="type-select">
              {pizzas.map((p) => (
                <button key={p.maMon} className={`${p.maMon === dishId ? "active" : ""} ${p.tamHet ? "sold" : ""}`}
                  onClick={() => { if (p.tamHet) { toast("Món này tạm hết", "error"); return; } setDishId(p.maMon); setError(""); }}>
                  <b>{p.tenMon}</b><small>{p.tamHet ? "Tạm hết" : `${p.loaiBanh} · từ ${money(p.giaTu)}`}</small>
                </button>
              ))}
            </div>
            <OptionTitle number="2" title="Vỏ bánh" optional={false} />
            <div className="segment">{menu.crusts.map((c) => <button className={crust === c.maVo ? "active" : ""} onClick={() => { setCrust(c.maVo); setError(""); }} key={c.maVo}>{c.tenVo}<small>{c.phuThu ? `+${money(c.phuThu)}` : c.tenVo === "Giòn" ? "Mỏng, giòn rụm" : "Không phụ thu"}</small></button>)}</div>
            <OptionTitle number="3" title="Kích thước" optional={false} />
            <div className="size-options">{menu.sizes.map((s) => {
              const meta: Record<string, string> = { S: "20 cm · 1 người", M: "28 cm · 2 người", L: "35 cm · 3–4 người" };
              return <button key={s.maKT} className={size === s.maKT ? "active" : ""} onClick={() => { setSize(s.maKT); setError(""); }}><span className={`pizza-size size-${s.tenKT}`}>●</span><b>{s.tenKT} · {money(dish.gia?.[s.maKT] || 0)}</b><small>{meta[s.maKT]}</small>{size === s.maKT && <span className="selected-check"><Icon name="check" size={13} /></span>}</button>;
            })}</div>
            {custom ? (
              <>
                <OptionTitle number="4" title="Thành phần thêm (nền sốt cà chua)" optional={false} />
                <div className="topping-grid">{menu.toppings.map((t) => <button key={t.maTP} className={`${toppings.includes(t.maTP) ? "active" : ""} ${t.tamHet ? "sold" : ""}`} onClick={() => toggle(t.maTP)}><span className="toggle-check">{toppings.includes(t.maTP) && <Icon name="check" size={13} />}</span><span><b>{t.tenTP}</b><small>{t.tamHet ? "Tạm hết" : `+${money(t.giaThem)}`}</small></span></button>)}</div>
              </>
            ) : (
              <>
                <OptionTitle number="4" title="Thành phần" optional />
                <p className="fixed-toppings">Bánh làm sẵn có thành phần cố định: <b>{dish.thanhPhan.join(", ")}</b>.</p>
              </>
            )}
            {error && <div className="inline-error" role="alert">! {error}</div>}
          </div>
          <div className="custom-footer">
            <div><small>Số lượng</small><Stepper value={qty} onChange={setQty} max={MAX_PIZZA} onLimit={() => toast(`Tối đa ${MAX_PIZZA} bánh mỗi lần đặt`, "error")} /></div>
            <div className="live-price"><small>Giá tạm tính</small><strong>{money(unit * qty)}</strong></div>
            <Button variant="secondary" onClick={() => navigate(editing ? `/ban/${soBan}/don-hang` : `/ban/${soBan}`)}>Quay lại</Button>
            <Button onClick={submit} icon="cart">{editing ? "Lưu thay đổi" : "Thêm vào đơn"}</Button>
          </div>
        </section>
      </main>
      {comboAsk && (
        <Modal title="Thêm nước uống giá combo?" symbol="🥤" onClose={() => navigate(`/ban/${soBan}`)}>
          <p>Combo <b>Pizza + Nước uống</b>: mỗi phần nước uống được giảm {money(menu.comboDiscount)}, áp dụng cho mọi cỡ bánh.</p>
          <div className="modal-actions"><Button variant="secondary" onClick={() => navigate(`/ban/${soBan}`)}>Bỏ qua</Button><Button onClick={() => navigate(`/ban/${soBan}?combo=1`)} icon="arrow">Đồng ý</Button></div>
        </Modal>
      )}
    </div>
  );
}

function OptionTitle({ number, title, optional }: { number: string; title: string; optional: boolean }) {
  return <div className="option-title"><span>{number}</span><h3>{title}</h3><small>{optional ? "Cố định" : "Bắt buộc"}</small></div>;
}

/* ====================== Xác nhận đơn đặt bánh và tính tổng tiền ====================== */
function CartScreen({ ctx }: { ctx: Ctx }) {
  const { menu, soBan, order } = ctx;
  const cart = useCart(soBan);
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const hasPizza = cart.lines.some((l) => menu.items.find((i) => i.maMon === l.maMon)?.loaiMon === "PIZZA")
    || !!order?.items.some((i) => i.loaiMon === "PIZZA" && i.trangThai !== "DA_HUY");
  const rows = cart.lines.map((l) => ({ line: l, dish: menu.items.find((i) => i.maMon === l.maMon), unit: linePrice(menu, l, hasPizza) }));
  const subtotal = rows.reduce((s, r) => s + r.unit * r.line.soLuong, 0);
  const vat = Math.round(subtotal * menu.vatRate);

  const send = async () => {
    setSending(true); setSendError("");
    try {
      await api("/api/orders", { method: "POST", body: { soBan, items: cart.lines.map(({ key, ...rest }) => rest) } });
      cart.clear();
      setConfirm(false);
      toast("Đơn hàng đã được gửi đến bếp");
      await ctx.refreshOrder();
      navigate(`/ban/${soBan}/theo-doi`);
    } catch (e) {
      setSendError(e instanceof ApiError && e.status !== 0 && e.status < 500 ? e.message : "Gửi đơn thất bại. Đơn tạm của bạn vẫn được giữ, vui lòng gửi lại.");
    } finally { setSending(false); }
  };

  if (!cart.lines.length) {
    return <div className="customer-screen"><TopBar soBan={soBan} /><div className="empty-page"><div className="empty-plate"><Icon name="cart" size={36} /></div><h1>Bạn chưa chọn món nào</h1><p>Khám phá thực đơn và chọn món pizza bạn yêu thích nhé.</p><div className="row-gap"><Button onClick={() => navigate(`/ban/${soBan}`)}>Xem thực đơn</Button>{order && <Button variant="secondary" onClick={() => navigate(`/ban/${soBan}/theo-doi`)}>Theo dõi đơn đã đặt</Button>}</div></div></div>;
  }
  return (
    <div className="customer-screen">
      <TopBar soBan={soBan} />
      <main className="cart-layout">
        <section className="cart-list">
          <div className="section-heading"><button className="back-circle" onClick={() => navigate(`/ban/${soBan}`)} aria-label="Quay lại">‹</button><div><span className="eyebrow">Bước 2/3</span><h1>Đơn hàng của bạn</h1><p>{cart.count} món · Bàn {soBan}</p></div></div>
          {order && <div className="info-note">Các món này sẽ được gọi thêm vào đơn <b>#{order.maDon}</b> đang phục vụ.</div>}
          {rows.map(({ line, dish, unit }) => dish && (
            <article className="cart-item" key={line.key}>
              <FoodImage src={dish.hinhAnh} alt={dish.tenMon} drink={dish.loaiMon === "NUOC"} />
              <div className="cart-item-main">
                <Badge tone={dish.loaiMon === "PIZZA" ? "success" : "neutral"}>{dish.loaiMon === "PIZZA" ? "Pizza" : "Nước uống"}</Badge>
                <h3>{dish.tenMon}</h3><p>{lineDetails(menu, line)}</p>
                <p className="unit-price">{money(unit)} / phần</p>
                {dish.loaiMon === "PIZZA" && <button className="edit-link" onClick={() => navigate(`/ban/${soBan}/tuy-chinh/${dish.maMon}?sua=${line.key}`)}>Chỉnh sửa</button>}
              </div>
              <div className="cart-item-side">
                <button className="delete-button" onClick={() => { cart.remove(line.key); toast(`Đã xóa ${dish.tenMon} khỏi đơn`, "info"); }} aria-label="Xóa món"><Icon name="trash" size={18} /></button>
                <strong>{money(unit * line.soLuong)}</strong>
                <Stepper value={line.soLuong} onChange={(v) => cart.update(line.key, { soLuong: v })} max={dish.loaiMon === "PIZZA" ? MAX_PIZZA : MAX_DRINK}
                  onLimit={() => toast(dish.loaiMon === "PIZZA" ? `Tối đa ${MAX_PIZZA} bánh mỗi lần đặt` : `Tối đa ${MAX_DRINK} phần mỗi loại`, "error")} />
              </div>
            </article>
          ))}
          <button className="add-more" onClick={() => navigate(`/ban/${soBan}`)}><Icon name="plus" /> Đặt thêm món</button>
        </section>
        <aside className="order-summary">
          <div><span className="eyebrow">Tóm tắt đơn</span><h2>Thông tin thanh toán</h2></div>
          <div className="summary-lines"><p><span>Tạm tính</span><b>{money(subtotal)}</b></p><p><span>VAT ({Math.round(menu.vatRate * 100)}%)</span><b>{money(vat)}</b></p></div>
          <div className="summary-total"><span>Tổng cộng</span><strong>{money(subtotal + vat)}</strong><small>Đã bao gồm thuế VAT</small></div>
          <div className="order-note"><Icon name="clock" /><span>Thời gian dự kiến<b>20–25 phút</b></span></div>
          {sendError && <Alert tone="error" title="Gửi đơn thất bại">{sendError}</Alert>}
          <Button className="wide" onClick={() => setConfirm(true)} icon="arrow">Xác nhận đặt bánh</Button>
          <p className="summary-help">Bạn có thể thanh toán sau khi dùng bữa</p>
        </aside>
      </main>
      {confirm && (
        <Modal title="Xác nhận đặt bánh?" onClose={() => setConfirm(false)}>
          <p>Đơn hàng sẽ được chuyển đến bếp và không thể thay đổi sau khi bếp bắt đầu chế biến.</p>
          <div className="confirm-order"><span>{cart.count} món · Bàn {soBan}</span><b>{money(subtotal + vat)}</b></div>
          {sendError && <div style={{ marginTop: 12 }}><Alert tone="error" title="Gửi đơn thất bại">{sendError}</Alert></div>}
          <div className="modal-actions"><Button variant="secondary" onClick={() => setConfirm(false)}>Kiểm tra lại</Button><Button onClick={send} loading={sending}>{sendError ? "Gửi lại" : "Xác nhận đặt bánh"}</Button></div>
        </Modal>
      )}
    </div>
  );
}

/* ====================== Theo dõi quy trình chế biến bánh ====================== */
const STEPS = [
  ["CHO_CHE_BIEN", "Chờ chế biến"],
  ["CHUAN_BI_NGUYEN_LIEU", "Chuẩn bị nguyên liệu"],
  ["DANG_NUONG", "Đang nướng bánh"],
  ["HOAN_THANH", "Hoàn thành"],
  ["DA_PHUC_VU", "Đã phục vụ"],
] as const;

function TrackingScreen({ ctx }: { ctx: Ctx }) {
  const { order, lastOrder, soBan, online } = ctx;
  const toast = useToast();
  const [called, setCalled] = useState(false);
  const [warnPay, setWarnPay] = useState(false);

  const shown = order || lastOrder;
  const [prevStatus, setPrevStatus] = useState<string | null>(null);
  useEffect(() => {
    if (order && prevStatus && prevStatus !== order.trangThai && order.trangThai === "HOAN_THANH") toast("Món của bạn đã sẵn sàng!");
    setPrevStatus(order?.trangThai || null);
  }, [order?.trangThai]); // eslint-disable-line react-hooks/exhaustive-deps

  const callStaff = async () => {
    try { await api(`/api/tables/${soBan}/call-staff`, { method: "POST" }); setCalled(true); toast("Đã gọi nhân viên"); }
    catch { toast("Không gửi được yêu cầu, vui lòng thử lại", "error"); }
  };

  if (!shown) {
    return <div className="customer-screen"><TopBar soBan={soBan} /><div className="empty-page"><div className="empty-plate"><Icon name="clock" size={36} /></div><h1>Bàn {soBan} chưa có đơn hàng</h1><p>{online ? "Hãy chọn món trên thực đơn để bắt đầu." : "Đang kết nối lại…"}</p><Button onClick={() => navigate(`/ban/${soBan}`)}>Xem thực đơn</Button></div></div>;
  }
  if (!order && lastOrder?.trangThai === "DA_THANH_TOAN") {
    return <div className="customer-screen"><TopBar soBan={soBan} /><div className="empty-page"><div className="empty-plate success"><Icon name="check" size={36} /></div><h1>Thanh toán thành công – Cảm ơn quý khách</h1><p>Đơn #{lastOrder.maDon} · {money(lastOrder.tongTien)}. Hẹn gặp lại!</p><Button onClick={() => navigate(`/ban/${soBan}`)}>Đặt đơn mới</Button></div></div>;
  }
  const o = shown;
  const idx = STEPS.findIndex(([s]) => s === o.trangThai);
  const pendingItems = o.items.filter((i) => !["DA_PHUC_VU", "DA_HUY"].includes(i.trangThai));
  const cancelled = o.items.filter((i) => i.trangThai === "DA_HUY");

  return (
    <div className="customer-screen">
      <TopBar soBan={soBan} />
      <main className="tracking-content">
        <div className="tracking-title"><span className="eyebrow">Đơn hàng #{o.maDon}</span><h1>{o.trangThai === "DA_HUY" ? "Đơn hàng không thể chế biến" : o.trangThai === "DA_PHUC_VU" ? "Chúc quý khách ngon miệng!" : "Pizza của bạn đang được chuẩn bị"}</h1><p>{online ? "Trạng thái được cập nhật tự động." : <span className="reconnect">Đang kết nối lại… (hiển thị trạng thái gần nhất)</span>}</p></div>
        {o.trangThai === "HOAN_THANH" && <div className="success-banner"><span className="success-icon"><Icon name="check" size={22} /></span><div><b>Món của bạn đã sẵn sàng!</b><p>Nhân viên sẽ mang đến bàn trong ít phút.</p></div><Badge tone="success">Bàn {soBan}</Badge></div>}
        {cancelled.length > 0 && (
          <div className="reject-banner"><span>!</span><div><b>Có {cancelled.length} món không thể chế biến</b><p>{cancelled.map((c) => `${c.tenMon}: ${(c.ghiChu || "").replace("Không thể chế biến: ", "")}`).join(" · ")}</p></div><Button variant="secondary" onClick={() => navigate(`/ban/${soBan}`)}>Chọn món thay thế</Button></div>
        )}
        <section className="tracking-card">
          <div className="tracking-meta"><div><small>MÃ ĐƠN HÀNG</small><b>#{o.maDon}</b></div><div><small>THỜI GIAN ĐẶT</small><b>{clock(o.thoiGianDat)}, {dateText(o.thoiGianDat)}</b></div><div><small>TỔNG TIỀN</small><b className="red-text">{money(o.tongTien)}</b></div></div>
          {o.trangThai !== "DA_HUY" && (
            <div className="progress-track">{STEPS.map(([key, label], index) => (
              <div className={`progress-step ${index <= idx ? "done" : ""} ${index === idx ? "current" : ""}`} key={key}>
                <div className="step-line" /><span>{index < idx || o.trangThai === "DA_PHUC_VU" ? <Icon name="check" size={16} /> : index + 1}</span><b>{label}</b><small>{index < idx ? "Xong" : index === idx ? "Hiện tại" : "—"}</small>
              </div>
            ))}</div>
          )}
          {o.items.map((it) => (
            <div className={`tracking-items ${it.trangThai === "DA_HUY" ? "cancelled" : ""}`} key={it.maCT}>
              <FoodImage src={it.hinhAnh} alt={it.tenMon} drink={it.loaiMon === "NUOC"} />
              <div><b>{it.tenMon}</b><p>{[it.vo && `Vỏ ${it.vo.toLowerCase()}`, it.kichThuoc && `Cỡ ${it.kichThuoc.toLowerCase()}`, it.thanhPhanThem.join(", ")].filter(Boolean).join(" · ") || it.ghiChu}</p></div>
              <Badge tone={it.trangThai === "DA_HUY" ? "danger" : it.trangThai === "HOAN_THANH" || it.trangThai === "DA_PHUC_VU" ? "success" : "warning"}>{it.trangThaiText}</Badge>
              <span>× {it.soLuong}</span><strong>{money(it.thanhTien)}</strong>
            </div>
          ))}
        </section>
        <div className="tracking-actions">
          <Button variant="secondary" onClick={callStaff} icon="bell" disabled={called}>{called ? "Đã gọi nhân viên" : "Gọi nhân viên"}</Button>
          <Button variant="secondary" onClick={() => navigate(`/ban/${soBan}`)}>Gọi thêm món</Button>
          {order && order.tongTien > 0 && <Button onClick={() => (pendingItems.length ? setWarnPay(true) : navigate(`/ban/${soBan}/thanh-toan`))} icon="arrow">Tiến hành thanh toán</Button>}
        </div>
      </main>
      {warnPay && (
        <Modal title="Còn món chưa được phục vụ" onClose={() => setWarnPay(false)}>
          <p>Đơn hàng còn {pendingItems.length} món chưa được phục vụ. Bạn có chắc muốn thanh toán ngay?</p>
          <div className="modal-actions"><Button variant="secondary" onClick={() => setWarnPay(false)}>Chờ phục vụ</Button><Button onClick={() => navigate(`/ban/${soBan}/thanh-toan?xacnhan=1`)}>Vẫn thanh toán</Button></div>
        </Modal>
      )}
    </div>
  );
}

/* ====================== Thanh toán đơn hàng ====================== */
function PaymentScreen({ ctx }: { ctx: Ctx }) {
  const { order, soBan, refreshOrder } = ctx;
  const [method, setMethod] = useState<"TIEN_MAT" | "THE" | "">("");
  const [cash, setCash] = useState("");
  const [card, setCard] = useState({ so: "", han: "", cvv: "" });
  const [status, setStatus] = useState<{ tone: "error" | "success"; title: string; text?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState<Order | null>(null);
  const [warnUnserved, setWarnUnserved] = useState(false);
  const confirmed = useMemo(() => new URLSearchParams(window.location.hash.split("?")[1] || "").get("xacnhan") === "1", []);

  const o = paid || order;
  if (!o) {
    return <div className="customer-screen"><TopBar soBan={soBan} /><div className="empty-page"><div className="empty-plate"><Icon name="card" size={36} /></div><h1>Không có đơn cần thanh toán</h1><p>Bàn {soBan} hiện chưa có đơn hàng nào đang phục vụ.</p><Button onClick={() => navigate(`/ban/${soBan}`)}>Xem thực đơn</Button></div></div>;
  }
  const total = o.tongTien;
  const cashNum = Number(cash.replace(/\D/g, "")) || 0;
  const quick = [Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000, Math.ceil(total / 100000) * 100000, 500000]
    .filter((v, i, a) => v >= total && a.indexOf(v) === i).slice(0, 4);

  const pay = async (force = false) => {
    if (!method) { setStatus({ tone: "error", title: "Vui lòng chọn hình thức thanh toán" }); return; }
    setBusy(true); setStatus(null);
    try {
      const r = await api<{ message: string; order: Order }>(`/api/orders/${o.maDon}/pay`, {
        method: "POST",
        body: { hinhThuc: method, tienKhachDua: cashNum, soThe: card.so, hetHan: card.han, cvv: card.cvv, xacNhanChuaPhucVu: force || confirmed },
      });
      setPaid(r.order);
      setStatus({ tone: "success", title: "Thanh toán thành công", text: "Cảm ơn quý khách. Hẹn gặp lại!" });
      refreshOrder();
    } catch (e) {
      if (e instanceof ApiError && e.code === "UNSERVED") setWarnUnserved(true);
      else if (e instanceof ApiError && e.status === 409) { setStatus({ tone: "error", title: e.message }); refreshOrder(); }
      else if (e instanceof ApiError && e.code === "TIMEOUT") { setStatus({ tone: "error", title: "Giao dịch đã bị hủy", text: e.message }); setMethod("TIEN_MAT"); }
      else setStatus({ tone: "error", title: e instanceof ApiError && e.status ? e.message : "Giao dịch thất bại", text: "Vui lòng kiểm tra và thử lại, hoặc đổi hình thức thanh toán." });
    } finally { setBusy(false); }
  };

  const items = o.items.filter((i) => i.trangThai !== "DA_HUY");
  return (
    <div className="customer-screen">
      <TopBar soBan={soBan} />
      <main className="payment-layout">
        <section className="invoice print-area">
          {!paid && <button className="back-link no-print" onClick={() => navigate(`/ban/${soBan}/theo-doi`)}>‹ Quay lại theo dõi đơn</button>}
          <span className="eyebrow">{paid ? "Hóa đơn" : "Bước 3/3 · Thanh toán"}</span><h1>{paid ? `Hóa đơn #${paid.thanhToan?.maHD}` : "Hóa đơn của bạn"}</h1>
          <p className="muted">Mã đơn #{o.maDon} · Bàn {soBan} · {clock(paid?.thanhToan?.thoiGian || o.thoiGianDat)} {dateText(paid?.thanhToan?.thoiGian || o.thoiGianDat)}</p>
          <div className="invoice-items">{items.map((i) => <div key={i.maCT}><span><b>{i.soLuong} ×</b> {i.tenMon}<small>{[i.vo && `Vỏ ${i.vo.toLowerCase()}`, i.kichThuoc && `Cỡ ${i.kichThuoc.toLowerCase()}`, i.thanhPhanThem.join(", ")].filter(Boolean).join(" · ") || i.ghiChu || " "}</small></span><strong>{money(i.thanhTien)}</strong></div>)}</div>
          <div className="summary-lines"><p><span>Tạm tính</span><b>{money(o.tamTinh)}</b></p><p><span>VAT (8%)</span><b>{money(o.thueVAT)}</b></p></div>
          <div className="invoice-total"><span>Tổng thanh toán</span><strong>{money(total)}</strong></div>
          {paid?.thanhToan && <div className="summary-lines paid-lines"><p><span>Hình thức</span><b>{paid.thanhToan.hinhThuc === "THE" ? `Thẻ tín dụng •••• ${paid.thanhToan.soTheRutGon}` : "Tiền mặt"}</b></p>{paid.thanhToan.tienKhachDua != null && <><p><span>Tiền khách đưa</span><b>{money(paid.thanhToan.tienKhachDua)}</b></p><p><span>Tiền thối</span><b>{money(paid.thanhToan.tienThoi || 0)}</b></p></>}</div>}
          <div className="secure-note"><Icon name="check" /><span>Thông tin thẻ không được lưu trữ – kết nối được mã hóa</span></div>
        </section>
        <section className="payment-method no-print">
          {paid ? (
            <div className="paid-panel">
              <Alert tone="success" title="Thanh toán thành công – Cảm ơn quý khách">Đơn hàng đã được cập nhật “Đã thanh toán”. Hẹn gặp lại!</Alert>
              <Button className="wide" variant="secondary" icon="print" onClick={() => window.print()}>In hóa đơn</Button>
              <Button className="wide" onClick={() => navigate(`/ban/${soBan}`)}>Về thực đơn</Button>
            </div>
          ) : (
            <>
              <span className="eyebrow">Chọn hình thức</span><h2>Phương thức thanh toán</h2>
              <div className="payment-tabs">
                <button className={method === "TIEN_MAT" ? "active" : ""} onClick={() => { setMethod("TIEN_MAT"); setStatus(null); }}><Icon name="cash" /><span><b>Tiền mặt</b><small>Nhân viên thu tại bàn</small></span></button>
                <button className={method === "THE" ? "active" : ""} onClick={() => { setMethod("THE"); setStatus(null); }}><Icon name="card" /><span><b>Thẻ tín dụng</b><small>Visa, Mastercard, JCB</small></span></button>
              </div>
              {status && <Alert tone={status.tone} title={status.title}>{status.text}</Alert>}
              {method === "TIEN_MAT" && (
                <div className="payment-form">
                  <Field label="Tiền khách đưa" value={cash} onChange={(v) => { setCash(v.replace(/\D/g, "") ? Number(v.replace(/\D/g, "")).toLocaleString("vi-VN") : ""); setStatus(null); }} inputMode="numeric" placeholder="Nhập số tiền" />
                  <div className="quick-cash">{quick.map((v) => <button key={v} onClick={() => { setCash(v.toLocaleString("vi-VN")); setStatus(null); }}>{money(v)}</button>)}</div>
                  <div className="change-box"><span>Tiền thừa trả khách</span><strong>{cashNum >= total ? money(cashNum - total) : "—"}</strong></div>
                </div>
              )}
              {method === "THE" && (
                <div className="payment-form card-form">
                  <Field label="Số thẻ" value={card.so} onChange={(v) => setCard({ ...card, so: v.replace(/[^\d ]/g, "").slice(0, 23) })} placeholder="1234 5678 9012 3456" inputMode="numeric" />
                  <div className="form-row">
                    <Field label="Ngày hết hạn" value={card.han} onChange={(v) => { const d = v.replace(/\D/g, "").slice(0, 4); setCard({ ...card, han: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }); }} placeholder="MM/YY" inputMode="numeric" />
                    <Field label="CVV" value={card.cvv} onChange={(v) => setCard({ ...card, cvv: v.replace(/\D/g, "").slice(0, 4) })} placeholder="•••" type="password" inputMode="numeric" />
                  </div>
                  <p className="card-hint">Có thể quẹt hoặc chạm thẻ vào đầu đọc tại bàn. Hệ thống chỉ lưu 4 số cuối của thẻ.</p>
                </div>
              )}
              <Button className="wide payment-submit" onClick={() => pay()} icon="arrow" loading={busy}>Thanh toán {money(total)}</Button>
            </>
          )}
        </section>
      </main>
      {warnUnserved && (
        <Modal title="Còn món chưa được phục vụ" onClose={() => setWarnUnserved(false)}>
          <p>Một số món trong đơn chưa được phục vụ. Bạn có muốn tiếp tục thanh toán?</p>
          <div className="modal-actions"><Button variant="secondary" onClick={() => setWarnUnserved(false)}>Quay lại</Button><Button onClick={() => { setWarnUnserved(false); pay(true); }}>Tiếp tục thanh toán</Button></div>
        </Modal>
      )}
    </div>
  );
}
