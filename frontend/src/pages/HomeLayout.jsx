import { Outlet } from "react-router-dom";
import TopNav from "../components/layout/TopNav";

/* Khung chung sau khi đăng nhập: thanh menu phía trên + nội dung từng trang bên dưới */
export default function HomeLayout() {
  return (
    <div className="tkb-root">
      <TopNav />
      <Outlet />
    </div>
  );
}
