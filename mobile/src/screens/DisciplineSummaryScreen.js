// screens/DisciplineSummaryScreen.js — điểm tổng kết thi đua tuần / tháng
// BGH, tài khoản trường, Đoàn TN: xếp hạng mọi lớp; GVCN: chỉ lớp mình (backend lọc sẵn, vẫn giữ thứ hạng)
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { Body, Button, Card, Empty, ErrorBox, Loading, Muted, Row, Screen, Segmented } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { colors, space } from "../theme";
import { addDaysISO, formatDate, todayISO } from "../utils/format";
import useAsync from "../utils/useAsync";

const MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" };

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
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.range}>{rangeLabel}</Text>
          {data && !isCurrent && (
            <Pressable onPress={() => setDate(todayISO())}>
              <Text style={styles.link}>Về kỳ hiện tại</Text>
            </Pressable>
          )}
        </View>
        <Pressable onPress={() => setDate(shiftPeriod(period, date, 1))} style={styles.navBtn} disabled={isCurrent}>
          <Text style={[styles.navText, isCurrent && { color: colors.muted }]}>›</Text>
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
              <Text style={styles.rank}>{MEDAL[r.rank] || `#${r.rank}`}</Text>
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
            <Row style={{ marginTop: 6, gap: space.md }}>
              <Text style={styles.minus}>−{r.penalty} trừ</Text>
              <Text style={styles.plus}>+{r.bonus} cộng</Text>
              <Muted>{r.recordedDays} ngày đã chấm</Muted>
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
          title="📋 Học sinh bị ghi sổ thi đua"
          variant="light"
          onPress={() => navigation.navigate("DisciplineStudents", { period, date })}
        />
      )}
      {data && <Muted style={{ textAlign: "center", marginTop: space.md }}>Điểm gốc mỗi tuần: {data.basePoints}</Muted>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: { flexWrap: "nowrap", marginBottom: space.md },
  navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  navText: { fontSize: 24, color: colors.primary, marginTop: -2 },
  range: { fontSize: 15, fontWeight: "700", color: colors.text },
  link: { color: colors.primary, fontSize: 13, marginTop: 2 },
  rank: { fontSize: 22, width: 46, fontWeight: "700", color: colors.text2 },
  className: { fontSize: 17, fontWeight: "700", color: colors.text },
  score: { fontSize: 24, fontWeight: "800", color: colors.primary },
  minus: { color: colors.danger, fontWeight: "600" },
  plus: { color: colors.success, fontWeight: "600" },
  detail: { marginTop: space.md, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  detailRow: { paddingVertical: 4, flexWrap: "nowrap" },
  sub: { fontWeight: "700", color: colors.text, marginTop: space.sm, marginBottom: 2 },
});
