// screens/DisciplineStudentsScreen.js — GVCN: danh sách học sinh lớp mình bị ghi tên trong sổ thi đua
import { useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { Body, Button, Card, Empty, ErrorBox, Loading, Muted, Row, Screen, Segmented } from "../components/ui";
import { colors, space } from "../theme";
import { formatDate, shortDay, todayISO } from "../utils/format";
import useAsync from "../utils/useAsync";

export default function DisciplineStudentsScreen({ route }) {
  const [period, setPeriod] = useState(route.params?.period || "week");
  const date = route.params?.date || todayISO();
  const [open, setOpen] = useState(null);
  const { data, error, loading, refreshing, reload } = useAsync(() => api.disciplineStudents({ period, date }), [period, date]);

  const title = data ? `Lớp ${data.className} · ${formatDate(data.start)} – ${formatDate(data.end)}` : "";

  /** "Lưu lại" danh sách: chia sẻ dạng văn bản (Zalo, ghi chú, email...) */
  async function share() {
    const lines = [`HỌC SINH BỊ GHI SỔ THI ĐUA`, title, ""];
    data.students.forEach((s, i) => {
      lines.push(`${i + 1}. ${s.name} — ${s.count} lần, −${s.totalPoints} điểm`);
      s.items.forEach((it) => lines.push(`   • ${shortDay(it.date)}: ${it.itemName} (${it.categoryName}) −${it.points}`));
    });
    await Share.share({ title: "Học sinh bị ghi sổ thi đua", message: lines.join("\n") }).catch(() => {});
  }

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <Segmented
        options={[
          { value: "week", label: "Tuần" },
          { value: "month", label: "Tháng" },
        ]}
        value={period}
        onChange={setPeriod}
      />
      {data && <Text style={styles.range}>{title}</Text>}
      <ErrorBox message={error} />
      {loading && !data && <Loading />}
      {data && data.students.length === 0 && <Empty icon="🎉" title="Không có học sinh nào bị ghi tên" hint="Lớp giữ nề nếp tốt trong kỳ này." />}
      {data && data.students.length > 0 && (
        <Button title="📤 Lưu lại / chia sẻ danh sách" variant="light" onPress={share} style={{ marginBottom: space.md }} />
      )}
      {data?.students.map((s, i) => {
        const expanded = open === i;
        return (
          <Card key={`${s.name}-${i}`} onPress={() => setOpen(expanded ? null : i)}>
            <Row style={{ flexWrap: "nowrap" }}>
              <Text style={styles.index}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{s.name}</Text>
                <Muted>{s.count} lần bị ghi tên</Muted>
              </View>
              <Text style={styles.points}>−{s.totalPoints}</Text>
            </Row>
            {expanded && (
              <View style={styles.detail}>
                {s.items.map((it, k) => (
                  <Row key={k} style={styles.item}>
                    <Muted style={{ width: 48 }}>{shortDay(it.date)}</Muted>
                    <Body style={{ flex: 1 }}>
                      {it.itemName} <Text style={{ color: colors.muted }}>({it.categoryName})</Text>
                    </Body>
                    <Text style={{ color: colors.danger }}>−{it.points}</Text>
                  </Row>
                ))}
              </View>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  range: { fontWeight: "700", color: colors.text, marginBottom: space.md, textAlign: "center" },
  index: { width: 30, fontSize: 16, fontWeight: "700", color: colors.muted },
  name: { fontSize: 16, fontWeight: "700", color: colors.text },
  points: { fontSize: 18, fontWeight: "800", color: colors.danger },
  detail: { marginTop: space.sm, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  item: { flexWrap: "nowrap", paddingVertical: 3 },
});
