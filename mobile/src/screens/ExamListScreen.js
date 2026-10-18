// screens/ExamListScreen.js — học sinh / cờ đỏ: các bài thầy cô giao cho lớp
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { Badge, Button, Card, Empty, ErrorBox, Loading, Muted, Row, Screen } from "../components/ui";
import { colors, space } from "../theme";
import { formatDateTime } from "../utils/format";

export default function ExamListScreen({ navigation }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    setError("");
    try {
      setList(await api.myAssignments());
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Tải lại mỗi lần quay về (VD: vừa nộp bài xong)
  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  const open = list?.filter((a) => a.canStart) || [];
  const others = list?.filter((a) => !a.canStart) || [];

  function renderItem(a) {
    const done = a.bestScore !== null;
    return (
      <Card key={a.id}>
        <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
          <Text style={styles.title} numberOfLines={2}>
            {a.title}
          </Text>
          {a.inProgressId ? (
            <Badge label="Đang làm" color={colors.warning} bg={colors.warningSoft} />
          ) : done ? (
            <Badge label={`${a.bestScore}/${a.totalPoints} đ`} color={colors.success} bg={colors.successSoft} />
          ) : a.isOpen ? (
            <Badge label="Chưa làm" />
          ) : (
            <Badge label="Đã đóng" color={colors.text2} bg="#F1F5F9" />
          )}
        </Row>
        {a.description ? <Muted numberOfLines={2}>{a.description}</Muted> : null}
        <Muted style={{ marginTop: 4 }}>
          {a.questionCount} câu · {a.durationMinutes} phút · Lượt {a.attemptsUsed}/{a.maxAttempts}
        </Muted>
        <Muted>Hạn nộp: {formatDateTime(a.dueAt)}</Muted>
        <Row style={{ marginTop: space.md, gap: space.sm }}>
          {a.canStart && (
            <Button
              small
              title={a.inProgressId ? "▶ Làm tiếp" : done ? "Làm lại" : "▶ Vào thi"}
              onPress={() => navigation.navigate("TakeExam", { id: a.id, title: a.title })}
            />
          )}
          {a.lastSubmissionId && (
            <Button small variant="light" title="Xem kết quả" onPress={() => navigation.navigate("ExamResult", { sid: a.lastSubmissionId })} />
          )}
        </Row>
      </Card>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => load(true)}>
      <ErrorBox message={error} />
      {list === null && !error && <Loading />}
      {list?.length === 0 && <Empty icon="📚" title="Chưa có bài nào được giao" hint="Khi thầy cô giao bài cho lớp, bài sẽ hiện ở đây." />}
      {open.length > 0 && <Text style={styles.section}>Đang mở ({open.length})</Text>}
      {open.map(renderItem)}
      {others.length > 0 && <Text style={styles.section}>Đã làm / đã đóng</Text>}
      <View>{others.map(renderItem)}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 14, fontWeight: "700", color: colors.text2, marginBottom: space.sm, marginTop: space.xs },
  title: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.text, marginRight: space.sm, marginBottom: 4 },
});
