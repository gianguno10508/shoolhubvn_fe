// screens/TakeExamScreen.js — làm bài trắc nghiệm: đếm ngược, tự lưu đáp án, tự nộp khi hết giờ
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { Button, ErrorBox, Loading, Muted, Row, Screen } from "../components/ui";
import { colors, radius, space } from "../theme";
import { formatCountdown } from "../utils/format";

export default function TakeExamScreen({ navigation, route }) {
  const [paper, setPaper] = useState(null);
  const [answers, setAnswers] = useState({}); // questionNumber → key gốc (A/B/C/D)
  const [index, setIndex] = useState(0);
  const [left, setLeft] = useState(null); // số giây còn lại
  const [saving, setSaving] = useState("idle"); // idle | saving | saved | error
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const offsetRef = useRef(0); // giờ máy chủ − giờ máy
  const finishedRef = useRef(false);
  const saveTimer = useRef(null);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  useEffect(() => {
    api
      .startAssignment(route.params.id)
      .then((data) => {
        offsetRef.current = new Date(data.serverTime).getTime() - Date.now();
        setPaper(data);
        setAnswers(Object.fromEntries((data.answers || []).map((a) => [a.questionNumber, a.answer])));
      })
      .catch((err) => setError(err.message));
  }, [route.params.id]);

  const toList = (map) => Object.entries(map).map(([questionNumber, answer]) => ({ questionNumber: Number(questionNumber), answer }));

  const submit = useCallback(
    async (auto = false) => {
      if (!paper || finishedRef.current) return;
      finishedRef.current = true;
      setSubmitting(true);
      clearTimeout(saveTimer.current);
      try {
        const sid = paper.submission.id;
        await api.submitAssignment(sid, toList(answersRef.current));
        navigation.replace("ExamResult", { sid, auto });
      } catch (err) {
        finishedRef.current = false;
        setSubmitting(false);
        setError(err.message || "Không nộp được bài, hãy thử lại.");
      }
    },
    [paper, navigation],
  );

  // Đồng hồ đếm ngược theo giờ máy chủ
  useEffect(() => {
    if (!paper) return undefined;
    const end = new Date(paper.submission.expiresAt).getTime();
    const tick = () => {
      const s = Math.round((end - (Date.now() + offsetRef.current)) / 1000);
      setLeft(s);
      if (s <= 0) submit(true);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [paper, submit]);

  // Hỏi lại khi thoát giữa chừng (đáp án đã lưu, thời gian vẫn chạy)
  useEffect(
    () =>
      navigation.addListener("beforeRemove", (e) => {
        if (finishedRef.current || !paper) return;
        e.preventDefault();
        Alert.alert("Thoát bài thi?", "Đáp án đã được lưu nhưng thời gian làm bài vẫn tiếp tục chạy.", [
          { text: "Ở lại", style: "cancel" },
          { text: "Thoát", style: "destructive", onPress: () => navigation.dispatch(e.data.action) },
        ]);
      }),
    [navigation, paper],
  );

  function choose(number, key) {
    const next = { ...answersRef.current, [number]: key };
    setAnswers(next);
    // Tự lưu sau 0,8 giây không chọn thêm
    clearTimeout(saveTimer.current);
    setSaving("saving");
    saveTimer.current = setTimeout(() => {
      api
        .saveAnswers(paper.submission.id, toList(answersRef.current))
        .then(() => setSaving("saved"))
        .catch(() => setSaving("error"));
    }, 800);
  }

  function confirmSubmit() {
    const missing = paper.questions.length - Object.keys(answers).length;
    Alert.alert(
      "Nộp bài",
      missing > 0 ? `Bạn còn ${missing} câu chưa trả lời. Vẫn nộp bài?` : "Bạn chắc chắn muốn nộp bài?",
      [
        { text: "Làm tiếp", style: "cancel" },
        { text: "Nộp bài", onPress: () => submit(false) },
      ],
    );
  }

  if (!paper) return <Screen>{error ? <ErrorBox message={error} /> : <Loading label="Đang mở đề..." />}</Screen>;

  const q = paper.questions[index];
  const urgent = left !== null && left <= 60;
  const answered = Object.keys(answers).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.top}>
        <Text style={[styles.timer, urgent && { color: colors.danger }]}>⏱ {left === null ? "--:--" : formatCountdown(left)}</Text>
        <Muted>
          {answered}/{paper.questions.length} câu ·{" "}
          {saving === "saving" ? "Đang lưu..." : saving === "saved" ? "Đã lưu ✓" : saving === "error" ? "Lưu lỗi, sẽ thử lại" : ""}
        </Muted>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.palette} contentContainerStyle={{ paddingHorizontal: space.md }}>
        {paper.questions.map((x, i) => (
          <Pressable
            key={x.number}
            onPress={() => setIndex(i)}
            style={[styles.dot, answers[x.number] && styles.dotDone, i === index && styles.dotCurrent]}
          >
            <Text style={[styles.dotText, (answers[x.number] || i === index) && { color: "#fff" }]}>{i + 1}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Screen>
        <ErrorBox message={error} />
        <Text style={styles.qNum}>
          Câu {q.displayNumber}/{paper.questions.length}
        </Text>
        <Text style={styles.qText}>{q.text}</Text>
        {q.options.map((o) => {
          const selected = answers[q.number] === o.key;
          return (
            <Pressable key={o.key} onPress={() => choose(q.number, o.key)} style={[styles.option, selected && styles.optionOn]}>
              <View style={[styles.letter, selected && styles.letterOn]}>
                <Text style={[styles.letterText, selected && { color: "#fff" }]}>{o.letter}</Text>
              </View>
              <Text style={styles.optionText}>{o.text}</Text>
            </Pressable>
          );
        })}

        <Row style={{ marginTop: space.lg, gap: space.sm, flexWrap: "nowrap" }}>
          <Button title="Câu trước" icon="chevron-back" variant="light" disabled={index === 0} onPress={() => setIndex(index - 1)} style={{ flex: 1 }} />
          {index < paper.questions.length - 1 ? (
            <Button title="Câu sau" icon="chevron-forward" variant="soft" onPress={() => setIndex(index + 1)} style={{ flex: 1 }} />
          ) : (
            <Button title="Nộp bài" variant="success" onPress={confirmSubmit} loading={submitting} style={{ flex: 1 }} />
          )}
        </Row>
        {index < paper.questions.length - 1 && (
          <Button title="Nộp bài" variant="success" onPress={confirmSubmit} loading={submitting} style={{ marginTop: space.sm }} />
        )}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  timer: { fontSize: 20, fontWeight: "800", color: colors.primary, fontVariant: ["tabular-nums"] },
  palette: { flexGrow: 0, backgroundColor: colors.surface, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  dot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
    backgroundColor: colors.surface,
  },
  dotDone: { backgroundColor: colors.success, borderColor: colors.success },
  dotCurrent: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotText: { fontSize: 13, fontWeight: "700", color: colors.text2 },
  qNum: { fontSize: 13, fontWeight: "700", color: colors.primary, marginBottom: space.xs },
  qText: { fontSize: 17, lineHeight: 25, color: colors.text, marginBottom: space.lg },
  option: {
    flexDirection: "row",
    alignItems: "center",
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: space.sm,
  },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  letter: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", marginRight: space.md },
  letterOn: { backgroundColor: colors.primary },
  letterText: { fontWeight: "800", color: colors.text2 },
  optionText: { flex: 1, fontSize: 15, lineHeight: 22, color: colors.text },
});
