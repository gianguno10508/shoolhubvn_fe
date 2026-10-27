// screens/ComposeNotificationScreen.js — soạn thông báo (BGH, tài khoản trường: toàn trường; GVCN: lớp mình)
import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { api } from "../api/client";
import DateTimeField from "../components/DateTimeField";
import { Button, Chip, ErrorBox, Field, Muted, Row, Screen } from "../components/ui";
import { colors, radius, space } from "../theme";
import { formatEventTime } from "../utils/format";

const TYPE_LABEL = {
  staff: "Toàn bộ giáo viên & cán bộ",
  all: "Toàn trường (cả học sinh)",
  roles: "Theo chức danh",
  classes: "Theo lớp",
};

export default function ComposeNotificationScreen({ navigation, route }) {
  const audiences = route.params.audiences;
  const classOnly = audiences.types.length === 1 && audiences.types[0] === "classes" && audiences.ownClass;
  const [type, setType] = useState(audiences.types[0]);
  const [roles, setRoles] = useState([]);
  const [classIds, setClassIds] = useState(classOnly ? [audiences.ownClass.id] : []);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [important, setImportant] = useState(false);
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  /** Ghép ngày + giờ phút thành 1 thời điểm */
  const eventAt = date && time ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.getHours(), time.getMinutes()) : null;

  async function send() {
    if (!title.trim()) return setError("Vui lòng nhập tiêu đề.");
    if ((date && !time) || (!date && time)) return setError("Chọn đủ cả ngày và giờ phút (hoặc bỏ trống cả hai).");
    setBusy(true);
    setError("");
    try {
      await api.sendNotification({
        title: title.trim(),
        body: body.trim(),
        priority: important ? "important" : "normal",
        eventAt: eventAt ? eventAt.toISOString() : null,
        audience: { type, roles, classIds },
      });
      navigation.goBack();
    } catch (err) {
      setError(err.message || "Không gửi được thông báo.");
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.label}>Gửi tới</Text>
      {classOnly ? (
        <View style={styles.fixed}>
          <Text style={styles.fixedText}>Học sinh lớp {audiences.ownClass.name}</Text>
        </View>
      ) : (
        <View style={{ marginBottom: space.md }}>
          {audiences.types.map((t) => (
            <Pressable key={t} onPress={() => setType(t)} style={[styles.option, type === t && styles.optionActive]}>
              <View style={[styles.radio, type === t && styles.radioOn]} />
              <Text style={styles.optionText}>{TYPE_LABEL[t]}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {type === "roles" && (
        <Row style={{ marginBottom: space.sm }}>
          {audiences.roles.map((r) => (
            <Chip key={r.value} label={r.label} selected={roles.includes(r.value)} onPress={() => toggle(roles, setRoles, r.value)} />
          ))}
        </Row>
      )}
      {type === "classes" && !classOnly && (
        <Row style={{ marginBottom: space.sm }}>
          {audiences.classes.map((c) => (
            <Chip key={c.id} label={c.name} selected={classIds.includes(c.id)} onPress={() => toggle(classIds, setClassIds, c.id)} />
          ))}
        </Row>
      )}

      <Field label="Tiêu đề *" value={title} onChangeText={setTitle} maxLength={150} placeholder="VD: Lịch họp phụ huynh" />
      <Field label="Nội dung" value={body} onChangeText={setBody} maxLength={5000} multiline placeholder="Nội dung thông báo..." />

      <Text style={styles.label}>Thời gian (ngày, giờ phút) — không bắt buộc</Text>
      <Row style={{ flexWrap: "nowrap", gap: space.sm }}>
        <DateTimeField label="Ngày" mode="date" value={date} onChange={setDate} />
        <DateTimeField label="Giờ phút" mode="time" value={time} onChange={setTime} />
      </Row>
      {eventAt && <Muted style={{ marginTop: -6, marginBottom: space.sm, color: colors.primaryDark }}>Diễn ra lúc {formatEventTime(eventAt)}</Muted>}
      {(date || time) && (
        <Pressable
          onPress={() => {
            setDate(null);
            setTime(null);
          }}
          style={{ marginBottom: space.md }}
        >
          <Text style={{ color: colors.danger }}>Bỏ thời gian</Text>
        </Pressable>
      )}

      <Row style={styles.switchRow}>
        <Text style={styles.optionText}>Đánh dấu quan trọng</Text>
        <Switch value={important} onValueChange={setImportant} />
      </Row>

      <ErrorBox message={error} />
      <Button title="Gửi thông báo" icon="paper-plane" onPress={send} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600", color: colors.text2, marginBottom: space.xs },
  fixed: { backgroundColor: colors.primarySoft, borderRadius: radius.sm, padding: space.md, marginBottom: space.md },
  fixedText: { color: colors.primaryDark, fontWeight: "600" },
  option: {
    flexDirection: "row",
    alignItems: "center",
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    marginBottom: space.sm,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.muted, marginRight: space.sm },
  radioOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  optionText: { fontSize: 15, color: colors.text },
  switchRow: { justifyContent: "space-between", marginBottom: space.lg },
});
