// screens/NotificationsScreen.js — hộp thư đến + thông báo đã gửi (người được gửi)
import { useCallback, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api, BASE_URL } from "../api/client";
import { Badge, Body, Button, Card, Empty, ErrorBox, Loading, Muted, Row, Screen, Segmented } from "../components/ui";
import { colors, space } from "../theme";
import { formatDateTime, formatEventTime, formatReceived } from "../utils/format";

function EventTime({ value }) {
  if (!value) return null;
  const past = new Date(value).getTime() < Date.now();
  return (
    <View style={[styles.when, past && styles.whenPast]}>
      <Text style={[styles.whenText, past && styles.whenTextPast]}>🕒 {formatEventTime(value)}</Text>
    </View>
  );
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

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
          <Text style={styles.fileExt}>{(f.name.split(".").pop() || "").toUpperCase().slice(0, 4)}</Text>
          <Text style={styles.fileName} numberOfLines={1}>
            {f.name}
          </Text>
          <Text style={styles.fileSize}>{busy === f.id ? "Đang mở..." : formatSize(f.size)}</Text>
          <Text style={styles.fileDl}>⬇</Text>
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
          <Button title="✎ Soạn thông báo" onPress={() => navigation.navigate("ComposeNotification", { audiences })} style={{ marginBottom: space.md }} />
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
            <Pressable onPress={readAll} style={styles.readAll}>
              <Text style={styles.link}>✓ Đánh dấu đã đọc tất cả</Text>
            </Pressable>
          )}
          {inbox?.map((n) => {
            const expanded = open === n.id;
            return (
              <Card key={n.id} onPress={() => toggle(n)} style={[!n.read && styles.unread, n.priority === "important" && styles.important]}>
                <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                  <Row style={{ flex: 1 }}>
                    {!n.read && <View style={styles.dot} />}
                    {n.priority === "important" && <Badge label="Quan trọng" color={colors.danger} bg={colors.dangerSoft} style={{ marginRight: 6 }} />}
                  </Row>
                  <Muted>🕘 {formatReceived(n.createdAt)}</Muted>
                </Row>
                <Text style={[styles.title, !n.read && { fontWeight: "800" }]}>
                  {n.title}
                  {n.attachments?.length ? <Text style={styles.clip}>{`  📎 ${n.attachments.length}`}</Text> : null}
                </Text>
                <EventTime value={n.eventAt} />
                <Muted>
                  {n.senderName} · {n.senderRoleLabel} → {n.audienceLabel}
                </Muted>
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
          {sent?.length === 0 && <Empty icon="✉️" title="Bạn chưa gửi thông báo nào" />}
          {sent?.map((n) => {
            const percent = n.recipientCount ? Math.round((n.readCount / n.recipientCount) * 100) : 0;
            return (
              <Card key={n.id}>
                {n.priority === "important" && <Badge label="Quan trọng" color={colors.danger} bg={colors.dangerSoft} />}
                <Text style={styles.title}>{n.title}</Text>
                <EventTime value={n.eventAt} />
                <Muted>
                  Gửi tới {n.audienceLabel} · {formatDateTime(n.createdAt)}
                </Muted>
                <Attachments notification={n} />
                <View style={styles.bar}>
                  <View style={[styles.barFill, { width: `${percent}%` }]} />
                </View>
                <Muted>
                  {n.readCount}/{n.recipientCount} người đã đọc
                </Muted>
              </Card>
            );
          })}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  unread: { borderColor: "#C7D2FE", backgroundColor: "#FAFAFF" },
  important: { borderLeftWidth: 4, borderLeftColor: colors.danger },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginRight: 6 },
  title: { fontSize: 16, fontWeight: "700", color: colors.text, marginVertical: 4 },
  body: { marginTop: space.sm, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  readAll: { alignSelf: "flex-end", marginBottom: space.sm },
  link: { color: colors.primary, fontWeight: "600" },
  when: { alignSelf: "flex-start", backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 4 },
  whenPast: { backgroundColor: "#F1F5F9" },
  whenText: { color: colors.primaryDark, fontSize: 12, fontWeight: "700" },
  whenTextPast: { color: colors.muted },
  bar: { height: 6, backgroundColor: "#E5E7EB", borderRadius: 3, overflow: "hidden", marginVertical: 6 },
  barFill: { height: 6, backgroundColor: colors.success },
  clip: { fontSize: 13, fontWeight: "600", color: colors.muted },
  files: { marginTop: space.sm, gap: 6 },
  file: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  fileExt: {
    minWidth: 40,
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: colors.primarySoft,
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  fileName: { flex: 1, color: colors.text, fontWeight: "600" },
  fileSize: { color: colors.muted, fontSize: 12 },
  fileDl: { color: colors.primary, fontWeight: "800" },
});
