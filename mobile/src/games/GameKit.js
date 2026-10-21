// games/GameKit.js — phần giao diện dùng chung cho các trò chơi: câu hỏi, mạng, đồng hồ, màn mở đầu / kết thúc
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { radius, space } from "../theme";

/* Bảng màu riêng từng trò chơi */
export const THEMES = {
  obstacle: { bg: "#E0F2FE", card: "#FFFFFF", text: "#0F172A", sub: "#475569", accent: "#0284C7", border: "#BAE6FD", option: "#F8FAFC" },
  millionaire: { bg: "#0B1437", card: "#131F4F", text: "#F8FAFC", sub: "#A5B4FC", accent: "#F59E0B", border: "#3346A0", option: "#1A2A66" },
  zombie: { bg: "#0E1A12", card: "#16251A", text: "#E8F5E9", sub: "#9CC5A1", accent: "#22C55E", border: "#2C4A33", option: "#1D3223" },
};

export const themeOf = (key) => THEMES[key] || THEMES.obstacle;

const RIGHT = "#16A34A";
const WRONG = "#DC2626";

export function Hearts({ lives, max }) {
  if (max <= 1) return null;
  return (
    <Text style={styles.hearts}>
      {Array.from({ length: max }, (_, i) => (i < lives ? "❤️" : "🖤")).join(" ")}
    </Text>
  );
}

/** Thanh thời gian của câu đang hỏi */
export function QuestionTimer({ left, total, theme }) {
  const urgent = left <= 5;
  return (
    <View style={[styles.timerTrack, { backgroundColor: theme.border }]}>
      <View
        style={[
          styles.timerFill,
          { width: `${Math.min(100, (left / total) * 100)}%`, backgroundColor: urgent ? WRONG : theme.accent },
        ]}
      />
      <Text style={[styles.timerText, { color: urgent ? WRONG : theme.text }]}>{left}s</Text>
    </View>
  );
}

/** Câu hỏi + 4 phương án. Lúc hiện kết quả: tô xanh/đỏ phương án đã chọn (và đáp án đúng nếu giáo viên cho xem).
 *  hidden: các phương án bị loại bởi quyền 50:50 (giữ chỗ nhưng để trống, không bấm được) */
export function QuestionCard({ question, index, total, phase, feedback, onAnswer, theme, hidden = [] }) {
  const shake = useRef(new Animated.Value(0)).current;
  const [picked, setPicked] = useState(null); // phương án vừa bấm, chờ máy chủ chấm
  useEffect(() => setPicked(null), [question.number]);
  const showing = phase === "reveal" && feedback?.number === question.number ? feedback : null;

  useEffect(() => {
    if (!showing || showing.correct) return;
    Animated.sequence(
      [10, -10, 8, -8, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 60, useNativeDriver: true })),
    ).start();
  }, [showing, shake]);

  return (
    <Animated.View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, transform: [{ translateX: shake }] }]}>
      <Text style={[styles.qNum, { color: theme.accent }]}>
        Câu {index}/{total}
      </Text>
      <Text style={[styles.qText, { color: theme.text }]}>{question.text}</Text>
      {question.options.map((o) => {
        const chosen = showing?.chosen === o.key || (phase === "checking" && picked === o.key);
        const isRight = showing && (showing.correctAnswer === o.key || (chosen && showing.correct));
        const isWrong = showing && chosen && !showing.correct;
        const bg = isRight ? RIGHT : isWrong ? WRONG : chosen ? theme.accent : theme.option;
        const gone = hidden.includes(o.key) && !isRight;
        return (
          <Pressable
            key={o.key}
            disabled={phase !== "question" || gone}
            onPress={() => {
              setPicked(o.key);
              onAnswer(o.key);
            }}
            style={({ pressed }) => [
              styles.option,
              { backgroundColor: bg, borderColor: isRight || isWrong || chosen ? bg : theme.border, opacity: gone ? 0.35 : pressed ? 0.8 : 1 },
            ]}
          >
            <View style={[styles.letter, { backgroundColor: isRight || isWrong || chosen ? "rgba(255,255,255,0.25)" : theme.accent }]}>
              <Text style={styles.letterText}>{o.letter}</Text>
            </View>
            <Text style={[styles.optionText, { color: isRight || isWrong || chosen ? "#fff" : theme.text }]}>{gone ? "" : o.text}</Text>
          </Pressable>
        );
      })}
      {phase === "checking" && <ActivityIndicator color={theme.accent} style={{ marginTop: space.sm }} />}
      {showing && (
        <Text style={[styles.verdict, { color: showing.correct ? RIGHT : WRONG }]}>
          {showing.correct ? "✓ Chính xác!" : showing.chosen ? "✗ Sai rồi!" : "⏰ Hết giờ!"}
        </Text>
      )}
    </Animated.View>
  );
}

