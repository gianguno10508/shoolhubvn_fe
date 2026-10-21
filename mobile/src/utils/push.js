// utils/push.js — nhận thông báo đẩy từ máy chủ (Expo Push): xin quyền, lấy push token, gửi token lên backend,
// bấm vào thông báo thì mở đúng tab. Thông báo do backend gửi (backend-mongo/utils/push.js):
//   notification: thông báo mới · discipline: thi đua lớp chủ nhiệm · timetable / assignment: nhắc lúc 20h
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "../api/client";

// Đang mở app vẫn hiện thông báo
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let currentToken = null;

/** Xin quyền + đăng ký token với backend. Không ném lỗi (từ chối quyền, Expo Go, mất mạng thì bỏ qua). */
export async function registerForPush() {
  try {
    if (Platform.OS === "android") {
      // Android 13+: phải có kênh thì mới hiện hộp thoại xin quyền
      await Notifications.setNotificationChannelAsync("default", {
        name: "Thông báo SchoolHub",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    currentToken = data;
    await api.registerPushToken(data);
    return data;
  } catch (err) {
    console.warn("Không bật được thông báo đẩy:", err?.message);
    return null;
  }
}

/** Gọi trước khi đăng xuất: máy này thôi nhận thông báo của tài khoản cũ */
export async function unregisterPush() {
  if (!currentToken) return;
  const token = currentToken;
  currentToken = null;
  await api.removePushToken(token).catch(() => {});
}

/* Bấm vào thông báo → tab tương ứng */
const TAB_OF = { notification: "Notifications", discipline: "Summary", timetable: "Timetable", assignment: "Exams" };

export function listenPushTaps(navigationRef) {
  const open = (response) => {
    const tab = TAB_OF[response?.notification?.request?.content?.data?.type];
    if (!tab || !navigationRef.isReady()) return;
    try {
      navigationRef.navigate("Main", { screen: tab });
    } catch {
      // tài khoản không có tab này — bỏ qua
    }
  };
  // Mở app bằng cách bấm thông báo khi app đang tắt
  const last = Notifications.getLastNotificationResponse();
  if (last) setTimeout(() => open(last), 800);
  const sub = Notifications.addNotificationResponseReceivedListener(open);
  return () => sub.remove();
}
