// context/AuthContext.js — đăng nhập, lưu token, thông tin tài khoản hiện tại
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, loadToken, saveToken, setUnauthorizedHandler } from "../api/client";
import { registerForPush, unregisterPush } from "../utils/push";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    await unregisterPush(); // gỡ token khi còn đăng nhập, để máy này thôi nhận thông báo của tài khoản cũ
    await saveToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => logout());
    (async () => {
      try {
        if (await loadToken()) setUser(await api.me());
      } catch (err) {
        // Token hết hạn → về màn đăng nhập
        if (err.status === 401) await saveToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [logout]);

  // Đăng nhập xong (hoặc mở lại app khi còn phiên): bật nhận thông báo đẩy
  const userId = user?.id;
  useEffect(() => {
    if (userId) registerForPush();
  }, [userId]);

  const login = useCallback(async (username, password) => {
    const { token, user: u } = await api.login(username.trim(), password);
    await saveToken(token);
    setUser(u);
  }, []);

  const value = useMemo(() => ({ user, setUser, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
