import { useAuth } from "./context/AuthContext";
import useTimetable from "./hooks/useTimetable";
import LoginRegister from "./components/auth/LoginRegister";
import TimetableApp from "./TimetableApp";

/* Màn hình chờ / lỗi dùng chung */
function CenterScreen({ children }) {
  return (
    <div className="tkb-root">
      <div className="center-screen">{children}</div>
    </div>
  );
}

/* Chỉ được render khi đã đăng nhập: tải dữ liệu rồi mới vào giao diện chính */
function LoggedInApp() {
  const { user, logout } = useAuth();
  const { status, error, timetableId, initialData, save, reload } = useTimetable();

  if (status === "loading") {
    return <CenterScreen>Đang tải thời khóa biểu...</CenterScreen>;
  }

  if (status === "error") {
    return (
      <CenterScreen>
        <p style={{ color: "var(--danger)" }}>{error}</p>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={reload}>
            Thử lại
          </button>
          <button className="btn btn-danger" onClick={logout}>
            Đăng xuất
          </button>
        </div>
      </CenterScreen>
    );
  }

  return (
    <TimetableApp
      key={timetableId}
      initialData={initialData}
      timetableId={timetableId}
      onSave={save}
      onLogout={logout}
      user={user}
    />
  );
}

export default function App() {
  const { token, loading } = useAuth();

  if (loading) return <CenterScreen>Đang kiểm tra đăng nhập...</CenterScreen>;

  if (!token) {
    return (
      <div className="tkb-root">
        <LoginRegister />
      </div>
    );
  }

  return <LoggedInApp />;
}
