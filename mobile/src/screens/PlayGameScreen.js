// screens/PlayGameScreen.js — học sinh chơi bài tập dạng trò chơi (giáo viên chọn trò khi giao bài trên web)
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { ErrorBox, Loading, Screen } from "../components/ui";
import { GameOverCard, Hearts, IntroCard, QuestionCard, QuestionTimer, themeOf } from "../games/GameKit";
import { MillionaireStage, ObstacleStage, ZombieStage, prizeAt } from "../games/GameStages";
import useGameSession from "../games/useGameSession";
import { space } from "../theme";
import { formatCountdown } from "../utils/format";

export default function PlayGameScreen({ navigation, route }) {
  const { id, game: gameKey, title } = route.params;
  const session = useGameSession(id, gameKey);
  const { game, paper, phase, error, question, total, answeredCount, correct, wrong, lives, feedback, qLeft, timeLeft, result } =
    session;
  const theme = themeOf(gameKey);
  const [helps, setHelps] = useState({ postpone: false, time: false });

  // Thoát giữa chừng: các câu đã chốt vẫn giữ, lần sau vào chơi tiếp
  useEffect(
    () =>
      navigation.addListener("beforeRemove", (e) => {
        if (!paper || phase === "intro" || session.finished()) return;
        e.preventDefault();
        Alert.alert("Thoát trò chơi?", "Các câu đã trả lời vẫn được giữ, nhưng thời gian làm bài vẫn tiếp tục chạy.", [
          { text: "Chơi tiếp", style: "cancel" },
          { text: "Thoát", style: "destructive", onPress: () => navigation.dispatch(e.data.action) },
        ]);
      }),
    [navigation, paper, phase, session],
  );

  if (!paper) return <Screen>{error ? <ErrorBox message={error} /> : <Loading label="Đang chuẩn bị trò chơi..." />}</Screen>;

  const playing = phase === "question" || phase === "checking" || phase === "reveal";

  function stageView() {
    if (gameKey === "millionaire") {
      return (
        <MillionaireStage
          level={correct}
          total={total}
          feedback={feedback}
          helps={helps}
          canHelp={phase === "question"}
          onPostpone={() => session.postpone() && setHelps((h) => ({ ...h, postpone: true }))}
          onAddTime={() => {
            session.addTime(15);
            setHelps((h) => ({ ...h, time: true }));
          }}
        />
      );
    }
    if (gameKey === "zombie") {
      return <ZombieStage hp={total - correct} maxHp={total} livesLost={wrong} maxLives={game.lives} feedback={feedback} />;
    }
    return <ObstacleStage done={answeredCount} total={total} feedback={feedback} />;
  }

  const winTitle =
    gameKey === "millionaire"
      ? `Bạn giành được ${prizeAt(correct, total).toLocaleString("vi-VN")} đ!`
      : gameKey === "zombie"
        ? "Zombie đã bị hạ gục!"
        : "Về đích!";

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={[styles.hud, { borderBottomColor: theme.border }]}>
        <Hearts lives={lives} max={game.lives} />
        <Text style={[styles.hudText, { color: theme.text }]}>✓ {correct}</Text>
        <Text style={[styles.hudText, { color: timeLeft !== null && timeLeft <= 60 ? "#DC2626" : theme.sub }]}>
          ⏱ {timeLeft === null ? "--:--" : formatCountdown(Math.max(0, timeLeft))}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <ErrorBox message={phase === "over" ? "" : error} />
        {stageView()}

        {phase === "intro" && <IntroCard session={session} title={title} theme={theme} />}

        {playing && question && (
          <>
            <QuestionTimer left={qLeft} total={game.seconds} theme={theme} />
            <QuestionCard
              question={question}
              index={Math.min(answeredCount + (phase === "reveal" ? 0 : 1), total)}
              total={total}
              phase={phase}
              feedback={feedback}
              onAnswer={session.answer}
              theme={theme}
            />
          </>
        )}

        {phase === "over" && result && (
          <GameOverCard
            session={session}
            theme={theme}
            winTitle={winTitle}
            onViewResult={() => navigation.replace("ExamResult", { sid: paper.submission.id, auto: result.outcome === "timeup" })}
            onBack={() => navigation.goBack()}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hud: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
  },
  hudText: { fontSize: 16, fontWeight: "800", fontVariant: ["tabular-nums"] },
  body: { padding: space.lg, paddingBottom: space.xl * 2 },
});
