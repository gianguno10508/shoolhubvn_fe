// screens/NotificationsScreen.js — hộp thư đến + thông báo đã gửi (người được gửi)
import { useCallback, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { api, BASE_URL } from "../api/client";
import { Badge, Body, Button, Card, Empty, ErrorBox, IconBox, Loading, Muted, Progress, Row, Screen, Segmented } from "../components/ui";
import { colors, radius, space } from "../theme";
import { formatDateTime, formatEventTime, formatReceived } from "../utils/format";

function EventTime({ value }) {
  if (!value) return null;
  const past = new Date(value).getTime() < Date.now();
  return (
    <View style={[styles.when, past && styles.whenPast]}>
      <Ionicons name="time-outline" size={13} color={past ? colors.muted : colors.primaryDark} />
      <Text style={[styles.whenText, past && styles.whenTextPast]}>{formatEventTime(value)}</Text>
    </View>
  );
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Màu nhãn đuôi tệp theo loại
const EXT_TONE = {
  pdf: ["#DC2626", "#FEF2F2"],
  doc: ["#2563EB", "#EFF6FF"],
  docx: ["#2563EB", "#EFF6FF"],
  xls: ["#16A34A", "#F0FDF4"],
  xlsx: ["#16A34A", "#F0FDF4"],
  ppt: ["#EA580C", "#FFF7ED"],
  pptx: ["#EA580C", "#FFF7ED"],
};

/** Tệp đính kèm: bấm để mở link tải bằng trình duyệt của máy (tự tải về / mở bằng ứng dụng phù hợp) */
function Attachments({ notification }) {
  const [busy, setBusy] = useState(null);
  if (!notification.attachments?.length) return null;

  async function open(f) {
    setBusy(f.id);
    try {
      const { path } = await api.attachmentLink(notification.id, f.id);
      await Linking.openURL(`${BASE_URL}${path}`);
    } catch (err) {
      Alert.alert("Không tải được tệp", err.message || "Vui lòng thử lại.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.files}>
      {notification.attachments.map((f) => (
        <Pressable key={f.id} onPress={() => open(f)} disabled={busy === f.id} style={({ pressed }) => [styles.file, pressed && { opacity: 0.6 }]}>
          {(() => {
            const ext = (f.name.split(".").pop() || "").toLowerCase();
            const [fg, bg] = EXT_TONE[ext] || [colors.primaryDark, colors.primarySoft];
            return <Text style={[styles.fileExt, { color: fg, backgroundColor: bg }]}>{ext.toUpperCase().slice(0, 4)}</Text>;
          })()}
          <View style={{ flex: 1 }}>
            <Text style={styles.fileName} numberOfLines={1}>
              {f.name}
            </Text>
            <Text style={styles.fileSize}>{busy === f.id ? "Đang mở..." : formatSize(f.size)}</Text>
          </View>
          <Ionicons name="download-outline" size={20} color={colors.primary} />
        </Pressable>
      ))}
    </View>
  );
}

export default function NotificationsScreen({ navigation }) {
  const [tab, setTab] = useState("inbox");
  const [inbox, setInbox] = useState(null);
  const [sent, setSent] = useState(null);
  const [audiences, setAudiences] = useState(null);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    setError("");
    try {
      const [list, aud] = await Promise.all([api.notifications(50), api.audiences().catch(() => ({ canSend: false }))]);
      setInbox(list);
      setAudiences(aud);
      if (aud.canSend) setSent(await api.sentNotifications());
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Tải lại mỗi khi quay về màn hình (VD: vừa soạn xong thông báo)
  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  async function toggle(n) {
    const next = open === n.id ? null : n.id;
    setOpen(next);
    if (next && !n.read) {
      api.markRead(n.id).catch(() => {});
      setInbox((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
  }

  async function readAll() {
    await api.markAllRead().catch(() => {});
    setInbox((prev) => prev.map((x) => ({ ...x, read: true })));
  }

  const canSend = !!audiences?.canSend;
  const unread = inbox?.filter((n) => !n.read).length || 0;

  return (
    <Screen refreshing={refreshing} onRefresh={() => load(true)}>
      {canSend && (
        <>
          <Button
            title="Soạn thông báo"
            icon="create-outline"
            onPress={() => navigation.navigate("ComposeNotification", { audiences })}
            style={{ marginBottom: space.md }}
          />
          <Segmented
            options={[
              { value: "inbox", label: unread ? `Hộp thư đến (${unread})` : "Hộp thư đến" },
              { value: "sent", label: "Đã gửi" },
            ]}
            value={tab}
            onChange={setTab}
          />
        </>
      )}
      <ErrorBox message={error} />

      {tab === "inbox" && (
        <>
          {inbox === null && !error && <Loading />}
          {inbox?.length === 0 && <Empty title="Chưa có thông báo nào" />}
          {unread > 0 && (
            <Row style={styles.listHead}>
              <Text style={styles.listHeadText}>{unread} thông báo chưa đọc</Text>
              <Pressable onPress={readAll} style={styles.readAll} hitSlop={8}>
                <Ionicons name="checkmark-done" size={16} color={colors.primary} />
                <Text style={styles.link}>Đọc tất cả</Text>
              </Pressable>
            </Row>
          )}
          {inbox?.map((n) => {
            const expanded = open === n.id;
            return (
              <Card key={n.id} onPress={() => toggle(n)} style={[!n.read && styles.unread, n.priority === "important" && styles.important]}>
                <View style={styles.itemHead}>
                  <IconBox
                    name={n.priority === "important" ? "alert-circle" : "megaphone"}
                    color={n.priority === "important" ? colors.danger : colors.primary}
                    bg={n.priority === "important" ? colors.dangerSoft : colors.primarySoft}
                    size={42}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                      <Text style={styles.sender} numberOfLines={1}>
                        {n.senderName}
                      </Text>
                      <Text style={styles.time}>{formatReceived(n.createdAt)}</Text>
                    </Row>
                    <Muted numberOfLines={1}>
                      {n.senderRoleLabel} → {n.audienceLabel}
                    </Muted>
                  </View>
                  {!n.read && <View style={styles.dot} />}
                </View>
                <Text style={[styles.title, !n.read && { fontWeight: "900" }]}>{n.title}</Text>
                <Row style={{ gap: 6 }}>
                  {n.priority === "important" && <Badge label="Quan trọng" icon="flame" color={colors.danger} bg={colors.dangerSoft} />}
                  {n.attachments?.length ? (
                    <Badge label={`${n.attachments.length} tệp`} icon="attach" color={colors.text2} bg="#F1F5F9" />
                  ) : null}
                  <EventTime value={n.eventAt} />
                </Row>
                {expanded ? (
                  <View style={styles.body}>
                    {n.body || !n.attachments?.length ? <Body>{n.body || "(Không có nội dung)"}</Body> : null}
                    <Attachments notification={n} />
                    <Muted style={{ marginTop: space.sm }}>Gửi lúc {formatDateTime(n.createdAt)}</Muted>
                  </View>
                ) : n.body ? (
                  <Muted numberOfLines={2} style={{ marginTop: 4 }}>
                    {n.body}
                  </Muted>
                ) : null}
              </Card>
            );
          })}
        </>
      )}

      {tab === "sent" && (
        <>
          {sent === null && !error && <Loading />}
          {sent?.length === 0 && <Empty icon="paper-plane-outline" title="Bạn chưa gửi thông báo nào" />}
          {sent?.map((n) => {
            const percent = n.recipientCount ? Math.round((n.readCount / n.recipientCount) * 100) : 0;
            return (
              <Card key={n.id}>
                <Row style={{ gap: 6 }}>
                  {n.priority === "important" && <Badge label="Quan trọng" icon="flame" color={colors.danger} bg={colors.dangerSoft} />}
                  <EventTime value={n.eventAt} />
                </Row>
                <Text style={styles.title}>{n.title}</Text>
                <Muted>
                  Gửi tới {n.audienceLabel} · {formatDateTime(n.createdAt)}
                </Muted>
                <Attachments notification={n} />
                <Progress percent={percent} color={colors.success} style={{ marginTop: space.md }} />
                <Row style={{ justifyContent: "space-between" }}>
                  <Muted>
                    {n.readCount}/{n.recipientCount} người đã đọc
                  </Muted>
                  <Text style={styles.percent}>{percent}%</Text>
                </Row>
              </Card>
            );
          })}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  unread: { borderColor: colors.primarySoft2, backgroundColor: "#FBFBFF" },
  important: { borderLeftWidth: 4, borderLeftColor: colors.danger },
  itemHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  sender: { flex: 1, fontSize: 14, fontWeight: "800", color: colors.text, marginRight: 8 },
  time: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  title: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 6, lineHeight: 22 },
  body: { marginTop: space.md, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  listHead: { justifyContent: "space-between", marginBottom: space.sm },
  listHeadText: { fontSize: 13, fontWeight: "700", color: colors.text2 },
  readAll: { flexDirection: "row", alignItems: "center", gap: 4 },
  link: { color: colors.primary, fontWeight: "700" },
  when: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  whenPast: { backgroundColor: "#F1F5F9" },
  whenText: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" },
  whenTextPast: { color: colors.muted },
  percent: { fontWeight: "800", color: colors.success },
  files: { marginTop: space.md, gap: 8 },
  file: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
  },
  fileExt: {
    minWidth: 42,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
    overflow: "hidden",
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },
  fileName: { color: colors.text, fontWeight: "700" },
  fileSize: { color: colors.muted, fontSize: 12, marginTop: 1 },
});
