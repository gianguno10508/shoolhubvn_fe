// pages/assignments/play/useGameSession.js — luật chơi chung cho bài tập dạng trò chơi (giống app mobile):
// chốt từng câu với máy chủ (biết đúng/sai ngay), đếm mạng, đếm giờ, tự nộp khi kết thúc. Không có bảng xếp hạng.
import { useCallback, useEffect, useRef, useState } from "react";
import { checkAnswer, submitAssignment } from "../../../api/assignments";

/* lives: số lần được sai; seconds: thời gian mỗi câu (hết giờ = sai) */
export const PLAY_RULES = {
  obstacle: {
    lives: 3,
    seconds: 30,
    rules: "Trả lời đúng để nhảy qua chướng ngại vật và về đích. Sai hoặc hết giờ là mất 1 mạng — hết 3 mạng thì dừng cuộc chơi.",
  },
  millionaire: {
    lives: 1,
    seconds: 30,
    rules: "Mỗi câu đúng leo thêm 1 bậc tiền thưởng. Sai hoặc hết giờ là dừng cuộc chơi. Có 2 quyền trợ giúp: hoãn câu và thêm 15 giây.",
  },
  zombie: {
    lives: 3,
    seconds: 25,
    rules: "Mỗi câu đúng là một phát bắn trúng zombie, đúng hết là hạ gục. Sai hoặc hết giờ thì bị zombie chém mất 1 mạng — hết 3 mạng là thua.",
  },
};

export const rulesOf = (key) => PLAY_RULES[key] || PLAY_RULES.obstacle;

const REVEAL_MS = 1500; // thời gian hiện đúng/sai trước khi sang câu mới

/** paper: kết quả POST /assignments/:id/start */
export default function useGameSession(paper) {
  const game = rulesOf(paper.assignment.game);
  const sid = paper.submission.id;
  const total = paper.questions.length;

  const [phase, setPhase] = useState("intro"); // intro | question | checking | reveal | over
  const [queue, setQueue] = useState(() => {
    const done = new Set((paper.checked || []).map((c) => c.questionNumber));
    return paper.questions.filter((q) => !done.has(q.number));
  });
  const [correct, setCorrect] = useState(() => (paper.checked || []).filter((c) => c.correct).length);
  const [wrong, setWrong] = useState(() => (paper.checked || []).filter((c) => !c.correct).length);
  const [feedback, setFeedback] = useState(null); // { number, chosen, correct, correctAnswer, seq }
  const [qLeft, setQLeft] = useState(game.seconds);
  const [timeLeft, setTimeLeft] = useState(null); // giây còn lại của cả lượt (theo giờ máy chủ)
  const [result, setResult] = useState(null); // { outcome: win | lose | timeup, submission }
  const [error, setError] = useState("");

  const offsetRef = useRef(new Date(paper.serverTime).getTime() - Date.now());
  const finishedRef = useRef(false);
  const timers = useRef([]);
  const lives = game.lives - wrong;

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const finish = useCallback(
    async (outcome) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setPhase("over");
      setResult({ outcome, submission: null });
      setError("");
      try {
        const r = await submitAssignment(sid);
        setResult({ outcome, submission: r.submission });
      } catch (err) {
        finishedRef.current = false; // cho bấm "Nộp lại"
        setError(err.message || "Không nộp được kết quả, hãy thử lại.");
      }
    },
    [sid],
  );

  const begin = useCallback(() => {
    if (lives <= 0) return finish("lose");
    if (!queue.length) return finish("win");
    setQLeft(game.seconds);
    setPhase("question");
  }, [lives, queue.length, game.seconds, finish]);

  /** key = chữ cái gốc của phương án; null = hết giờ */
  const answer = useCallback(
    async (key) => {
      const q = queue[0];
      if (phase !== "question" || !q) return;
      setPhase("checking");
      setError("");
      try {
        const body = key ? { questionNumber: q.number, answer: key } : { questionNumber: q.number, timeout: true };
        const r = await checkAnswer(sid, body);
        setFeedback({ number: q.number, chosen: key, correct: r.correct, correctAnswer: r.correctAnswer, seq: Date.now() });
        if (r.correct) setCorrect((n) => n + 1);
        else setWrong((n) => n + 1);
        setPhase("reveal");

        const livesAfter = lives - (r.correct ? 0 : 1);
        const remaining = queue.length - 1;
        timers.current.push(
          setTimeout(() => {
            if (finishedRef.current) return;
            if (livesAfter <= 0) return finish("lose");
            if (remaining <= 0) return finish("win");
            setQueue((list) => list.slice(1));
            setQLeft(game.seconds);
            setPhase("question");
          }, REVEAL_MS),
        );
      } catch (err) {
        if (err.status === 409) return finish("timeup"); // lượt đã bị máy chủ tự nộp
        setError(err.message || "Mất kết nối, hãy chọn lại.");
        setPhase("question");
      }
    },
    [phase, queue, sid, lives, game.seconds, finish],
  );

  const answerRef = useRef(answer);
  answerRef.current = answer;

  // Đếm giờ từng câu
  useEffect(() => {
    if (phase !== "question") return undefined;
    const t = setInterval(() => setQLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase === "question" && qLeft <= 0) answerRef.current(null);
  }, [phase, qLeft]);

  // Đếm giờ cả lượt theo giờ máy chủ — hết giờ thì tự nộp
  useEffect(() => {
    if (phase === "over") return undefined;
    const end = new Date(paper.submission.expiresAt).getTime();
    const tick = () => {
      const s = Math.round((end - (Date.now() + offsetRef.current)) / 1000);
      setTimeLeft(s);
      if (s <= 0) finish("timeup");
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [paper, phase, finish]);

  /** Trợ giúp: đưa câu đang hỏi xuống cuối hàng đợi */
  const postpone = useCallback(() => {
    if (phase !== "question" || queue.length < 2) return false;
    setQueue((list) => [...list.slice(1), list[0]]);
    setQLeft(game.seconds);
    return true;
  }, [phase, queue.length, game.seconds]);

  /** Trợ giúp: cộng thêm giây cho câu đang hỏi */
  const addTime = useCallback((s) => setQLeft((x) => x + s), []);

  return {
    game,
    error,
    phase,
    question: queue[0] || null,
    total,
    answeredCount: correct + wrong,
    correct,
    wrong,
    lives,
    feedback,
    qLeft,
    timeLeft,
    result,
    resumed: correct + wrong > 0,
    begin,
    answer,
    finish,
    postpone,
    addTime,
  };
}
