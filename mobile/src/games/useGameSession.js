// games/useGameSession.js — luật chơi chung cho bài tập dạng trò chơi:
// lấy đề, chốt từng câu với máy chủ (biết đúng/sai ngay), đếm mạng, đếm giờ, tự nộp khi kết thúc
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";

/* lives: số lần được sai; seconds: thời gian mỗi câu (hết giờ = sai) */
export const GAMES = {
  obstacle: {
    icon: "🏃",
    name: "Vượt chướng ngại vật",
    lives: 3,
    seconds: 30,
    rules: "Trả lời đúng để nhảy qua chướng ngại vật và về đích. Sai hoặc hết giờ là mất 1 mạng — hết 3 mạng thì dừng cuộc chơi.",
  },
  millionaire: {
    icon: "💰",
    name: "Ai là triệu phú",
    lives: 1,
    seconds: 30,
    rules:
      "Mỗi câu đúng leo thêm 1 bậc tiền thưởng. Sai hoặc hết giờ là dừng cuộc chơi. Có 5 quyền trợ giúp, mỗi quyền dùng 1 lần: 50:50, gọi điện thoại cho người thân, hỏi ý kiến khán giả trong trường quay, hoãn câu và thêm 15 giây.",
  },
  zombie: {
    icon: "🧟",
    name: "Bắn zombie",
    lives: 3,
    seconds: 25,
    rules: "Mỗi câu đúng là một phát bắn trúng zombie, đúng hết là hạ gục. Sai hoặc hết giờ thì bị zombie chém mất 1 mạng — hết 3 mạng là thua.",
  },
};

export const gameOf = (key) => GAMES[key] || GAMES.obstacle;

const REVEAL_MS = 1500; // thời gian hiện đúng/sai trước khi sang câu mới

export default function useGameSession(id, gameKey) {
  const game = gameOf(gameKey);
  const [paper, setPaper] = useState(null);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("loading"); // loading | intro | question | checking | reveal | over
  const [queue, setQueue] = useState([]); // các câu chưa chốt, queue[0] là câu đang hỏi
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [feedback, setFeedback] = useState(null); // { number, chosen, correct, correctAnswer, seq }
  const [qLeft, setQLeft] = useState(game.seconds);
  const [timeLeft, setTimeLeft] = useState(null); // giây còn lại của cả lượt (theo giờ máy chủ)
  const [result, setResult] = useState(null); // { outcome: win | lose | timeup, submission }

  const offsetRef = useRef(0);
  const finishedRef = useRef(false);
  const timers = useRef([]);
  const sid = paper?.submission.id;
  const lives = game.lives - wrong;

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    api
      .startAssignment(id)
      .then((data) => {
        offsetRef.current = new Date(data.serverTime).getTime() - Date.now();
        const done = new Map((data.checked || []).map((c) => [c.questionNumber, c.correct]));
        setCorrect([...done.values()].filter(Boolean).length);
        setWrong([...done.values()].filter((v) => !v).length);
        setQueue(data.questions.filter((q) => !done.has(q.number)));
        setPaper(data);
        setPhase("intro");
      })
      .catch((err) => setError(err.message));
  }, [id]);

  const finish = useCallback(
    async (outcome) => {
      if (!sid || finishedRef.current) return;
      finishedRef.current = true;
      setPhase("over");
      setResult({ outcome, submission: null });
      setError("");
      try {
        const r = await api.submitAssignment(sid);
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
        const r = await api.checkAnswer(sid, body);
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
    if (!paper || phase === "over") return undefined;
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
    paper,
    error,
    phase,
    question: queue[0] || null,
    total: paper?.questions.length || 0,
    answeredCount: correct + wrong,
    correct,
    wrong,
    lives,
    feedback,
    qLeft,
    timeLeft,
    result,
    resumed: !!paper && correct + wrong > 0,
    finished: () => finishedRef.current,
    begin,
    answer,
    finish,
    postpone,
    addTime,
  };
}
