// games/index.js — danh sách trò chơi gọi tên
import { ArrowGame, WheelGame } from "./SpinGames";
import { RaceGame } from "./RaceGame";
import { EliminationGame, SlotGame, SpotlightGame } from "./BoardGames";
import { BalloonGame, CardsGame, GiftGame, JarGame } from "./PickGames";
import { LotteryGame } from "./LotteryGame";

export const GAMES = [
  { id: "wheel", icon: "🎡", title: "Vòng quay may mắn", desc: "Quay bánh xe tên cả lớp", Component: WheelGame },
  { id: "race", icon: "🏎️", title: "Đường đua", desc: "Xe, ngựa, vịt, ốc sên thi về đích", Component: RaceGame },
  { id: "slot", icon: "🎰", title: "Máy quay số", desc: "Kéo cần, tên cuộn như máy jackpot", Component: SlotGame },
  { id: "lottery", icon: "🎱", title: "Lồng cầu xổ số", desc: "Trộn cầu số thứ tự, 1 quả rơi ra", Component: LotteryGame },
  { id: "spotlight", icon: "💡", title: "Đèn nhảy", desc: "Ánh đèn chạy rồi dừng ở 1 bạn", Component: SpotlightGame },
  { id: "elimination", icon: "⚔️", title: "Loại trừ sinh tồn", desc: "Người trụ lại cuối cùng được gọi", Component: EliminationGame },
  { id: "arrow", icon: "🧭", title: "Mũi tên định mệnh", desc: "Mũi tên xoay chỉ vào ai?", Component: ArrowGame },
  { id: "cards", icon: "🃏", title: "Lật thẻ bí mật", desc: "Chọn số thẻ, lật ra tên", Component: CardsGame },
  { id: "balloon", icon: "🎈", title: "Bắn bóng bay", desc: "Bắn nổ bóng để lộ tên", Component: BalloonGame },
  { id: "jar", icon: "🫙", title: "Rút thăm", desc: "Lắc hũ, lá thăm bay ra", Component: JarGame },
  { id: "gift", icon: "🎁", title: "Hộp quà may mắn", desc: "Chọn 1 trong 6 hộp quà", Component: GiftGame },
];
