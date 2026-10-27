// navigation/RootNavigator.js — điều hướng theo chức danh (theo frontend/requirement.txt, mục React native)
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import { Empty, Loading, Screen } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { colors, shadow } from "../theme";
import AccountScreen from "../screens/AccountScreen";
import AssignmentDetailScreen from "../screens/AssignmentDetailScreen";
import AssignmentResultsScreen from "../screens/AssignmentResultsScreen";
import ChangePasswordScreen from "../screens/ChangePasswordScreen";
import ComposeNotificationScreen from "../screens/ComposeNotificationScreen";
import DisciplineScoreScreen from "../screens/DisciplineScoreScreen";
import DisciplineStudentsScreen from "../screens/DisciplineStudentsScreen";
import DisciplineSummaryScreen from "../screens/DisciplineSummaryScreen";
import EditProfileScreen from "../screens/EditProfileScreen";
import ExamListScreen from "../screens/ExamListScreen";
import ExamResultScreen from "../screens/ExamResultScreen";
import LoginScreen from "../screens/LoginScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import PlayGameScreen from "../screens/PlayGameScreen";
import TakeExamScreen from "../screens/TakeExamScreen";
import TimetableScreen from "../screens/TimetableScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function AdminScreen() {
  return (
    <Screen>
      <Empty icon="🛡️" title="Tài khoản quản trị hệ thống" hint="Vui lòng dùng bản web để quản trị trường và tài khoản." />
    </Screen>
  );
}

/* Các tab của từng chức danh: [tên, tiêu đề, icon Ionicons (bỏ "-outline" khi đang chọn), màn hình] */
const T = {
  notifications: ["Notifications", "Thông báo", "notifications", NotificationsScreen],
  summary: ["Summary", "Thi đua", "trophy", DisciplineSummaryScreen],
  classSummary: ["Summary", "Thi đua lớp", "trophy", DisciplineSummaryScreen],
  score: ["Score", "Chấm thi đua", "flag", DisciplineScoreScreen],
  results: ["Results", "Bài tập", "document-text", AssignmentResultsScreen],
  timetable: ["Timetable", "TKB", "calendar", TimetableScreen],
  exams: ["Exams", "Bài thi", "library", ExamListScreen],
  account: ["Account", "Tài khoản", "person-circle", AccountScreen],
  admin: ["Admin", "Quản trị", "shield-checkmark", AdminScreen],
};

/* Thanh tiêu đề trắng, chữ đậm, không viền — dùng chung cho tab & màn hình con */
const HEADER = {
  headerStyle: { backgroundColor: colors.surface },
  headerShadowVisible: false,
  headerTitleStyle: { fontWeight: "800", fontSize: 18, color: colors.text },
  headerTintColor: colors.primary,
  headerTitleAlign: "left",
};

const TABS_BY_ROLE = {
  principal: [T.notifications, T.summary, T.timetable, T.account],
  school_admin: [T.notifications, T.summary, T.timetable, T.account],
  youth_union: [T.summary, T.timetable, T.notifications, T.account],
  homeroom_teacher: [T.classSummary, T.results, T.timetable, T.notifications, T.account],
  teacher: [T.results, T.timetable, T.notifications, T.account],
  red_flag: [T.score, T.timetable, T.exams, T.notifications, T.account],
  student: [T.timetable, T.exams, T.notifications, T.account],
  admin: [T.admin, T.account],
};

/** Số thông báo chưa đọc, cập nhật mỗi phút và khi mở lại app */
function useUnreadCount(enabled) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    const load = () =>
      api
        .unreadCount()
        .then((r) => setCount(r.count || 0))
        .catch(() => {});
    load();
    const timer = setInterval(load, 60 * 1000);
    const sub = AppState.addEventListener("change", (s) => s === "active" && load());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [enabled]);
  return [count, setCount];
}

function MainTabs() {
  const { user } = useAuth();
  const tabs = TABS_BY_ROLE[user.role] || [T.notifications, T.account];
  const hasInbox = tabs.includes(T.notifications);
  const [unread, setUnread] = useUnreadCount(hasInbox && !!user.schoolId);
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        ...HEADER,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          height: 64 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
          ...shadow(2),
        },
        tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 10, fontWeight: "800" },
      }}
    >
      {tabs.map(([name, title, icon, component]) => (
        <Tab.Screen
          key={name}
          name={name}
          component={component}
          options={{
            title,
            tabBarIcon: ({ focused, color }) => (
              <Ionicons name={focused ? icon : `${icon}-outline`} size={23} color={color} />
            ),
            tabBarBadge: name === "Notifications" && unread > 0 ? unread : undefined,
          }}
          listeners={name === "Notifications" ? { tabPress: () => setTimeout(() => setUnread(0), 1500) } : undefined}
        />
      ))}
    </Tab.Navigator>
  );
}

function ForcedChangePassword(props) {
  return <ChangePasswordScreen {...props} forced />;
}

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) return <Loading label="Đang kiểm tra đăng nhập..." />;

  return (
    <Stack.Navigator
      screenOptions={{ ...HEADER, headerBackTitle: "Quay lại", contentStyle: { backgroundColor: colors.bg } }}
    >
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : user.mustChangePassword ? (
        <Stack.Screen name="ForceChangePassword" component={ForcedChangePassword} options={{ title: "Đặt mật khẩu mới" }} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="ComposeNotification" component={ComposeNotificationScreen} options={{ title: "Soạn thông báo" }} />
          <Stack.Screen name="DisciplineStudents" component={DisciplineStudentsScreen} options={{ title: "Học sinh bị ghi sổ" }} />
          <Stack.Screen
            name="AssignmentDetail"
            component={AssignmentDetailScreen}
            options={({ route }) => ({ title: route.params?.title || "Kết quả bài tập" })}
          />
          <Stack.Screen
            name="TakeExam"
            component={TakeExamScreen}
            options={({ route }) => ({ title: route.params?.title || "Làm bài", gestureEnabled: false })}
          />
          <Stack.Screen
            name="PlayGame"
            component={PlayGameScreen}
            options={({ route }) => ({ title: route.params?.title || "Trò chơi", gestureEnabled: false })}
          />
          <Stack.Screen name="ExamResult" component={ExamResultScreen} options={{ title: "Kết quả bài làm" }} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: "Đổi thông tin" }} />
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: "Đổi mật khẩu" }} />
        </>
      )}
    </Stack.Navigator>
  );
}
