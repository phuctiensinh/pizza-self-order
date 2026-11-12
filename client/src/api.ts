// Gọi API máy chủ + các kiểu dữ liệu dùng chung

export type MenuItem = {
  maMon: string;
  tenMon: string;
  loaiMon: "PIZZA" | "NUOC";
  loaiBanh: "Làm sẵn" | "Tự làm" | null;
  moTa: string | null;
  hinhAnh: string | null;
  dangBan: boolean;
  tamHet: boolean;
  gia: Record<string, number> | null;
  giaTu: number;
  donGia: number | null;
  dungTich: number | null;
  thanhPhan: string[];
  daCoDonHang?: boolean;
  ngayCapNhat?: string | null;
};
export type Topping = { maTP: string; tenTP: string; giaThem: number; tamHet: boolean };
export type Crust = { maVo: string; tenVo: string; phuThu: number };
export type Size = { maKT: string; tenKT: string };
export type Menu = { items: MenuItem[]; toppings: Topping[]; crusts: Crust[]; sizes: Size[]; vatRate: number; comboDiscount: number };

export type OrderItem = {
  maCT: number; maMon: string; tenMon: string; loaiMon: string; hinhAnh: string | null;
  soLuong: number; donGia: number; thanhTien: number; trangThai: string; trangThaiText: string;
  ghiChu: string | null; vo: string | null; kichThuoc: string | null; thanhPhanThem: string[];
};
export type Order = {
  maDon: string; maBan: string; soBan: number; thoiGianDat: string; trangThai: string; trangThaiText: string;
  tamTinh: number; thueVAT: number; tongTien: number; items: OrderItem[];
  thanhToan: null | { maTT: string; maHD: string; hinhThuc: string; soTien: number; thoiGian: string; tienKhachDua: number | null; tienThoi: number | null; soTheRutGon: string | null };
};
export type StaffUser = { maNV: string; hoTen: string; vaiTro: "BEP" | "QUANLY" | "THUNGAN" };

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

const TOKEN_KEY = "pso_token";
const USER_KEY = "pso_user";

export const auth = {
  get token() { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } },
  get user(): StaffUser | null { try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; } },
  save(token: string, user: StaffUser) { try { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch { /* bỏ qua */ } },
  clear() { try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch { /* bỏ qua */ } },
};

export async function api<T = unknown>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: options.method || "GET",
      headers: {
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Không thể kết nối máy chủ");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.message || "Lỗi hệ thống, vui lòng thử lại", data.code);
  return data as T;
}

export async function download(path: string) {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${auth.token}` } }).catch(() => null);
  if (!res) throw new ApiError(0, "Không thể kết nối máy chủ");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.message || "Không thể xuất báo cáo");
  }
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || "bao-cao.csv";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* Định dạng */
export const money = (n: number) => `${Math.round(n).toLocaleString("vi-VN")} đ`;

export const clock = (iso: string) => new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
export const dateText = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
export const minutesAgo = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
export const localISODate = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
