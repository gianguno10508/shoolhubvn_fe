// screens/ExamResultScreen.js — điểm bài làm (+ đáp án nếu giáo viên cho xem)
import { StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { Card, ErrorBox, Loading, Muted, Screen } from "../components/ui";
import { colors, radius, space } from "../theme";
import { formatDateTime } from "../utils/format";
import useAsync from "../utils/useAsync";

export default function ExamResultScreen({ route }) {
  const { data, error, loading, refreshing, reload } = useAsync(() => api.submission(route.params.sid), [route.params.sid]);
  const sub = data?.submission;

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <ErrorBox message={error} />
      {loading && !data && <Loading />}
      {data && (
        <>
          <Card style={styles.scoreCard}>
            <Muted style={{ textAlign: "center" }}>{data.assignment.title}</Muted>
            {sub.status === "submitted" ? (
              <>
                <Text style={styles.score}>
                  {sub.score}
                  <Text style={styles.total}>/{data.assignment.totalPoints}</Text>
                </Text>
                <Text style={styles.correct}>
                  Đúng {sub.correctCount}/{sub.totalQuestions} câu
                </Text>
                <Muted style={{ textAlign: "center" }}>
                  {route.params.auto || sub.autoSubmitted ? "Hệ thống tự nộp khi hết giờ · " : ""}Nộp lúc {formatDateTime(sub.submittedAt)}
                </Muted>
              </>
            ) : (
              <Text style={styles.correct}>Bài đang làm dở</Text>
            )}
          </Card>

          {!data.review && sub.status === "submitted" && <Muted style={{ textAlign: "center" }}>Giáo viên chưa cho xem đáp án của bài này.</Muted>}
          {data.review?.map((q) => {
            const right = q.chosen === q.correct;
            return (
              <Card key={q.number} style={{ borderLeftWidth: 4, borderLeftColor: right ? colors.success : colors.danger }}>
                <Text style={styles.qNum}>
                  Câu {q.displayNumber} {right ? "✓" : q.chosen ? "✗" : "(bỏ trống)"}
                </Text>
                <Text style={styles.qText}>{q.text}</Text>
                {q.options.map((o) => {
                  const isCorrect = o.key === q.correct;
                  const isChosen = o.key === q.chosen;
                  return (
                    <View key={o.key} style={[styles.opt, isCorrect && styles.optRight, isChosen && !isCorrect && styles.optWrong]}>
                      <Text style={[styles.optText, isCorrect && { fontWeight: "700" }]}>
                        {o.letter}. {o.text}
                        {isCorrect ? "  ✓" : isChosen ? "  (bạn chọn)" : ""}
                      </Text>
                    </View>
                  );
                })}
              </Card>
            );
          })}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scoreCard: { alignItems: "center", paddingVertical: space.xl },
  score: { fontSize: 52, fontWeight: "800", color: colors.primary, textAlign: "center", marginTop: space.sm },
  total: { fontSize: 24, color: colors.muted },
  correct: { fontSize: 16, fontWeight: "700", color: colors.text, textAlign: "center", marginBottom: space.xs },
  qNum: { fontSize: 13, fontWeight: "700", color: colors.text2, marginBottom: 4 },
  qText: { fontSize: 15, lineHeight: 22, color: colors.text, marginBottom: space.sm },
  opt: { padding: space.sm, borderRadius: radius.sm, marginBottom: 4, backgroundColor: "#F8FAFC" },
  optRight: { backgroundColor: colors.successSoft },
  optWrong: { backgroundColor: colors.dangerSoft },
  optText: { fontSize: 14, color: colors.text },
});
