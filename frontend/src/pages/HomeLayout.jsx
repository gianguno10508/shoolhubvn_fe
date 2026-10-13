import AppShell from "../components/layout/AppShell";

/* Khung chung sau khi đăng nhập: sidebar trái + thanh trên + nội dung từng trang */
export default function HomeLayout() {
  return (
    <div className="tkb-root">
      <AppShell />
    </div>
  );
}
