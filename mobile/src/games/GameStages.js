// games/GameStages.js — phần hình ảnh động của từng trò chơi (chỉ hiển thị; luật chơi nằm ở useGameSession)
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { radius, space } from "../theme";

const native = { useNativeDriver: true };
const timing = (value, toValue, duration, easing = Easing.out(Easing.quad)) =>
  Animated.timing(value, { toValue, duration, easing, ...native });

/** Chiều rộng sân khấu (đo khi hiển thị), kèm ref để dùng trong animation */
function useWidth() {
  const [width, setWidth] = useState(0);
  const ref = useRef(0);
  const onLayout = (e) => {
    ref.current = e.nativeEvent.layout.width;
    setWidth(ref.current);
  };
  return [width, ref, onLayout];
}

/* =========================================================
   VƯỢT CHƯỚNG NGẠI VẬT — chạy về đích, đúng thì nhảy qua, sai thì va vào
========================================================= */
const RUNNER_X = 40;
const OBSTACLES = ["🧱", "🌵", "🪨", "🚧", "🛢️"];

export function ObstacleStage({ done, total, feedback }) {
  const [width, widthRef, onLayout] = useWidth();
  const jump = useRef(new Animated.Value(0)).current;
  const obsX = useRef(new Animated.Value(1000)).current;
  const obsOpacity = useRef(new Animated.Value(0)).current;
  const boom = useRef(new Animated.Value(0)).current;
  const ground = useRef(new Animated.Value(0)).current;
  const [obstacle, setObstacle] = useState(OBSTACLES[0]);

  // Mặt đất trôi liên tục cho cảm giác đang chạy
  useEffect(() => {
    const loop = Animated.loop(timing(ground, -40, 500, Easing.linear));
    loop.start();
    return () => loop.stop();
  }, [ground]);

  useEffect(() => {
    if (!feedback) return;
    const w = widthRef.current;
    setObstacle(OBSTACLES[Math.floor(Math.random() * OBSTACLES.length)]);
    obsX.setValue(w + 20);
    obsOpacity.setValue(1);
    if (feedback.correct) {
      Animated.parallel([
        timing(obsX, -60, 1100, Easing.linear),
        Animated.sequence([Animated.delay(380), timing(jump, -80, 260), timing(jump, 0, 260, Easing.in(Easing.quad))]),
      ]).start();
    } else {
      Animated.sequence([
        timing(obsX, RUNNER_X + 28, 520, Easing.linear),
        timing(boom, 1, 120),
        Animated.delay(500),
        Animated.parallel([timing(boom, 0, 250), timing(obsOpacity, 0, 250)]),
      ]).start();
    }
  }, [feedback, widthRef, obsX, obsOpacity, jump, boom]);

  const progress = total ? done / total : 0;
  return (
    <View style={stage.wrap}>
      <View style={stage.track}>
        <View style={[stage.trackFill, { width: `${progress * 100}%` }]} />
        <Text style={[stage.trackRunner, { left: `${Math.min(progress * 100, 92)}%` }]}>🏃</Text>
        <Text style={stage.trackFlag}>🏁</Text>
      </View>
      <View style={[stage.scene, { backgroundColor: "#BAE6FD" }]} onLayout={onLayout}>
        <Text style={[stage.cloud, { left: "15%" }]}>☁️</Text>
        <Text style={[stage.cloud, { left: "65%", top: 20 }]}>☁️</Text>
        <View style={stage.ground}>
          <Animated.View style={[stage.dashes, { transform: [{ translateX: ground }] }]}>
            {Array.from({ length: Math.ceil(width / 40) + 2 }, (_, i) => (
              <View key={i} style={stage.dash} />
            ))}
          </Animated.View>
        </View>
        <Animated.Text style={[stage.actor, { left: RUNNER_X, transform: [{ translateY: jump }, { scaleX: -1 }] }]}>🏃</Animated.Text>
        <Animated.Text style={[stage.actor, { left: 0, opacity: obsOpacity, transform: [{ translateX: obsX }] }]}>{obstacle}</Animated.Text>
        <Animated.Text style={[stage.boom, { left: RUNNER_X + 14, opacity: boom, transform: [{ scale: boom }] }]}>💥</Animated.Text>
      </View>
    </View>
  );
}

/* =========================================================
   BẮN ZOMBIE — đúng thì bắn, sai thì zombie lao tới chém
========================================================= */
const PLAYER_X = 16;

