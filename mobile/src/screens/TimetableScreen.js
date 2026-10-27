// screens/TimetableScreen.js — "Lịch cá nhân": TKB theo tuần dạng thẻ màu theo ngày (giống mẫu tkb.png)
// Lấy TKB nhà trường áp dụng cho tuần đang xem (theo ngày bắt đầu / kết thúc tuần cài trên web), mỗi tiết kèm giờ học.
//  - Giáo viên: tự hiện lịch dạy của mình theo họ tên tài khoản (chỉ khi không khớp tên mới phải tự chọn, lưu trên máy)
//  - Học sinh, cờ đỏ: tự hiện TKB lớp mình
//  - Tài khoản trường, BGH, Đoàn TN: chọn xem theo lớp hoặc theo giáo viên (lưu lựa chọn trên máy)
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as SecureStore from "expo-secure-store";
import { api } from "../api/client";
import { Card, Empty, ErrorBox, Loading, Muted, Screen, Segmented } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { colors, radius, space } from "../theme";

const CHOICE_KEY = "tkb_choice";
const HEADER = "#0F9D8A";
const DAY_LABELS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"];
const DAY_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
// Mỗi thứ 1 màu thẻ (giống mẫu)
const DAY_COLORS = ["#F6A85B", "#9B59B6", "#1ABC9C", "#3498DB", "#E84393", "#27AE60", "#E74C3C"];

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Ngày tuần áp dụng từ máy chủ (0h UTC) → "dd/mm" */
const dayMonth = (v) => {
  const d = new Date(v);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`;
};

/** Thứ 2 của tuần chứa `date`, lệch `offset` tuần */
function mondayOf(date, offset = 0) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff + offset * 7);
  return d;
}

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Gộp các tiết liền nhau cùng môn + GV + lớp trong 1 buổi thành 1 thẻ */
function mergeCells(cells) {
  const out = [];
  for (const c of cells) {
    const last = out[out.length - 1];
    if (
      last &&
      last.day === c.day &&
      last.session === c.session &&
      last.subject === c.subject &&
      last.teacher === c.teacher &&
      last.className === c.className &&
      last.periods[last.periods.length - 1] === c.period - 1
    ) {
      last.periods.push(c.period);
      if (c.end) last.end = c.end;
    } else {
      out.push({ ...c, periods: [c.period] });
    }
  }
  return out;
}

export default function TimetableScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const storeKey = `${CHOICE_KEY}_${user.id}`;
  // Lựa chọn đang xem: { teacherId } hoặc { classId }; undefined = đang đọc lựa chọn đã lưu
  const [choice, setChoice] = useState(undefined);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pickMode, setPickMode] = useState("class");
  const [weekOffset, setWeekOffset] = useState(0);
  const scrollRef = useRef(null);
  const dayY = useRef({});

  useEffect(() => {
    SecureStore.getItemAsync(storeKey)
      .then((v) => {
        let saved = {};
        try {
          saved = v ? JSON.parse(v) : {};
        } catch {
          saved = v ? { teacherId: v } : {}; // bản cũ chỉ lưu id giáo viên
        }
        setChoice(saved && typeof saved === "object" ? saved : {});
      })
      .catch(() => setChoice({}));
  }, [storeKey]);

  async function load(isRefresh = false) {
    if (choice === undefined) return;
    if (isRefresh) setRefreshing(true);
    setError("");
    try {
      const from = mondayOf(new Date(), weekOffset);
      const to = new Date(from);
      to.setDate(from.getDate() + 6);
      setData(await api.myTimetable({ ...choice, from: iso(from), to: iso(to) }));
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }

  // Đổi tuần thì tải TKB của tuần đó (mỗi tuần có thể là 1 TKB khác)
  useEffect(() => {
    load();
  }, [choice, weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  // Thanh tiêu đề màu xanh + nút tải lại (giống mẫu)
  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Lịch cá nhân",
      headerStyle: { backgroundColor: HEADER },
      headerTintColor: "#fff",
      headerTitleStyle: { color: "#fff", fontWeight: "700" },
      headerRight: () => (
        <Pressable onPress={() => load(true)} hitSlop={10} style={{ paddingHorizontal: space.lg }}>
          <Ionicons name="refresh" size={22} color="#fff" />
        </Pressable>
      ),
    });
  }, [navigation, choice, weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  async function choose(next) {
    await SecureStore.setItemAsync(storeKey, JSON.stringify(next)).catch(() => {});
    setPicking(false);
    setChoice(next);
  }

  const today = new Date();
  const monday = mondayOf(today, weekOffset);
  const days = data?.days || [];
  const dateOf = (label) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + DAY_LABELS.indexOf(label));
    return d;
  };

  const cards = useMemo(() => mergeCells(data?.cells || []), [data]);
  const byDay = useMemo(() => {
    const m = {};
    for (const c of cards) (m[c.day] = m[c.day] || []).push(c);
    return m;
  }, [cards]);

  function scrollToDay(label) {
    const y = dayY.current[label];
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  }

  const end = new Date(monday);
  end.setDate(monday.getDate() + 6);

  /** ‹ dd/mm – dd/mm › : chuyển tuần (bấm giữa để về tuần này) */
  const weekNav = (
    <View style={styles.weekNav}>
      <Pressable onPress={() => setWeekOffset((w) => w - 1)} hitSlop={10}>
        <Ionicons name="chevron-back" size={22} color={HEADER} />
      </Pressable>
      <Pressable onPress={() => setWeekOffset(0)}>
        <Text style={styles.weekLabel}>
          {pad(monday.getDate())}/{pad(monday.getMonth() + 1)} – {pad(end.getDate())}/{pad(end.getMonth() + 1)}
          {weekOffset !== 0 ? "  ·  Hôm nay" : ""}
        </Text>
      </Pressable>
      <Pressable onPress={() => setWeekOffset((w) => w + 1)} hitSlop={10}>
        <Ionicons name="chevron-forward" size={22} color={HEADER} />
      </Pressable>
    </View>
  );

  if (choice === undefined || (!data && !error)) return <Screen>{<Loading />}</Screen>;
  if (error && !data) {
    return (
      <Screen onRefresh={() => load(true)} refreshing={refreshing}>
        <ErrorBox message={error} />
      </Screen>
    );
  }
  if (!data.published) {
    return (
      <Screen onRefresh={() => load(true)} refreshing={refreshing}>
        <Empty icon="🗓️" title="Nhà trường chưa áp dụng thời khóa biểu nào" hint="Kéo xuống để tải lại khi nhà trường đã công bố." />
      </Screen>
    );
  }
  // Có TKB nhưng không có bản nào cho tuần đang xem
  if (!data.timetable) {
    return (
      <View style={styles.root}>
        <View style={styles.weekBar}>{weekNav}</View>
        <Screen onRefresh={() => load(true)} refreshing={refreshing}>
          <Empty icon="🗓️" title="Tuần này chưa có thời khóa biểu" hint="Chuyển sang tuần khác hoặc kéo xuống để tải lại." />
        </Screen>
      </View>
    );
  }

  // Tài khoản trường / BGH / Đoàn TN: chọn xem theo lớp hoặc giáo viên
  if (data.canBrowse && (!data.target || picking)) {
    const list = pickMode === "class" ? data.classOptions || [] : data.options || [];
    return (
      <Screen onRefresh={() => load(true)} refreshing={refreshing}>
        <Text style={styles.h}>Xem thời khóa biểu</Text>
        <Muted style={{ marginBottom: space.md }}>{data.timetable?.name}</Muted>
        <Segmented
          options={[
            { value: "class", label: "Theo lớp" },
            { value: "teacher", label: "Theo giáo viên" },
          ]}
          value={pickMode}
          onChange={setPickMode}
        />
        {list.length === 0 && <Empty title={pickMode === "class" ? "TKB chưa có lớp nào" : "TKB chưa có giáo viên nào"} />}
        <View style={styles.grid}>
          {list.map((o) => (
            <Pressable
              key={o.id}
              onPress={() => choose(pickMode === "class" ? { classId: o.id } : { teacherId: o.id })}
              style={({ pressed }) => [styles.gridItem, pickMode === "teacher" && styles.gridItemWide, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.gridText} numberOfLines={1}>
                {o.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </Screen>
    );
  }

  // Giáo viên: chưa xác định được mình là ai trong TKB → chọn tên
  if (data.kind === "teacher" && (!data.target || picking)) {
    return (
      <Screen onRefresh={() => load(true)} refreshing={refreshing}>
        <Text style={styles.h}>Chọn tên của bạn trong TKB</Text>
        <Muted style={{ marginBottom: space.md }}>
          {data.target
            ? "Chọn đúng tên của bạn, lựa chọn sẽ được ghi nhớ."
            : `Không tìm thấy tên “${user.name}” trong thời khóa biểu “${data.timetable?.name}”. Chọn đúng tên của bạn, lựa chọn sẽ được ghi nhớ.`}
        </Muted>
        {data.options.length === 0 && <Empty title="TKB chưa có giáo viên nào" />}
        {data.options.map((o) => (
          <Card key={o.id} onPress={() => choose({ teacherId: o.id })}>
            <Text style={styles.option}>{o.name}</Text>
          </Card>
        ))}
      </Screen>
    );
  }
  if (data.kind === "class" && !data.target) {
    return (
      <Screen onRefresh={() => load(true)} refreshing={refreshing}>
        <Empty icon="🏫" title={`Không tìm thấy lớp ${user.className || ""} trong TKB`} hint="Liên hệ nhà trường để kiểm tra lại." />
      </Screen>
    );
  }

  // Giáo viên đã tự khớp theo họ tên thì không cần đổi
  const canChange = data.canBrowse || (data.kind === "teacher" && !data.matched && data.options.length > 1);

  return (
    <View style={styles.root}>
      {/* Thanh tuần: T2 … CN, ngày của tuần đang xem, chấm dưới ngày có tiết */}
      <View style={styles.weekBar}>
        <View style={styles.targetRow}>
          <Ionicons name={data.kind === "teacher" ? "person-circle-outline" : "people-outline"} size={18} color={HEADER} />
          <Text style={styles.targetText} numberOfLines={1}>
            {data.kind === "teacher" ? data.target.name : `Lớp ${data.target.name}`}
          </Text>
          {canChange && (
            <Pressable onPress={() => setPicking(true)} hitSlop={8}>
              <Text style={styles.change}>Đổi</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.weekRow}>
          {days.map((label) => {
            const i = DAY_LABELS.indexOf(label);
            const date = dateOf(label);
            const isToday = sameDay(date, today);
            const n = (byDay[label] || []).length;
            return (
              <Pressable key={label} style={styles.dayCol} onPress={() => scrollToDay(label)}>
                <Text style={[styles.dayShort, isToday && { color: HEADER, fontWeight: "700" }]}>{DAY_SHORT[i]}</Text>
                <View style={[styles.dayNum, isToday && styles.dayNumToday]}>
                  <Text style={[styles.dayNumText, isToday && { color: "#fff" }]}>{date.getDate()}</Text>
                </View>
                <View style={styles.dots}>
                  {Array.from({ length: Math.min(n, 3) }).map((_, k) => (
                    <View key={k} style={[styles.dot, { backgroundColor: DAY_COLORS[i] }]} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
        {weekNav}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.list}
        contentContainerStyle={{ padding: space.md, paddingBottom: space.xl * 2 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {days.map((label) => {
          const i = DAY_LABELS.indexOf(label);
          const date = dateOf(label);
          const isToday = sameDay(date, today);
          const list = byDay[label] || [];
          return (
            <View
              key={label}
              style={styles.dayBlock}
              onLayout={(e) => {
                dayY.current[label] = e.nativeEvent.layout.y;
              }}
            >
              <View style={styles.dateCol}>
                <Text style={[styles.dateBig, isToday && { color: DAY_COLORS[i] }]}>{date.getDate()}</Text>
                <Text style={[styles.dateSmall, isToday && { color: DAY_COLORS[i] }]}>{DAY_SHORT[i]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                {list.length === 0 && <Muted style={styles.noLesson}>Không có tiết</Muted>}
                {list.map((c, k) => (
                  <View key={k} style={[styles.lesson, { backgroundColor: DAY_COLORS[i] }]}>
                    <View style={styles.lessonHead}>
                      <Text style={styles.time}>{c.start && c.end ? `${c.start} - ${c.end}` : `Tiết ${c.periods.join(", ")}`}</Text>
                      <Text style={styles.tag}>{c.session}</Text>
                    </View>
                    <View style={styles.divider} />
                    <Text style={styles.subject}>{c.subject || "(Chưa có môn)"}</Text>
                    <Text style={styles.bullet}>• Tiết: {c.periods.join(", ")}</Text>
                    {data.kind === "teacher" ? (
                      <Text style={styles.bullet}>• Lớp: {c.className}</Text>
                    ) : (
                      !!c.teacher && <Text style={styles.bullet}>• GV: {c.teacher}</Text>
                    )}
                    <Text style={styles.bullet}>• Buổi: {c.session}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
        <Muted style={{ textAlign: "center", marginTop: space.sm }}>
          {data.timetable?.name}
          {data.timetable?.weekStart ? ` (tuần ${dayMonth(data.timetable.weekStart)} – ${dayMonth(data.timetable.weekEnd)})` : ""} ·{" "}
          {data.cells.length} tiết/tuần
        </Muted>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  h: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: space.xs },
  option: { fontSize: 16, color: colors.text, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  gridItem: {
    width: "31%",
    margin: "1%",
    paddingVertical: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  gridItemWide: { width: "98%", alignItems: "flex-start", paddingHorizontal: space.md },
  gridText: { fontSize: 15, fontWeight: "600", color: colors.text },
  weekBar: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: space.xs },
  targetRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, paddingTop: space.sm },
  targetText: { flex: 1, marginLeft: 6, fontSize: 14, fontWeight: "800", color: colors.text },
  change: { color: HEADER, fontWeight: "700", fontSize: 14 },
  weekRow: { flexDirection: "row", paddingHorizontal: space.sm, paddingTop: space.sm },
  dayCol: { flex: 1, alignItems: "center" },
  dayShort: { fontSize: 12, color: colors.muted, marginBottom: 4 },
  dayNum: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  dayNumToday: { backgroundColor: HEADER },
  dayNumText: { fontSize: 17, color: colors.text, fontWeight: "600" },
  dots: { flexDirection: "row", height: 8, marginTop: 3, alignItems: "center" },
  dot: { width: 5, height: 5, borderRadius: 3, marginHorizontal: 1.5 },
  weekNav: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingTop: 2 },
  navArrow: { fontSize: 24, color: HEADER, paddingHorizontal: space.lg, fontWeight: "700" },
  weekLabel: { fontSize: 12, color: colors.text2, fontWeight: "600" },
  list: { flex: 1 },
  dayBlock: { flexDirection: "row", marginBottom: space.sm },
  dateCol: { width: 48, alignItems: "center", paddingTop: space.sm },
  dateBig: { fontSize: 24, color: colors.muted, fontWeight: "300" },
  dateSmall: { fontSize: 12, color: colors.muted },
  noLesson: { paddingVertical: space.md, fontStyle: "italic" },
  lesson: { borderRadius: 6, padding: space.md, marginBottom: space.sm },
  lessonHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  time: { color: "#fff", fontWeight: "800", fontSize: 15 },
  tag: { color: "#fff", fontSize: 11, opacity: 0.9 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.6)", marginVertical: 6 },
  subject: { color: "#fff", fontWeight: "800", fontSize: 17, marginBottom: 4 },
  bullet: { color: "#fff", fontSize: 14, lineHeight: 20 },
});
