// Điều hướng theo hash (#/ban/5, #/bep, ...) và giỏ hàng tạm của từng bàn
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Menu } from "./api";

export function navigate(path: string) {
  window.location.hash = path;
}

export function useRoute() {
  const read = () => {
    const raw = window.location.hash.replace(/^#/, "") || "/";
    const [path, qs = ""] = raw.split("?");
    return { path, parts: path.split("/").filter(Boolean), query: new URLSearchParams(qs) };
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

/* ---------------- Giỏ hàng (đơn tạm trước khi xác nhận) ---------------- */
export type CartLine = {
  key: string;
  maMon: string;
  soLuong: number;
  maVo?: string;
  maKT?: string;
  thanhPhan?: string[];
  combo?: boolean;
};

const listeners = new Set<() => void>();
const cache = new Map<number, CartLine[]>();
const storageKey = (soBan: number) => `pso_cart_ban_${soBan}`;

function readCart(soBan: number): CartLine[] {
  if (!cache.has(soBan)) {
    let v: CartLine[] = [];
    try { v = JSON.parse(localStorage.getItem(storageKey(soBan)) || "[]"); } catch { v = []; }
    cache.set(soBan, Array.isArray(v) ? v : []);
  }
  return cache.get(soBan)!;
}

export function setCart(soBan: number, lines: CartLine[]) {
  cache.set(soBan, lines);
  try { localStorage.setItem(storageKey(soBan), JSON.stringify(lines)); } catch { /* bỏ qua */ }
  listeners.forEach((l) => l());
}

export function useCart(soBan: number) {
  const lines = useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => readCart(soBan));
  return {
    lines,
    count: lines.reduce((s, l) => s + l.soLuong, 0),
    add(line: Omit<CartLine, "key">) { setCart(soBan, [...readCart(soBan), { ...line, key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }]); },
    update(key: string, patch: Partial<CartLine>) { setCart(soBan, readCart(soBan).map((l) => (l.key === key ? { ...l, ...patch } : l))); },
    remove(key: string) { setCart(soBan, readCart(soBan).filter((l) => l.key !== key)); },
    clear() { setCart(soBan, []); },
  };
}

/** Tính giá tạm tính của một dòng (máy chủ sẽ tính lại khi xác nhận đơn) */
export function linePrice(menu: Menu, line: CartLine, hasPizza: boolean) {
  const dish = menu.items.find((i) => i.maMon === line.maMon);
  if (!dish) return 0;
  if (dish.loaiMon === "NUOC") return Math.max(0, (dish.donGia || 0) - (line.combo && hasPizza ? menu.comboDiscount : 0));
  const base = dish.gia?.[line.maKT || ""] || 0;
  const crust = menu.crusts.find((c) => c.maVo === line.maVo)?.phuThu || 0;
  const extras = (line.thanhPhan || []).reduce((s, id) => s + (menu.toppings.find((t) => t.maTP === id)?.giaThem || 0), 0);
  return base + crust + extras;
}

export function lineDetails(menu: Menu, line: CartLine) {
  const dish = menu.items.find((i) => i.maMon === line.maMon);
  if (!dish) return "";
  if (dish.loaiMon === "NUOC") return [dish.dungTich ? `${dish.dungTich} ml` : "", line.combo ? "Giá combo" : ""].filter(Boolean).join(" · ");
  const crust = menu.crusts.find((c) => c.maVo === line.maVo)?.tenVo;
  const size = menu.sizes.find((s) => s.maKT === line.maKT)?.tenKT;
  const tps = (line.thanhPhan || []).map((id) => menu.toppings.find((t) => t.maTP === id)?.tenTP).filter(Boolean);
  return [crust && `Vỏ ${crust.toLowerCase()}`, size && `Cỡ ${size.toLowerCase()}`, tps.join(", ")].filter(Boolean).join(" · ");
}