export function ZombieStage({ hp, maxHp, livesLost, maxLives, feedback }) {
  const [width, , onLayout] = useWidth();
  const bullet = useRef(new Animated.Value(0)).current;
  const bulletOpacity = useRef(new Animated.Value(0)).current;
  const flinch = useRef(new Animated.Value(0)).current;
  const lunge = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const hit = useRef(new Animated.Value(0)).current;
  const fall = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;

  // Zombie lắc lư khi đứng chờ
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([timing(sway, 1, 700, Easing.inOut(Easing.sin)), timing(sway, -1, 700, Easing.inOut(Easing.sin))]),
    );
    loop.start();
    return () => loop.stop();
  }, [sway]);

  // Mỗi mạng mất, zombie tiến lại gần thêm một đoạn
  const zombieX = width ? width - 70 - (livesLost / Math.max(1, maxLives)) * (width - 160) : 0;
  const zombieXRef = useRef(zombieX);
  zombieXRef.current = zombieX;

  useEffect(() => {
    if (!feedback) return;
    const zx = zombieXRef.current;
    if (feedback.correct) {
      bullet.setValue(PLAYER_X + 50);
      bulletOpacity.setValue(1);
      Animated.sequence([
        timing(bullet, zx + 10, 260, Easing.linear),
        Animated.parallel([
          timing(bulletOpacity, 0, 60),
          Animated.sequence([timing(hit, 1, 100), timing(hit, 0, 400)]),
          Animated.sequence([timing(flinch, 14, 90), timing(flinch, 0, 220)]),
        ]),
      ]).start();
    } else {
      Animated.sequence([
        timing(lunge, -(zx - PLAYER_X - 46), 320, Easing.in(Easing.quad)),
        Animated.sequence([timing(flash, 0.55, 90), timing(flash, 0, 400)]),
        timing(lunge, 0, 450),
      ]).start();
    }
  }, [feedback, bullet, bulletOpacity, hit, flinch, lunge, flash]);

  const dead = hp <= 0;
  useEffect(() => {
    timing(fall, dead ? 1 : 0, 600, Easing.bounce).start();
  }, [dead, fall]);

  const swayDeg = sway.interpolate({ inputRange: [-1, 1], outputRange: ["-6deg", "6deg"] });
  const fallDeg = fall.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "90deg"] });

  return (
    <View style={stage.wrap}>
      <View style={[stage.scene, { backgroundColor: "#13241A" }]} onLayout={onLayout}>
        <Text style={[stage.cloud, { left: "70%", top: 8, fontSize: 26 }]}>🌕</Text>
        <Text style={[stage.prop, { left: "38%" }]}>🪦</Text>
        <Text style={[stage.prop, { left: "56%", fontSize: 22 }]}>🪦</Text>
        <View style={[stage.ground, { backgroundColor: "#2D3B22" }]} />

        <Text style={[stage.actor, { left: PLAYER_X }]}>🧍</Text>
        <Text style={[stage.gun, { left: PLAYER_X + 30 }]}>🔫</Text>

        {width > 0 && (
          <Animated.View
            style={[
              stage.zombie,
              { left: zombieX, opacity: dead ? 0.5 : 1, transform: [{ translateX: Animated.add(flinch, lunge) }, { rotate: dead ? fallDeg : swayDeg }] },
            ]}
          >
            <View style={stage.hpTrack}>
              <View style={[stage.hpFill, { width: `${maxHp ? (Math.max(0, hp) / maxHp) * 100 : 0}%` }]} />
            </View>
            <Text style={stage.zombieFace}>{dead ? "☠️" : "🧟"}</Text>
            <Animated.Text style={[stage.hit, { opacity: hit, transform: [{ scale: hit }] }]}>💥</Animated.Text>
          </Animated.View>
        )}

        <Animated.View style={[stage.bullet, { opacity: bulletOpacity, transform: [{ translateX: bullet }] }]} />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#DC2626", opacity: flash }]} />
      </View>
      <Text style={stage.caption}>
        Zombie còn {Math.max(0, hp)}/{maxHp} máu
      </Text>
    </View>
  );
}

/* =========================================================
   AI LÀ TRIỆU PHÚ — thang tiền thưởng + quyền trợ giúp
========================================================= */
const PRIZES = [
  200_000, 400_000, 600_000, 1_000_000, 2_000_000, 3_000_000, 6_000_000, 10_000_000, 14_000_000, 22_000_000, 30_000_000,
  40_000_000, 80_000_000, 150_000_000, 250_000_000,
];

