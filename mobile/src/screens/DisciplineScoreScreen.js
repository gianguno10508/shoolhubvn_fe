// screens/DisciplineScoreScreen.js — Cờ đỏ chấm thi đua theo 3 bước
//  1. Thông tin: hôm nay thứ mấy, tuần mấy, lớp mình, các lớp được Đoàn TN phân công chấm
//  2. Chấm điểm: nhập theo từng mục (tick / số lần / tên học sinh)
//  3. Xác nhận: tổng hợp lỗi trừ, điểm cộng, điểm của ngày → gửi lên máy chủ
// Chỉ chấm cho ngày hôm nay. Backend kiểm tra lại: không chấm lớp mình, đúng lớp được phân công.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { api } from "../api/client";
import { Badge, Button, Card, Empty, ErrorBox, Field, Loading, Muted, Notice, Row, Screen } from "../components/ui";
import { colors, radius, space } from "../theme";
import { shortDay } from "../utils/format";

const STEPS = ["Thông tin", "Chấm điểm", "Xác nhận"];
const splitNames = (s) =>
  String(s || "")
    .split(/[,\n;]/)
    .map((x) => x.trim())
    .filter(Boolean);
const viDate = (iso) => (iso ? iso.split("-").reverse().join("/") : "");

/** Phiếu đã chấm → trạng thái nhập liệu theo từng mục */
function toForm(record) {
  const form = {};
  for (const e of record?.entries || []) {
    form[String(e.itemId)] = {
      checked: e.inputType === "checkbox",
      quantity: e.inputType === "count" ? String(e.quantity) : "",
      names: (e.studentNames || []).join(", "),
    };
  }
  return form;
}

function quantityOf(item, v = {}) {
  if (item.inputType === "checkbox") return v.checked ? 1 : 0;
  if (item.inputType === "count") return Math.max(0, parseInt(v.quantity, 10) || 0);
  return splitNames(v.names).length;
}

function StepBar({ step }) {
  return (
    <View style={styles.steps}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <View key={label} style={styles.stepItem}>
            <View style={[styles.stepDot, (active || done) && styles.stepDotOn]}>
              <Text style={[styles.stepDotText, (active || done) && { color: "#fff" }]}>{done ? "✓" : n}</Text>
            </View>
            <Text style={[styles.stepLabel, active && { color: colors.primary, fontWeight: "700" }]}>{label}</Text>
            {i < STEPS.length - 1 && <View style={[styles.stepLine, done && { backgroundColor: colors.primary }]} />}
          </View>
        );
      })}
    </View>
  );
}

