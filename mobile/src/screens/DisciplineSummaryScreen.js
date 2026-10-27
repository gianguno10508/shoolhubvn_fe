// screens/DisciplineSummaryScreen.js — điểm tổng kết thi đua tuần / tháng
// BGH, tài khoản trường, Đoàn TN: xếp hạng mọi lớp; GVCN: chỉ lớp mình (backend lọc sẵn, vẫn giữ thứ hạng)
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { Body, Button, Card, Empty, ErrorBox, Loading, Muted, Row, Screen, Segmented } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { colors, radius, shadow, space } from "../theme";
import { addDaysISO, formatDate, todayISO } from "../utils/format";
import useAsync from "../utils/useAsync";

// Huy chương top 3: [màu chữ, màu nền]
const MEDAL = { 1: ["#B45309", "#FEF3C7"], 2: ["#475569", "#E2E8F0"], 3: ["#9A3412", "#FFEDD5"] };

/** Lùi / tiến 1 kỳ (tuần: 7 ngày, tháng: sang tháng kế) */
function shiftPeriod(period, date, dir) {
  if (period === "week") return addDaysISO(date, dir * 7);
  const [y, m] = date.split("-").map(Number);
  return todayISO(new Date(y, m - 1 + dir, 1));
}

export default function DisciplineSummaryScreen({ navigation }) {
  const { user } = useAuth();
  const isHomeroom = user.role === "homeroom_teacher";
  const [period, setPeriod] = useState("week");
  const [date, setDate] = useState(todayISO());
  const [open, setOpen] = useState(null);
  const { data, error, loading, refreshing, reload } = useAsync(() => api.disciplineSummary(period, date), [period, date]);

  const isCurrent = data && todayISO() >= data.start && todayISO() <= data.end;
  const rangeLabel = data
    ? period === "week"
      ? `Tuần ${formatDate(data.start)} – ${formatDate(data.end)}`
      : `Tháng ${data.start.slice(5, 7)}/${data.start.slice(0, 4)}`
    : "";
  const totalClasses = data?.totalClasses || data?.rows.length || 0;

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <Segmented
        options={[
          { value: "week", label: "Theo tuần" },
          { value: "month", label: "Theo tháng" },
        ]}
        value={period}
        onChange={(p) => {
          setPeriod(p);
          setDate(todayISO());
        }}
      />
      <Row style={styles.nav}>
        <Pressable onPress={() => setDate(shiftPeriod(period, date, -1))} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Row style={{ gap: 6 }}>
            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            <Text style={styles.range}>{rangeLabel}</Text>
          </Row>
          {data && !isCurrent && (
            <Pressable onPress={() => setDate(todayISO())}>
              <Text style={styles.link}>Về kỳ hiện tại</Text>
            </Pressable>
          )}
        </View>
        <Pressable onPress={() => setDate(shiftPeriod(period, date, 1))} style={styles.navBtn} disabled={isCurrent}>
          <Ionicons name="chevron-forward" size={22} color={isCurrent ? colors.muted : colors.primary} />
        </Pressable>
      </Row>

      <ErrorBox message={error} />
      {loading && !data && <Loading />}
      {data && data.rows.length === 0 && (
        <Empty icon="🏆" title={isHomeroom ? "Chưa có dữ liệu lớp chủ nhiệm" : "Chưa có lớp nào"} />
      )}

      {data?.rows.map((r) => {
        const expanded = isHomeroom || open === String(r.classId);
        const cats = Object.entries(r.byCategory || {}).sort((a, b) => b[1] - a[1]);
        return (
          <Card key={String(r.classId)} onPress={isHomeroom ? undefined : () => setOpen(expanded ? null : String(r.classId))}>
            <Row style={{ flexWrap: "nowrap" }}>
              <View style={[styles.rank, MEDAL[r.rank] && { backgroundColor: MEDAL[r.rank][1] }]}>
                {MEDAL[r.rank] ? (
                  <Ionicons name="medal" size={22} color={MEDAL[r.rank][0]} />
                ) : (
                  <Text style={styles.rankText}>{r.rank}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.className}>Lớp {r.className}</Text>
                <Muted numberOfLines={1}>{r.homeroomTeacher ? `GVCN: ${r.homeroomTeacher}` : "Chưa có GVCN"}</Muted>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.score}>{r.score}</Text>
                <Muted>điểm</Muted>
              </View>
            </Row>
            {isHomeroom && totalClasses > 1 && (
              <Muted style={{ marginTop: 6 }}>
                Xếp hạng {r.rank}/{totalClasses} lớp trong trường
              </Muted>
            )}
            <Row style={{ marginTop: space.md, gap: space.sm }}>
              <View style={[styles.pill, { backgroundColor: colors.dangerSoft }]}>
                <Ionicons name="remove-circle" size={14} color={colors.danger} />
                <Text style={styles.minus}>{r.penalty} trừ</Text>
              </View>
              <View style={[styles.pill, { backgroundColor: colors.successSoft }]}>
                <Ionicons name="add-circle" size={14} color={colors.success} />
                <Text style={styles.plus}>{r.bonus} cộng</Text>
              </View>
              <View style={[styles.pill, { backgroundColor: "#F1F5F9" }]}>
                <Ionicons name="checkmark-done" size={14} color={colors.text2} />
                <Text style={styles.days}>{r.recordedDays} ngày</Text>
              </View>
            </Row>

            {expanded && (
              <View style={styles.detail}>
                {data.columns.map((c) => {
                  const cell = r.cells?.[c.key];
                  let value = "—";
                  if (cell && period === "week") value = cell.net > 0 ? `+${cell.net}` : String(cell.net);
                  if (cell && period === "month") value = `${cell.score} đ`;
                  return (
                    <Row key={c.key} style={styles.detailRow}>
                      <Muted style={{ flex: 1 }}>{c.label}</Muted>
                      <Body style={cell && period === "week" && cell.net < 0 ? { color: colors.danger } : null}>{value}</Body>
                    </Row>
                  );
                })}
                {cats.length > 0 && (
                  <>
                    <Text style={styles.sub}>Điểm trừ theo mục</Text>
                    {cats.map(([name, pts]) => (
                      <Row key={name} style={styles.detailRow}>
                        <Muted style={{ flex: 1 }}>{name}</Muted>
                        <Body style={{ color: colors.danger }}>−{pts}</Body>
                      </Row>
                    ))}
                  </>
                )}
              </View>
            )}
          </Card>
        );
      })}

      {isHomeroom && data && (
        <Button
          icon="clipboard-outline"
          title="Học sinh bị ghi sổ thi đua"
          variant="light"
          onPress={() => navigation.navigate("DisciplineStudents", { period, date })}
        />
      )}
      {data && <Muted style={{ textAlign: "center", marginTop: space.md }}>Điểm gốc mỗi tuần: {data.basePoints}</Muted>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: { flexWrap: "nowrap", marginBottom: space.md, padding: 6, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow(1) },
  navBtn: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.primarySoft },
  range: { fontSize: 15, fontWeight: "800", color: colors.text },
  link: { color: colors.primary, fontSize: 13, fontWeight: "700", marginTop: 2 },
  rank: {
    width: 44,
    height: 44,
    borderRadius: 14,
    marginRight: space.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  rankText: { fontSize: 17, fontWeight: "900", color: colors.primary },
  className: { fontSize: 17, fontWeight: "800", color: colors.text },
  score: { fontSize: 26, fontWeight: "900", color: colors.primary, letterSpacing: -0.5 },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill },
  minus: { color: colors.danger, fontWeight: "800", fontSize: 13 },
  plus: { color: colors.success, fontWeight: "800", fontSize: 13 },
  days: { color: colors.text2, fontWeight: "700", fontSize: 13 },
  detail: { marginTop: space.md, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  detailRow: { paddingVertical: 5, flexWrap: "nowrap" },
  sub: { fontWeight: "800", color: colors.text, marginTop: space.sm, marginBottom: 2 },
});
