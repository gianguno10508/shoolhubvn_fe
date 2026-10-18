// screens/AssignmentDetailScreen.js — kết quả từng học sinh của 1 bài tập
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { Badge, Card, Empty, ErrorBox, Loading, Muted, Row, Screen, Segmented } from "../components/ui";
import { colors, space } from "../theme";
import { formatDateTime } from "../utils/format";
import useAsync from "../utils/useAsync";

const STATUS = {
  submitted: ["Đã nộp", colors.success, colors.successSoft],
  in_progress: ["Đang làm", colors.warning, colors.warningSoft],
  not_started: ["Chưa làm", colors.text2, "#F1F5F9"],
};

export default function AssignmentDetailScreen({ route }) {
  const { data, error, loading, refreshing, reload } = useAsync(() => api.assignmentSubmissions(route.params.id), [route.params.id]);
  const [filter, setFilter] = useState("all");

  const rows = (data?.rows || []).filter((r) => filter === "all" || (filter === "done" ? r.status === "submitted" : r.status !== "submitted"));
  const s = data?.stats;
  const total = data?.assignment.totalPoints;

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <ErrorBox message={error} />
      {loading && !data && <Loading />}
      {data && (
        <>
          <Card>
            <Text style={styles.title}>{data.assignment.title}</Text>
            <Muted>
              {data.assignment.questionCount} câu · {data.assignment.durationMinutes} phút · Hạn {formatDateTime(data.assignment.dueAt)}
            </Muted>
            <Row style={styles.stats}>
              <Stat label="Đã nộp" value={`${s.submitted}/${s.students}`} />
              <Stat label="Điểm TB" value={s.average ?? "—"} />
              <Stat label="Cao nhất" value={s.highest ?? "—"} />
              <Stat label="Thấp nhất" value={s.lowest ?? "—"} />
            </Row>
          </Card>
          <Segmented
            options={[
              { value: "all", label: `Tất cả (${data.rows.length})` },
              { value: "done", label: "Đã nộp" },
              { value: "todo", label: "Chưa nộp" },
            ]}
            value={filter}
            onChange={setFilter}
          />
          {rows.length === 0 && <Empty icon="👥" title="Không có học sinh nào" />}
          {rows.map((r) => {
            const st = STATUS[r.status] || STATUS.not_started;
            return (
              <Card key={String(r.studentId)} style={styles.row}>
                <Row style={{ flexWrap: "nowrap" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{r.studentName || r.studentUsername}</Text>
                    <Muted>
                      Lớp {r.className}
                      {r.attempts ? ` · ${r.attempts} lượt` : ""}
                      {r.leftClass ? " · đã rời lớp" : ""}
                    </Muted>
                    {r.best?.submittedAt && <Muted>Nộp {formatDateTime(r.best.submittedAt)}</Muted>}
                  </View>
                  {r.best ? (
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.score}>{r.best.score}</Text>
                      <Muted>
                        /{total} · {r.best.correctCount}/{r.best.totalQuestions} câu
                      </Muted>
                    </View>
                  ) : (
                    <Badge label={st[0]} color={st[1]} bg={st[2]} />
                  )}
                </Row>
              </Card>
            );
          })}
        </>
      )}
    </Screen>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Muted>{label}</Muted>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 4 },
  stats: { marginTop: space.md, justifyContent: "space-between", flexWrap: "nowrap" },
  stat: { alignItems: "center", flex: 1 },
  statValue: { fontSize: 18, fontWeight: "800", color: colors.primary },
  row: { paddingVertical: space.md },
  name: { fontSize: 15, fontWeight: "700", color: colors.text },
  score: { fontSize: 22, fontWeight: "800", color: colors.success },
});