export default function DisciplineScoreScreen() {
  const [info, setInfo] = useState(null); // /discipline/my-scoring
  const [config, setConfig] = useState(null);
  const [step, setStep] = useState(1);
  const [target, setTarget] = useState(null);
  const [record, setRecord] = useState(null); // phiếu đã chấm hôm nay của lớp đang chọn
  const [form, setForm] = useState({});
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadInfo = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError("");
    try {
      const [inf, cfg] = await Promise.all([api.myScoring(), api.disciplineConfig()]);
      setInfo(inf);
      setConfig(cfg);
      // Chỉ có 1 lớp được chấm → chọn sẵn
      setTarget((t) => (t && inf.targets.some((x) => String(x.id) === String(t.id)) ? inf.targets.find((x) => String(x.id) === String(t.id)) : inf.targets.length === 1 ? inf.targets[0] : null));
    } catch (err) {
      setError(err.message || "Không tải được thông tin chấm.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  const categories = useMemo(
    () =>
      (config?.categories || [])
        .filter((c) => c.active)
        .map((c) => ({ ...c, items: c.items.filter((i) => i.active) }))
        .filter((c) => c.items.length),
    [config],
  );

  const setItem = (id, patch) => setForm((f) => ({ ...f, [id]: { ...(f[id] || {}), ...patch } }));

  // Tổng hợp các mục đã chấm (dùng cho bước 2 và 3)
  const lines = useMemo(() => {
    const out = [];
    for (const c of categories) {
      for (const i of c.items) {
        const v = form[String(i.id)] || {};
        const qty = quantityOf(i, v);
        if (qty > 0) out.push({ category: c.name, item: i, qty, names: i.inputType === "names" ? splitNames(v.names) : [], total: qty * i.points });
      }
    }
    return out;
  }, [categories, form]);
  const penalty = lines.filter((l) => l.item.kind !== "bonus").reduce((n, l) => n + l.total, 0);
  const bonus = lines.filter((l) => l.item.kind === "bonus").reduce((n, l) => n + l.total, 0);
  const base = info?.basePoints ?? 0;

  async function goScore() {
    if (!target) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const list = await api.disciplineRecords({ date: info.today, classId: target.id });
      const r = list.find((x) => String(x.classId) === String(target.id)) || null;
      setRecord(r);
      setForm(toForm(r));
      setNote(r?.note || "");
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const entries = categories.flatMap((c) =>
        c.items.map((i) => {
          const v = form[String(i.id)] || {};
          return {
            itemId: i.id,
            checked: !!v.checked,
            quantity: parseInt(v.quantity, 10) || 0,
            studentNames: splitNames(v.names),
          };
        }),
      );
      await api.saveDisciplineRecord(target.id, info.today, { entries, note });
      setNotice(`Đã gửi phiếu chấm lớp ${target.name} ngày ${viDate(info.today)}: điểm ngày ${base - penalty + bonus}.`);
      setStep(1);
      await loadInfo();
    } catch (err) {
      setError(err.message || "Không gửi được phiếu chấm.");
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    Alert.alert("Xoá phiếu chấm", `Xoá toàn bộ điểm đã chấm của lớp ${target.name} hôm nay?`, [
      { text: "Huỷ", style: "cancel" },
      {
        text: "Xoá",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await api.deleteDisciplineRecord(target.id, info.today);
            setNotice(`Đã xoá phiếu chấm lớp ${target.name}.`);
            setStep(1);
            await loadInfo();
          } catch (err) {
            setError(err.message);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  if (!info || !config) {
    return <Screen onRefresh={() => loadInfo(true)} refreshing={refreshing}>{error ? <ErrorBox message={error} /> : <Loading />}</Screen>;
  }

  const week = info.week || {};
  const weekText = `${week.number ? `${week.number} ` : ""}(${shortDay(week.start)} – ${shortDay(week.end)})`;

  /* ---------- Bước 1: thông tin ---------- */
  if (step === 1) {
    const doneCount = info.targets.filter((t) => t.recorded).length;
    return (
      <Screen onRefresh={() => loadInfo(true)} refreshing={refreshing}>
        <StepBar step={1} />
        <ErrorBox message={error} />
        <Notice message={notice} />

        <Card style={styles.infoCard}>
          <InfoLine label="Hôm nay" value={`${info.weekday}, ${viDate(info.today)}`} />
          <InfoLine label="Tuần" value={weekText} />
          <InfoLine label="Lớp chấm" value={info.scorerClass ? info.scorerClass.name : "—"} last />
        </Card>

        {!info.isScoreDay && (
          <View style={styles.warn}>
            <Text style={styles.warnText}>⚠️ Hôm nay không phải ngày chấm thi đua.</Text>
          </View>
        )}
        {!info.pairsConfigured && (
          <Muted style={{ marginBottom: space.md }}>
            Đoàn trường chưa phân công lớp chấm nên bạn chấm được mọi lớp, trừ lớp mình.
          </Muted>
        )}

        <Text style={styles.label}>
          Lớp được chấm ({doneCount}/{info.targets.length} đã chấm)
        </Text>
        {info.targets.length === 0 ? (
          <Empty
            icon="🚩"
            title={info.pairsConfigured ? "Đoàn trường chưa phân công lớp chấm cho lớp bạn" : "Chưa có lớp nào để chấm"}
            hint="Liên hệ Đoàn trường để được phân công."
          />
        ) : (
          info.targets.map((t) => {
            const selected = target && String(target.id) === String(t.id);
            return (
              <Pressable
                key={t.id}
                disabled={!info.isScoreDay}
                onPress={() => setTarget(t)}
                style={[styles.target, selected && styles.targetOn, !info.isScoreDay && { opacity: 0.55 }]}
              >
                <View style={[styles.radio, selected && styles.radioOn]}>{selected && <View style={styles.radioDot} />}</View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.targetName}>Lớp {t.name}</Text>
                  {t.recorded && (
                    <Muted>
                      Đã chấm: −{t.totalPenalty}
                      {t.totalBonus ? ` / +${t.totalBonus}` : ""} · {t.recordedByName}
                    </Muted>
                  )}
                </View>
                {t.recorded ? (
                  <Badge label="Đã chấm" color={colors.success} bg={colors.successSoft} />
                ) : (
                  <Badge label="Chưa chấm" color={colors.warning} bg={colors.warningSoft} />
                )}
              </Pressable>
            );
          })
        )}

        <Button
          title={target?.recorded ? `Sửa phiếu lớp ${target.name}` : target ? `Chấm lớp ${target.name}` : "Chọn lớp để tiếp tục"}
          onPress={goScore}
          disabled={!target || !info.isScoreDay}
          loading={busy}
          style={{ marginTop: space.md }}
        />
      </Screen>
    );
  }

  /* ---------- Bước 2: chấm điểm ---------- */
  if (step === 2) {
    return (
      <Screen>
        <StepBar step={2} />
        <Text style={styles.title}>
          Lớp {target.name} · {info.weekday}, {viDate(info.today)}
        </Text>
        <ErrorBox message={error} />

        {categories.map((c) => (
          <Card key={c.id}>
            <Text style={styles.cat}>{c.name}</Text>
            {c.items.map((i) => {
              const id = String(i.id);
              const v = form[id] || {};
              const tag = `${i.kind === "bonus" ? "+" : "−"}${i.points}`;
              return (
                <View key={id} style={styles.item}>
                  <Row style={{ flexWrap: "nowrap" }}>
                    <Text style={styles.itemName}>{i.name}</Text>
                    <Text style={[styles.pts, i.kind === "bonus" && { color: colors.success }]}>
                      {tag}
                      {i.inputType !== "checkbox" ? (i.inputType === "names" ? "/HS" : "/lần") : ""}
                    </Text>
                    {i.inputType === "checkbox" && <Switch value={!!v.checked} onValueChange={(x) => setItem(id, { checked: x })} />}
                  </Row>
                  {i.inputType === "count" && (
                    <Row style={{ marginTop: 6 }}>
                      <Pressable style={styles.step} onPress={() => setItem(id, { quantity: String(Math.max(0, (parseInt(v.quantity, 10) || 0) - 1)) })}>
                        <Text style={styles.stepText}>−</Text>
                      </Pressable>
                      <TextInput
                        style={styles.qty}
                        keyboardType="number-pad"
                        value={v.quantity || ""}
                        placeholder="0"
                        onChangeText={(t) => setItem(id, { quantity: t.replace(/\D/g, "") })}
                      />
                      <Pressable style={styles.step} onPress={() => setItem(id, { quantity: String((parseInt(v.quantity, 10) || 0) + 1) })}>
                        <Text style={styles.stepText}>+</Text>
                      </Pressable>
                      <Muted style={{ marginLeft: space.sm }}>lần</Muted>
                    </Row>
                  )}
                  {i.inputType === "names" && (
                    <TextInput
                      style={styles.names}
                      value={v.names || ""}
                      placeholder="Tên học sinh, cách nhau bằng dấu phẩy"
                      placeholderTextColor={colors.muted}
                      onChangeText={(t) => setItem(id, { names: t })}
                      multiline
                    />
                  )}
                </View>
              );
            })}
          </Card>
        ))}

        <Field label="Ghi chú" value={note} onChangeText={setNote} multiline maxLength={500} placeholder="Ghi chú thêm (nếu có)" />
        <Card style={styles.total}>
          <Row style={{ justifyContent: "space-between" }}>
            <Text style={{ color: colors.danger, fontWeight: "700" }}>Trừ: −{penalty}</Text>
            <Text style={{ color: colors.success, fontWeight: "700" }}>Cộng: +{bonus}</Text>
            <Text style={{ color: colors.text, fontWeight: "800" }}>Điểm ngày: {base - penalty + bonus}</Text>
          </Row>
        </Card>
        <Row style={styles.actions}>
          <Button title="‹ Quay lại" variant="light" onPress={() => setStep(1)} style={{ flex: 1, marginRight: space.sm }} />
          <Button title="Tiếp tục ›" onPress={() => setStep(3)} style={{ flex: 1 }} />
        </Row>
        {record && <Button title="Xoá phiếu đã chấm" variant="light" onPress={remove} loading={busy} style={{ marginTop: space.sm }} />}
      </Screen>
    );
  }

  /* ---------- Bước 3: xác nhận ---------- */
  const penalties = lines.filter((l) => l.item.kind !== "bonus");
  const bonuses = lines.filter((l) => l.item.kind === "bonus");
  return (
    <Screen>
      <StepBar step={3} />
      <ErrorBox message={error} />

      <Card style={styles.infoCard}>
        <InfoLine label="Lớp được chấm" value={target.name} />
        <InfoLine label="Ngày" value={`${info.weekday}, ${viDate(info.today)}`} />
        <InfoLine label="Tuần" value={weekText} />
        <InfoLine label="Người chấm" value={info.scorerClass ? `Cờ đỏ lớp ${info.scorerClass.name}` : "—"} last />
      </Card>

      <Card>
        <Text style={styles.cat}>Lỗi bị trừ điểm</Text>
        {penalties.length === 0 && <Muted>✓ Không có vi phạm.</Muted>}
        {penalties.map((l, k) => (
          <View key={k} style={styles.sumLine}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sumItem}>
                {l.item.name}
                {l.item.inputType !== "checkbox" ? ` × ${l.qty}` : ""}
              </Text>
              <Muted>
                {l.category}
                {l.names.length ? ` · ${l.names.join(", ")}` : ""}
              </Muted>
            </View>
            <Text style={styles.minus}>−{l.total}</Text>
          </View>
        ))}
        {bonuses.length > 0 && <Text style={[styles.cat, { marginTop: space.md }]}>Điểm cộng</Text>}
        {bonuses.map((l, k) => (
          <View key={k} style={styles.sumLine}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sumItem}>
                {l.item.name}
                {l.item.inputType !== "checkbox" ? ` × ${l.qty}` : ""}
              </Text>
              <Muted>{l.category}</Muted>
            </View>
            <Text style={styles.plus}>+{l.total}</Text>
          </View>
        ))}
        {!!note && <Muted style={{ marginTop: space.sm }}>Ghi chú: {note}</Muted>}
      </Card>

      <Card style={styles.totalCard}>
        <Row style={{ justifyContent: "space-between" }}>
          <Text style={styles.totalLabel}>Tổng trừ</Text>
          <Text style={styles.minus}>−{penalty}</Text>
        </Row>
        <Row style={{ justifyContent: "space-between", marginTop: 4 }}>
          <Text style={styles.totalLabel}>Tổng cộng</Text>
          <Text style={styles.plus}>+{bonus}</Text>
        </Row>
        <View style={styles.totalDivider} />
        <Text style={styles.dayScore}>
          Điểm ngày = {base} − {penalty} + {bonus} = <Text style={{ color: colors.primary }}>{base - penalty + bonus}</Text>
        </Text>
      </Card>

      <Row style={styles.actions}>
        <Button title="‹ Sửa lại" variant="light" onPress={() => setStep(2)} style={{ flex: 1, marginRight: space.sm }} />
        <Button title={record ? "Cập nhật lên máy chủ" : "Gửi lên"} variant="success" onPress={submit} loading={busy} style={{ flex: 1 }} />
      </Row>
      {record && <Button title="Xoá phiếu đã chấm" variant="light" onPress={remove} disabled={busy} style={{ marginTop: space.sm }} />}
    </Screen>
  );
}

function InfoLine({ label, value, last }) {
  return (
    <Row style={[styles.infoLine, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </Row>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: "row", marginBottom: space.lg },
  stepItem: { flex: 1, alignItems: "center", position: "relative" },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  stepDotOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepDotText: { fontWeight: "800", color: colors.text2 },
  stepLabel: { fontSize: 12, color: colors.text2, marginTop: 4 },
  stepLine: { position: "absolute", top: 14, left: "50%", width: "100%", height: 2, backgroundColor: colors.border, marginLeft: 15 },
  infoCard: { backgroundColor: colors.primarySoft, borderColor: "#C7D2FE" },
  infoLine: { justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#C7D2FE" },
  infoLabel: { fontSize: 14, color: colors.text2 },
  infoValue: { fontSize: 15, color: colors.primaryDark, fontWeight: "700", flexShrink: 1, textAlign: "right" },
  warn: { backgroundColor: colors.warningSoft, borderRadius: radius.sm, padding: space.md, marginBottom: space.md },
  warnText: { color: colors.warning, fontWeight: "600" },
  label: { fontSize: 13, fontWeight: "600", color: colors.text2, marginBottom: space.sm },
  target: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
  },
  targetOn: { borderColor: colors.primary, borderWidth: 2 },
  targetName: { fontSize: 16, fontWeight: "700", color: colors.text },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, marginRight: space.md, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  title: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: space.md },
  cat: { fontSize: 16, fontWeight: "700", color: colors.primaryDark, marginBottom: space.xs },
  item: { paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  itemName: { flex: 1, fontSize: 15, color: colors.text },
  pts: { color: colors.danger, fontWeight: "700", marginHorizontal: space.sm },
  step: { width: 38, height: 38, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  stepText: { fontSize: 20, color: colors.primary },
  qty: { width: 56, height: 38, marginHorizontal: 6, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, textAlign: "center", fontSize: 16, color: colors.text },
  names: { marginTop: 6, minHeight: 42, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: space.sm, fontSize: 14, color: colors.text },
  total: { backgroundColor: colors.bg },
  actions: { flexWrap: "nowrap", marginTop: space.sm },
  sumLine: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  sumItem: { fontSize: 15, color: colors.text, fontWeight: "600" },
  minus: { color: colors.danger, fontWeight: "800", fontSize: 16 },
  plus: { color: colors.success, fontWeight: "800", fontSize: 16 },
  totalCard: { borderColor: colors.primary, borderWidth: 1.5 },
  totalLabel: { fontSize: 15, color: colors.text2 },
  totalDivider: { height: 1, backgroundColor: colors.border, marginVertical: space.sm },
  dayScore: { fontSize: 17, fontWeight: "800", color: colors.text, textAlign: "center" },
});