/** Giãn thang 15 bậc theo số câu của đề */
export function prizeAt(level, total) {
  if (level <= 0 || !total) return 0;
  return PRIZES[Math.min(PRIZES.length, Math.ceil((level * PRIZES.length) / total)) - 1];
}

const money = (n) => n.toLocaleString("vi-VN").replace(/,/g, ".") + " đ";
const CHIP_W = 112;

/** helps: quyền đã dùng { postpone, time, fifty, audience, phone }; aid: kết quả trợ giúp của câu đang hỏi { votes?, phone? };
 *  options: phương án câu đang hỏi (để hiện theo chữ cái học sinh đang thấy) */
export function MillionaireStage({ level, total, feedback, helps, onPostpone, onAddTime, onLifeline, canHelp, busy, aid, options = [] }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const scroller = useRef(null);

  useEffect(() => {
    if (feedback?.correct) Animated.sequence([timing(pulse, 1.25, 180), timing(pulse, 1, 260)]).start();
  }, [feedback, pulse]);

  useEffect(() => {
    scroller.current?.scrollTo({ x: Math.max(0, (level - 1) * CHIP_W), animated: true });
  }, [level]);

  return (
    <View style={stage.wrap}>
      <View style={stage.prizeBox}>
        <Text style={stage.prizeLabel}>Tiền thưởng hiện có</Text>
        <Animated.Text style={[stage.prize, { transform: [{ scale: pulse }] }]}>{money(prizeAt(level, total))}</Animated.Text>
        {level < total && <Text style={stage.prizeLabel}>Câu tiếp theo: {money(prizeAt(level + 1, total))}</Text>}
      </View>
      <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: space.md }}>
        {Array.from({ length: total }, (_, i) => {
          const passed = i < level;
          const current = i === level;
          return (
            <View key={i} style={[stage.chip, passed && stage.chipPassed, current && stage.chipCurrent]}>
              <Text style={[stage.chipNum, (passed || current) && { color: "#0B1437" }]}>{i + 1}</Text>
              <Text style={[stage.chipMoney, (passed || current) && { color: "#0B1437" }]}>{money(prizeAt(i + 1, total))}</Text>
            </View>
          );
        })}
      </ScrollView>
      <View style={stage.helps}>
        <HelpButton icon="✂️" label="50:50" used={helps.fifty} disabled={!canHelp || busy} onPress={() => onLifeline("fifty")} />
        <HelpButton icon="📞" label="Gọi người thân" used={helps.phone} disabled={!canHelp || busy} onPress={() => onLifeline("phone")} />
        <HelpButton icon="👥" label="Hỏi khán giả" used={helps.audience} disabled={!canHelp || busy} onPress={() => onLifeline("audience")} />
        <HelpButton icon="🔄" label="Hoãn câu" used={helps.postpone} disabled={!canHelp} onPress={onPostpone} />
        <HelpButton icon="⏱" label="+15 giây" used={helps.time} disabled={!canHelp} onPress={onAddTime} />
      </View>
      {aid?.votes && (
        <View style={stage.aidBox}>
          <Text style={stage.aidTitle}>👥 Khán giả trong trường quay bình chọn</Text>
          <View style={stage.bars}>
            {options.map((o) => {
              const v = aid.votes[o.key] ?? 0;
              return (
                <View key={o.key} style={stage.barCol}>
                  <Text style={stage.barPct}>{v}%</Text>
                  <View style={stage.barTrack}>
                    <View style={[stage.barFill, { height: `${v}%` }]} />
                  </View>
                  <Text style={stage.barLetter}>{o.letter}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
      {aid?.phone && (
        <View style={[stage.aidBox, stage.phoneBox]}>
          <Text style={stage.phoneIcon}>📞</Text>
          <Text style={stage.aidText}>
            “Mình nghĩ là đáp án <Text style={stage.aidStrong}>{(options.find((o) => o.key === aid.phone.key) || {}).letter}</Text> đấy,
            chắc khoảng <Text style={stage.aidStrong}>{aid.phone.confidence}%</Text>.”
          </Text>
        </View>
      )}
    </View>
  );
}

function HelpButton({ icon, label, used, disabled, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={used || disabled}
      style={({ pressed }) => [stage.help, (used || disabled) && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}
    >
      <Text style={stage.helpText}>
        {icon} {label}
        {used ? " ✗" : ""}
      </Text>
    </Pressable>
  );
}

const stage = StyleSheet.create({
  wrap: { marginBottom: space.md },
  scene: { height: 150, borderRadius: radius.lg, overflow: "hidden" },
  cloud: { position: "absolute", top: 10, fontSize: 30 },
  prop: { position: "absolute", bottom: 26, fontSize: 26 },
  ground: { position: "absolute", left: 0, right: 0, bottom: 0, height: 30, backgroundColor: "#65A30D", overflow: "hidden" },
  dashes: { flexDirection: "row", marginTop: 12 },
  dash: { width: 22, height: 4, borderRadius: 2, backgroundColor: "#4D7C0F", marginRight: 18 },
  actor: { position: "absolute", bottom: 24, fontSize: 40 },
  boom: { position: "absolute", bottom: 40, fontSize: 40 },
  track: { height: 26, borderRadius: 13, backgroundColor: "#fff", marginBottom: space.sm, justifyContent: "center", overflow: "hidden" },
  trackFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "#7DD3FC" },
  trackRunner: { position: "absolute", fontSize: 16, transform: [{ scaleX: -1 }] },
  trackFlag: { position: "absolute", right: 6, fontSize: 16 },

  gun: { position: "absolute", bottom: 44, fontSize: 24, transform: [{ scaleX: -1 }] },
  zombie: { position: "absolute", bottom: 24, alignItems: "center", width: 56 },
  zombieFace: { fontSize: 44 },
  hpTrack: { width: 50, height: 6, borderRadius: 3, backgroundColor: "#3F1D1D", overflow: "hidden", marginBottom: 2 },
  hpFill: { height: 6, backgroundColor: "#EF4444" },
  hit: { position: "absolute", top: 12, fontSize: 30 },
  bullet: { position: "absolute", left: 0, bottom: 60, width: 14, height: 5, borderRadius: 3, backgroundColor: "#FDE047" },
  caption: { textAlign: "center", color: "#9CC5A1", fontSize: 13, fontWeight: "700", marginTop: space.xs },

  prizeBox: { alignItems: "center", paddingVertical: space.md, borderRadius: radius.lg, backgroundColor: "#131F4F", borderWidth: 1, borderColor: "#F59E0B", marginBottom: space.sm },
  prizeLabel: { color: "#A5B4FC", fontSize: 13 },
  prize: { color: "#FBBF24", fontSize: 28, fontWeight: "900", marginVertical: 2, fontVariant: ["tabular-nums"] },
  chip: { width: CHIP_W - 8, marginRight: 8, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1, borderColor: "#3346A0", alignItems: "center", backgroundColor: "#1A2A66" },
  chipPassed: { backgroundColor: "#FBBF24", borderColor: "#FBBF24" },
  chipCurrent: { backgroundColor: "#FDE68A", borderColor: "#fff" },
  chipNum: { color: "#A5B4FC", fontSize: 11, fontWeight: "800" },
  chipMoney: { color: "#F8FAFC", fontSize: 12, fontWeight: "700" },
  helps: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  help: { flexGrow: 1, flexBasis: "30%", paddingVertical: 10, paddingHorizontal: 4, borderRadius: radius.md, borderWidth: 1, borderColor: "#F59E0B", alignItems: "center" },
  helpText: { color: "#FBBF24", fontWeight: "800", fontSize: 13 },
  aidBox: { marginTop: space.sm, padding: space.md, borderRadius: radius.lg, backgroundColor: "#131F4F", borderWidth: 1, borderColor: "#3346A0" },
  aidTitle: { color: "#A5B4FC", fontSize: 13, fontWeight: "700", marginBottom: space.sm },
  aidText: { flex: 1, color: "#F8FAFC", fontSize: 15, lineHeight: 22 },
  aidStrong: { fontWeight: "900", color: "#FBBF24" },
  phoneBox: { flexDirection: "row", alignItems: "center" },
  phoneIcon: { fontSize: 28, marginRight: space.sm },
  bars: { flexDirection: "row", justifyContent: "space-around" },
  barCol: { alignItems: "center", width: 48 },
  barPct: { color: "#F8FAFC", fontSize: 12, fontWeight: "800", marginBottom: 2 },
  barTrack: { width: 22, height: 90, borderRadius: 4, backgroundColor: "#1A2A66", justifyContent: "flex-end", overflow: "hidden" },
  barFill: { width: "100%", backgroundColor: "#F59E0B" },
  barLetter: { color: "#FBBF24", fontWeight: "900", marginTop: 4 },
});
