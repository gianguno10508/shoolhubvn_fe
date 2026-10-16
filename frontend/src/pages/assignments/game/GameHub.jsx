// pages/assignments/game/GameHub.jsx — chọn trò chơi; bộ đề PDF dùng chung giữa các trò
import { useState } from "react";
import { EMPTY_DECK } from "./GameShared";
import MillionaireGame from "./MillionaireGame";
import ObstacleGame from "./ObstacleGame";
import ZombieGame from "./ZombieGame";

export const GAMES = [
  {
    key: "obstacle",
    icon: "🏃",
    name: "Vượt chướng ngại vật",
    short: "Đúng thì nhảy qua, sai mất mạng",
    intro: "Vượt chướng ngại vật: trả lời đúng liên tục để về đích, sai hoặc hết giờ là mất mạng.",
    component: ObstacleGame,
  },
  {
    key: "millionaire",
    icon: "💰",
    name: "Ai là triệu phú",
    short: "Leo thang tiền thưởng, 3 quyền trợ giúp",
    intro: "Ai là triệu phú: vượt qua từng câu để leo thang tiền thưởng, sai một câu là dừng cuộc chơi.",
    component: MillionaireGame,
  },
  {
    key: "zombie",
    icon: "🧟",
    name: "Bắn zombie",
    short: "Đúng thì bắn, sai bị zombie chém",
    intro: "Bắn zombie: mỗi câu đúng là một viên đạn, đúng hết zombie gục ngã — sai là bị zombie chém mất mạng.",
    component: ZombieGame,
  },
];

export function gameOf(key) {
  return GAMES.find((g) => g.key === key) || GAMES[0];
}

export default function GameHub({ game, onSelect }) {
  const [deck, setDeck] = useState(EMPTY_DECK);
  const [playing, setPlaying] = useState(false);
  const current = gameOf(game);
  const Game = current.component;

  return (
    <>
      {!playing && (
        <div className="gh-picker" role="tablist" aria-label="Chọn trò chơi">
          {GAMES.map((g) => (
            <button
              key={g.key}
              type="button"
              role="tab"
              aria-selected={g.key === current.key}
              className={"gh-card gh-" + g.key + (g.key === current.key ? " active" : "")}
              onClick={() => onSelect(g.key)}
            >
              <span className="gh-card-icon">{g.icon}</span>
              <span className="gh-card-text">
                <strong>{g.name}</strong>
                <small>{g.short}</small>
              </span>
            </button>
          ))}
        </div>
      )}
      <Game key={current.key} deck={deck} onDeckChange={setDeck} onPlaying={setPlaying} />
    </>
  );
}
