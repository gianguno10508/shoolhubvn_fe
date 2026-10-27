// utils/push.js — nhận thông báo đẩy từ máy chủ (Expo Push): xin quyền, lấy push token, gửi token lên backend,
// bấm vào thông báo thì mở đúng tab. Thông báo do backend gửi (backend-mongo/utils/push.js):
//   notification: thông báo mới · discipline: thi đua lớp chủ nhiệm · timetable / assignment: nhắc lúc 20h
//
// expo-notifications được nạp lười (require trong try): Expo Go trên Android (SDK 53+) và bản dev build
// chưa build lại sau khi thêm thư viện KHÔNG có module native (ExpoTopicSubscriptionModule...) — import tĩnh
// sẽ làm sập app ngay khi mở ("Cannot find native module"). Thiếu module thì app vẫn chạy, chỉ tắt push.
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "../api/client";

const IN_EXPO_GO = Constants.executionEnvironment === "storeClient";

let Notifications; // undefined: chưa nạp · null: không dùng được · object: module
function getNotifications() {
  if (Notifications !== undefined) return Notifications;
  Notifications = null;
  if (IN_EXPO_GO && Platform.OS === "android") {
    console.warn("Expo Go trên Android không hỗ trợ thông báo đẩy — hãy dùng bản development build (eas build).");
    return null;
  }
  try {
    const mod = require("expo-notifications");
    // Đang mở app vẫn hiện thông báo
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    Notifications = mod;
  } catch (err) {
    console.warn("Không nạp được expo-notifications (cần build lại app):", err?.message);
  }
  return Notifications;
}

let currentToken = null;

/** Xin quyền + đăng ký token với backend. Không ném lỗi (từ chối quyền, Expo Go, mất mạng thì bỏ qua). */
export async function registerForPush() {
  const Notifications = getNotifications();
  if (!Notifications) return null;
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
  const Notifications = getNotifications();
  if (!Notifications) return () => {};
  const open = (response) => {
    const tab = TAB_OF[response?.notification?.request?.content?.data?.type];
    if (!tab || !navigationRef.isReady()) return;
    try {
      navigationRef.navigate("Main", { screen: tab });
    } catch {
      // tài khoản không có tab này — bỏ qua
    }
  };
  try {
    // Mở app bằng cách bấm thông báo khi app đang tắt
    const last = Notifications.getLastNotificationResponse();
    if (last) setTimeout(() => open(last), 800);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  } catch (err) {
    // Nền tảng không hỗ trợ (VD: bản web) — bỏ qua, app vẫn chạy
    console.warn("Không theo dõi được thông báo đẩy:", err?.message);
    return () => {};
  }
}