function BigButton({ title, onPress, theme, ghost, loading }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.big,
        ghost ? { borderColor: theme.border, backgroundColor: "transparent" } : { backgroundColor: theme.accent, borderColor: theme.accent },
        { opacity: pressed || loading ? 0.8 : 1 },
      ]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.bigText, { color: ghost ? theme.text : "#fff" }]}>{title}</Text>}
    </Pressable>
  );
}

/** Màn mở đầu: tên trò chơi, luật chơi, nút bắt đầu / chơi tiếp */
export function IntroCard({ session, title, theme }) {
  const { game, total, answeredCount, resumed, begin } = session;
  return (
    <View style={[styles.card, styles.center, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={styles.introIcon}>{game.icon}</Text>
      <Text style={[styles.introTitle, { color: theme.text }]}>{game.name}</Text>
      <Text style={[styles.introSub, { color: theme.sub }]}>{title}</Text>
      <Text style={[styles.rules, { color: theme.text }]}>{game.rules}</Text>
      <Text style={[styles.introSub, { color: theme.sub }]}>
        {total} câu · {game.seconds} giây/câu{resumed ? ` · đã chơi ${answeredCount} câu` : ""}
      </Text>
      <BigButton title={resumed ? "▶ Chơi tiếp" : "▶ Bắt đầu"} onPress={begin} theme={theme} />
    </View>
  );
}

const OUTCOME = {
  win: { icon: "🏆", title: "Chiến thắng!" },
  lose: { icon: "💀", title: "Thua rồi!" },
  timeup: { icon: "⏰", title: "Hết giờ làm bài!" },
};

/** Màn kết thúc: kết quả + điểm sau khi nộp */
export function GameOverCard({ session, theme, onViewResult, onBack, winTitle }) {
  const { result, correct, total, error, finish } = session;
  const o = OUTCOME[result.outcome];
  const sub = result.submission;
  return (
    <View style={[styles.card, styles.center, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={styles.introIcon}>{o.icon}</Text>
      <Text style={[styles.introTitle, { color: theme.text }]}>{result.outcome === "win" && winTitle ? winTitle : o.title}</Text>
      <Text style={[styles.overCount, { color: theme.accent }]}>
        Đúng {correct}/{total} câu
      </Text>
      {sub ? (
        <Text style={[styles.introSub, { color: theme.sub }]}>
          Điểm: <Text style={{ fontWeight: "800", color: theme.text }}>{sub.score}</Text> — đã ghi vào bài tập
        </Text>
      ) : error ? (
        <>
          <Text style={[styles.introSub, { color: WRONG }]}>{error}</Text>
          <BigButton title="Nộp lại" onPress={() => finish(result.outcome)} theme={theme} />
        </>
      ) : (
        <ActivityIndicator color={theme.accent} style={{ marginVertical: space.md }} />
      )}
      {sub && <BigButton title="Xem kết quả" onPress={onViewResult} theme={theme} />}
      {sub && <BigButton title="Về danh sách bài" onPress={onBack} theme={theme} ghost />}
    </View>
  );
}

const styles = StyleSheet.create({
  hearts: { fontSize: 16, letterSpacing: 1 },
  timerTrack: { height: 22, borderRadius: 11, overflow: "hidden", justifyContent: "center", marginBottom: space.md },
  timerFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 11 },
  timerText: { alignSelf: "center", fontSize: 12, fontWeight: "800", fontVariant: ["tabular-nums"] },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, marginBottom: space.md },
  center: { alignItems: "center" },
  qNum: { fontSize: 13, fontWeight: "800", marginBottom: space.xs },
  qText: { fontSize: 17, lineHeight: 25, fontWeight: "600", marginBottom: space.md },
  option: { flexDirection: "row", alignItems: "center", padding: space.md, borderRadius: radius.md, borderWidth: 1.5, marginBottom: space.sm },
  letter: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginRight: space.md },
  letterText: { fontWeight: "800", color: "#fff" },
  optionText: { flex: 1, fontSize: 15, lineHeight: 22 },
  verdict: { textAlign: "center", fontSize: 18, fontWeight: "800", marginTop: space.sm },
  introIcon: { fontSize: 64, marginBottom: space.sm },
  introTitle: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  introSub: { fontSize: 14, textAlign: "center", marginTop: space.xs },
  rules: { fontSize: 15, lineHeight: 22, textAlign: "center", marginVertical: space.md },
  overCount: { fontSize: 20, fontWeight: "800", marginTop: space.sm },
  big: { alignSelf: "stretch", borderRadius: radius.md, borderWidth: 1.5, paddingVertical: 14, alignItems: "center", marginTop: space.md },
  bigText: { fontSize: 16, fontWeight: "800" },
});
