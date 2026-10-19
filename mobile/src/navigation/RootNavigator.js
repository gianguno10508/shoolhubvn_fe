// navigation/RootNavigator.js — điều hướng theo chức danh (theo frontend/requirement.txt, mục React native)
import { useEffect, useState } from "react";
import { AppState, Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { api } from "../api/client";
import { Empty, Loading, Screen } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";
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

/* Các tab của từng chức danh: [tên, tiêu đề, icon, màn hình] */
const T = {
  notifications: ["Notifications", "Thông báo", "🔔", NotificationsScreen],
  summary: ["Summary", "Thi đua", "🏆", DisciplineSummaryScreen],
  classSummary: ["Summary", "Thi đua lớp", "🏆", DisciplineSummaryScreen],
  score: ["Score", "Chấm thi đua", "🚩", DisciplineScoreScreen],
  results: ["Results", "Bài tập", "📝", AssignmentResultsScreen],
  timetable: ["Timetable", "TKB", "🗓️", TimetableScreen],
  exams: ["Exams", "Bài thi", "📚", ExamListScreen],
  account: ["Account", "Tài khoản", "👤", AccountScreen],
  admin: ["Admin", "Quản trị", "🛡️", AdminScreen],
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

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      {tabs.map(([name, title, icon, component]) => (
        <Tab.Screen
          key={name}
          name={name}
          component={component}
          options={{
            title,
            tabBarIcon: ({ focused }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{icon}</Text>,
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
    <Stack.Navigator screenOptions={{ headerBackTitle: "Quay lại" }}>
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
