// screens/ExamListScreen.js — học sinh / cờ đỏ: các bài thầy cô giao cho lớp
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { gameOf } from "../games/useGameSession";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Button, Card, Empty, ErrorBox, IconBox, Loading, Muted, Row, Screen, SectionTitle } from "../components/ui";
import { colors, space } from "../theme";
import { formatDateTime } from "../utils/format";

function Meta({ icon, text }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={14} color={colors.muted} />
      <Muted>{text}</Muted>
    </View>
  );
}

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
        <Row style={{ justifyContent: "space-between", flexWrap: "nowrap", alignItems: "flex-start" }}>
          <IconBox
            name={a.game ? "game-controller" : "document-text"}
            color={a.game ? colors.warning : colors.primary}
            bg={a.game ? colors.warningSoft : colors.primarySoft}
            size={42}
            style={{ marginRight: space.md }}
          />
          <Text style={styles.title} numberOfLines={2}>
            {a.title}
          </Text>
          {a.inProgressId ? (
            <Badge label="Đang làm" icon="hourglass-outline" color={colors.warning} bg={colors.warningSoft} />
          ) : done ? (
            <Badge label={`${a.bestScore}/${a.totalPoints} đ`} icon="checkmark-circle" color={colors.success} bg={colors.successSoft} />
          ) : a.isOpen ? (
            <Badge label="Chưa làm" icon="ellipse-outline" />
          ) : (
            <Badge label="Đã đóng" icon="lock-closed-outline" color={colors.text2} bg="#F1F5F9" />
          )}
        </Row>
        {a.game ? (
          <Text style={styles.game}>Trò chơi: {gameOf(a.game).name}</Text>
        ) : null}
        {a.description ? <Muted numberOfLines={2}>{a.description}</Muted> : null}
        <View style={styles.meta}>
          <Meta icon="help-circle-outline" text={`${a.questionCount} câu`} />
          <Meta icon="timer-outline" text={`${a.durationMinutes} phút`} />
          <Meta icon="repeat-outline" text={`Lượt ${a.attemptsUsed}/${a.maxAttempts}`} />
        </View>
        <Meta icon="calendar-outline" text={`Hạn nộp: ${formatDateTime(a.dueAt)}`} />
        <Row style={{ marginTop: space.md, gap: space.sm }}>
          {a.canStart && a.game && (
            <Button
              small
              icon="game-controller-outline"
              title={a.inProgressId ? "Chơi tiếp" : done ? "Chơi lại" : "Vào chơi"}
              onPress={() => navigation.navigate("PlayGame", { id: a.id, title: a.title, game: a.game })}
            />
          )}
          {a.canStart && !a.game && (
            <Button
              small
              icon={done && !a.inProgressId ? "refresh" : "play"}
              title={a.inProgressId ? "Làm tiếp" : done ? "Làm lại" : "Vào thi"}
              onPress={() => navigation.navigate("TakeExam", { id: a.id, title: a.title })}
            />
          )}
          {a.lastSubmissionId && (
            <Button small variant="soft" icon="stats-chart-outline" title="Xem kết quả" onPress={() => navigation.navigate("ExamResult", { sid: a.lastSubmissionId })} />
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
      {open.length > 0 && <SectionTitle title={`Đang mở · ${open.length}`} />}
      {open.map(renderItem)}
      {others.length > 0 && <SectionTitle title="Đã làm / đã đóng" />}
      <View>{others.map(renderItem)}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  game: { fontSize: 13, fontWeight: "800", color: colors.warning, marginBottom: 4 },
  title: { flex: 1, fontSize: 16, fontWeight: "800", color: colors.text, marginRight: space.sm, marginBottom: 4, lineHeight: 22 },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 6, marginBottom: 2 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
});
