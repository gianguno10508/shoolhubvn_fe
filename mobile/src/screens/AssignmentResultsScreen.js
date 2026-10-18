// screens/AssignmentResultsScreen.js — giáo viên xem các bài tập mình đã giao + tiến độ nộp bài
import { StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { Badge, Card, Empty, ErrorBox, Loading, Muted, Row, Screen } from "../components/ui";
import { colors, space } from "../theme";
import { formatDateTime } from "../utils/format";
import useAsync from "../utils/useAsync";

export default function AssignmentResultsScreen({ navigation }) {
  const { data, error, loading, refreshing, reload } = useAsync(() => api.assignments(), []);

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <ErrorBox message={error} />
      {loading && !data && <Loading />}
      {data?.length === 0 && <Empty icon="📝" title="Bạn chưa giao bài tập nào" hint="Giao bài tập trên bản web, kết quả sẽ hiện ở đây." />}
      {data?.map((a) => {
        const percent = a.studentCount ? Math.round((a.submittedCount / a.studentCount) * 100) : 0;
        const status = a.isOpen ? ["Đang mở", colors.success, colors.successSoft] : a.status === "closed" ? ["Đã đóng", colors.text2, "#F1F5F9"] : new Date(a.dueAt) < new Date() ? ["Hết hạn", colors.danger, colors.dangerSoft] : ["Chưa mở", colors.warning, colors.warningSoft];
        return (
          <Card key={a.id} onPress={() => navigation.navigate("AssignmentDetail", { id: a.id, title: a.title })}>
            <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
              <Text style={styles.title} numberOfLines={2}>
                {a.title}
              </Text>
              <Badge label={status[0]} color={status[1]} bg={status[2]} />
            </Row>
            <Muted>
              {a.classNames.length ? `Lớp ${a.classNames.join(", ")}` : ""} · {a.questionCount} câu · Hạn {formatDateTime(a.dueAt)}
            </Muted>
            <View style={styles.bar}>
              <View style={[styles.fill, { width: `${percent}%` }]} />
            </View>
            <Row style={{ justifyContent: "space-between" }}>
              <Muted>
                {a.submittedCount}/{a.studentCount} học sinh đã nộp
              </Muted>
              <Text style={styles.avg}>{a.averageScore !== null ? `TB ${a.averageScore}/${a.totalPoints}` : "Chưa có điểm"}</Text>
            </Row>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.text, marginRight: space.sm, marginBottom: 4 },
  bar: { height: 6, backgroundColor: "#E5E7EB", borderRadius: 3, overflow: "hidden", marginVertical: 8 },
  fill: { height: 6, backgroundColor: colors.primary },
  avg: { fontWeight: "700", color: colors.primary },
});
