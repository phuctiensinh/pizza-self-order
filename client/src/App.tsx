import { useState } from "react";
import { auth } from "./api";
import { CustomerApp } from "./customer";
import { homeOf, KitchenScreen, LoginScreen, ManageScreen, ReportScreen } from "./staff";
import { navigate, useRoute } from "./store";
import { Button, Icon, ToastProvider } from "./ui";

/** Trang chọn màn hình: máy tính bảng tại bàn hoặc nhân viên */
function Home() {
  const [table, setTable] = useState(5);
  const user = auth.user;
  return (
    <div className="home-screen">
      <div className="home-card">
        <div className="logo-large"><span>🍕</span> Pizza <b>Self-Order</b></div>
        <h1>Hệ thống đặt và bán bánh Pizza tự động tại bàn ăn</h1>
        <div className="home-grid">
          <section>
            <span className="eyebrow">Khách hàng</span>
            <h2>Màn hình cảm ứng tại bàn</h2>
            <p>Mỗi máy tính bảng được gắn với một bàn ăn qua đường dẫn <code>#/ban/&lt;số bàn&gt;</code>.</p>
            <div className="table-picker">{Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <button key={n} className={table === n ? "active" : ""} onClick={() => setTable(n)}>{n}</button>)}</div>
            <Button className="wide" icon="arrow" onClick={() => navigate(`/ban/${table}`)}>Mở thực đơn Bàn {table}</Button>
          </section>
          <section>
            <span className="eyebrow">Nhân viên</span>
            <h2>Bếp và quản lý</h2>
            <p>Nhân viên bếp tiếp nhận đơn; quản lý cập nhật thực đơn, giá bán và xem báo cáo doanh thu.</p>
            <div className="home-links">
              <button onClick={() => navigate("/bep")}><Icon name="clock" />Màn hình bếp</button>
              <button onClick={() => navigate("/quan-ly/thuc-don")}><Icon name="menu" />Quản lý thực đơn</button>
              <button onClick={() => navigate("/quan-ly/bao-cao")}><Icon name="chart" />Báo cáo doanh thu</button>
            </div>
            <Button className="wide" variant="secondary" onClick={() => navigate(user ? homeOf(user) : "/dang-nhap")}>{user ? `Tiếp tục với ${user.hoTen}` : "Đăng nhập nhân viên"}</Button>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { parts, query } = useRoute();
  let content;
  let desktop = false;
  if (parts[0] === "ban" && Number(parts[1]) > 0) {
    content = <CustomerApp key={parts[1]} soBan={Number(parts[1])} sub={parts[2] || ""} param={parts[3]} query={query} />;
  } else if (parts[0] === "dang-nhap") {
    content = <LoginScreen />;
  } else if (parts[0] === "bep") {
    content = <KitchenScreen />; desktop = true;
  } else if (parts[0] === "quan-ly" && parts[1] === "bao-cao") {
    content = <ReportScreen />; desktop = true;
  } else if (parts[0] === "quan-ly") {
    content = <ManageScreen />; desktop = true;
  } else {
    content = <Home />;
  }
  return (
    <ToastProvider>
      <div className="app-shell"><div className={`canvas ${desktop ? "desktop-canvas" : ""}`}>{content}</div></div>
    </ToastProvider>
  );
}
