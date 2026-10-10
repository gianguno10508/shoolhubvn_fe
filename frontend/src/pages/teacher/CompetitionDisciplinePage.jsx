import { useEffect, useMemo, useState } from "react";

/* =========================================================
   CONSTANTS
========================================================= */

const STORAGE_KEY = "teacher_competition_config_v1";
const HISTORY_KEY = "teacher_competition_history_v1";

const DEFAULT_CLASSES = [
  "10A1",
  "10A2",
  "10A3",
  "11A1",
  "11A2",
  "11A3",
  "12A1",
  "12A2",
  "12A3",
];

const INPUT_TYPES = [
  {
    value: "checkbox",
    label: "Checkbox",
    description: "Đánh dấu có/không",
  },
  {
    value: "number",
    label: "Số lượng",
    description: "Nhập số lần / số lượng",
  },
  {
    value: "text",
    label: "Văn bản",
    description: "Nhập nội dung ngắn",
  },
  {
    value: "textarea",
    label: "Nội dung dài",
    description: "Nhập ghi chú",
  },
  {
    value: "select",
    label: "Danh sách",
    description: "Chọn một phương án",
  },
  {
    value: "radio",
    label: "Radio",
    description: "Chọn một phương án",
  },
  {
    value: "score",
    label: "Điểm",
    description: "Nhập trực tiếp số điểm",
  },
];

const DEFAULT_CONFIG = {
  sessions: [
    {
      id: "morning",
      name: "Sáng",
      startTime: "07:00",
      endTime: "11:30",
      enabled: true,
    },
    {
      id: "afternoon",
      name: "Chiều",
      startTime: "13:00",
      endTime: "17:00",
      enabled: true,
    },
  ],

  criteria: [
    {
      id: "attendance",
      name: "Sĩ số",
      icon: "👥",
      description: "Theo dõi tình hình chuyên cần của lớp",
      children: [
        {
          id: "absent",
          name: "Vắng không phép",
          point: -2,
          inputType: "number",
          options: [],
        },
        {
          id: "late",
          name: "Đi muộn",
          point: -1,
          inputType: "number",
          options: [],
        },
        {
          id: "leave_class",
          name: "Bỏ tiết",
          point: -3,
          inputType: "number",
          options: [],
        },
      ],
    },

    {
      id: "discipline",
      name: "Nề nếp",
      icon: "🎓",
      description: "Theo dõi việc thực hiện nội quy",
      children: [
        {
          id: "uniform",
          name: "Không mặc đồng phục",
          point: -1,
          inputType: "checkbox",
          options: [],
        },
        {
          id: "phone",
          name: "Sử dụng điện thoại",
          point: -2,
          inputType: "number",
          options: [],
        },
        {
          id: "noise",
          name: "Mất trật tự",
          point: -1,
          inputType: "checkbox",
          options: [],
        },
      ],
    },

    {
      id: "cleaning",
      name: "Vệ sinh",
      icon: "🧹",
      description: "Theo dõi vệ sinh lớp học và khu vực phụ trách",
      children: [
        {
          id: "class_clean",
          name: "Lớp chưa sạch",
          point: -2,
          inputType: "checkbox",
          options: [],
        },
        {
          id: "area_clean",
          name: "Khu vực chưa sạch",
          point: -1,
          inputType: "checkbox",
          options: [],
        },
      ],
    },
  ],
};

/* =========================================================
   HELPERS
========================================================= */

function createId(prefix = "item") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
}

function loadLocalStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) {
      return cloneData(fallback);
    }

    const parsed = JSON.parse(raw);

    return parsed;
  } catch (error) {
    console.error(`Không thể đọc ${key}`, error);
    return cloneData(fallback);
  }
}

function formatDate(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString("vi-VN");
}

function formatDateTime(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleString("vi-VN");
}

function calculateChildPoint(child, value) {
  if (child.inputType === "checkbox") return value === true ? Number(child.point || 0) : 0;
  if (child.inputType === "number") return (Number(value || 0) || 0) * Number(child.point || 0);
  if (child.inputType === "score") return Number(value || 0);
  if (["text", "textarea", "select", "radio"].includes(child.inputType)) {
    return value !== undefined && value !== null && String(value).trim() !== ""
      ? Number(child.point || 0)
      : 0;
  }
  return 0;
}

function getInputTypeLabel(type) {
  const item = INPUT_TYPES.find((item) => item.value === type);

  return item?.label || type;
}

/* =========================================================
   INITIAL STATE
========================================================= */

const getToday = () => {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

/* =========================================================
   COMPONENT
========================================================= */

export default function CompetitionDisciplinePage() {
  const [activeTab, setActiveTab] = useState("config");

  const [config, setConfig] = useState(() =>
    loadLocalStorage(STORAGE_KEY, DEFAULT_CONFIG),
  );

  const [history, setHistory] = useState(() =>
    loadLocalStorage(HISTORY_KEY, []),
  );

  const [configSection, setConfigSection] = useState("sessions");

  /* ---------------------------------------------------------
     SESSION MODAL
  --------------------------------------------------------- */

  const [showSessionModal, setShowSessionModal] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState(null);

  const [sessionForm, setSessionForm] = useState({
    name: "",
    startTime: "07:00",
    endTime: "11:30",
    enabled: true,
  });

  /* ---------------------------------------------------------
     CRITERIA MODAL
  --------------------------------------------------------- */

  const [showCriteriaModal, setShowCriteriaModal] = useState(false);
  const [editingCriteriaId, setEditingCriteriaId] = useState(null);

  const [criteriaForm, setCriteriaForm] = useState({
    name: "",
    icon: "📌",
    description: "",
  });

  /* ---------------------------------------------------------
     CHILD CRITERIA MODAL
  --------------------------------------------------------- */

  const [showChildModal, setShowChildModal] = useState(false);
  const [editingChildId, setEditingChildId] = useState(null);
  const [currentParentCriteriaId, setCurrentParentCriteriaId] = useState(null);

  const [childForm, setChildForm] = useState({
    name: "",
    point: -1,
    inputType: "checkbox",
    optionsText: "",
  });

  /* ---------------------------------------------------------
     HISTORY FILTER
  --------------------------------------------------------- */

  const [historyFilter, setHistoryFilter] = useState({
    date: "",
    className: "",
    sessionId: "",
  });

  const [selectedHistory, setSelectedHistory] = useState(null);

  /* =========================================================
     EFFECTS
  ========================================================= */

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  /* =========================================================
     COMPUTED
  ========================================================= */

  const totalCriteria = useMemo(() => {
    return config.criteria.reduce(
      (total, criteria) => total + criteria.children.length,
      0,
    );
  }, [config.criteria]);

  const totalSessions = config.sessions.length;

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchDate = !historyFilter.date || item.date === historyFilter.date;

      const matchClass =
        !historyFilter.className || item.className === historyFilter.className;

      const matchSession =
        !historyFilter.sessionId || item.sessionId === historyFilter.sessionId;

      return matchDate && matchClass && matchSession;
    });
  }, [history, historyFilter]);

  /* =========================================================
     SESSION FUNCTIONS
  ========================================================= */

  function openCreateSession() {
    setEditingSessionId(null);

    setSessionForm({
      name: "",
      startTime: "07:00",
      endTime: "11:30",
      enabled: true,
    });

    setShowSessionModal(true);
  }

  function openEditSession(session) {
    setEditingSessionId(session.id);

    setSessionForm({
      name: session.name,
      startTime: session.startTime,
      endTime: session.endTime,
      enabled: session.enabled,
    });

    setShowSessionModal(true);
  }

  function saveSession() {
    if (!sessionForm.name.trim()) {
      alert("Vui lòng nhập tên buổi học.");
      return;
    }

    if (!sessionForm.startTime || !sessionForm.endTime) {
      alert("Vui lòng nhập đầy đủ thời gian.");
      return;
    }

    if (editingSessionId) {
      setConfig((prev) => ({
        ...prev,
        sessions: prev.sessions.map((session) =>
          session.id === editingSessionId
            ? {
                ...session,
                name: sessionForm.name.trim(),
                startTime: sessionForm.startTime,
                endTime: sessionForm.endTime,
                enabled: sessionForm.enabled,
              }
            : session,
        ),
      }));
    } else {
      setConfig((prev) => ({
        ...prev,
        sessions: [
          ...prev.sessions,
          {
            id: createId("session"),
            name: sessionForm.name.trim(),
            startTime: sessionForm.startTime,
            endTime: sessionForm.endTime,
            enabled: sessionForm.enabled,
          },
        ],
      }));
    }

    setShowSessionModal(false);
  }

  function deleteSession(id) {
    const session = config.sessions.find((item) => item.id === id);

    if (!session) return;

    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa buổi "${session.name}" không?`,
    );

    if (!confirmed) return;

    setConfig((prev) => ({
      ...prev,
      sessions: prev.sessions.filter((item) => item.id !== id),
    }));

  }

  function toggleSession(id) {
    setConfig((prev) => ({
      ...prev,
      sessions: prev.sessions.map((session) =>
        session.id === id
          ? {
              ...session,
              enabled: !session.enabled,
            }
          : session,
      ),
    }));
  }

  /* =========================================================
     CRITERIA FUNCTIONS
  ========================================================= */

  function openCreateCriteria() {
    setEditingCriteriaId(null);

    setCriteriaForm({
      name: "",
      icon: "📌",
      description: "",
    });

    setShowCriteriaModal(true);
  }

  function openEditCriteria(criteria) {
    setEditingCriteriaId(criteria.id);

    setCriteriaForm({
      name: criteria.name,
      icon: criteria.icon || "📌",
      description: criteria.description || "",
    });

    setShowCriteriaModal(true);
  }

  function saveCriteria() {
    if (!criteriaForm.name.trim()) {
      alert("Vui lòng nhập tên tiêu chí.");
      return;
    }

    if (editingCriteriaId) {
      setConfig((prev) => ({
        ...prev,
        criteria: prev.criteria.map((criteria) =>
          criteria.id === editingCriteriaId
            ? {
                ...criteria,
                name: criteriaForm.name.trim(),
                icon: criteriaForm.icon || "📌",
                description: criteriaForm.description.trim(),
              }
            : criteria,
        ),
      }));
    } else {
      setConfig((prev) => ({
        ...prev,
        criteria: [
          ...prev.criteria,
          {
            id: createId("criteria"),
            name: criteriaForm.name.trim(),
            icon: criteriaForm.icon || "📌",
            description: criteriaForm.description.trim(),
            children: [],
          },
        ],
      }));
    }

    setShowCriteriaModal(false);
  }

  function deleteCriteria(id) {
    const criteria = config.criteria.find((item) => item.id === id);

    if (!criteria) return;

    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa tiêu chí "${criteria.name}" không?\n\nCác tiêu chí con bên trong cũng sẽ bị xóa.`,
    );

    if (!confirmed) return;

    setConfig((prev) => ({
      ...prev,
      criteria: prev.criteria.filter((item) => item.id !== id),
    }));
  }

  /* =========================================================
     CHILD CRITERIA FUNCTIONS
  ========================================================= */

  function openCreateChild(criteriaId) {
    setCurrentParentCriteriaId(criteriaId);
    setEditingChildId(null);

    setChildForm({
      name: "",
      point: -1,
      inputType: "checkbox",
      optionsText: "",
    });

    setShowChildModal(true);
  }

  function openEditChild(criteriaId, child) {
    setCurrentParentCriteriaId(criteriaId);
    setEditingChildId(child.id);

    setChildForm({
      name: child.name,
      point: child.point,
      inputType: child.inputType,
      optionsText: (child.options || []).join("\n"),
    });

    setShowChildModal(true);
  }

  function saveChild() {
    if (!currentParentCriteriaId) {
      alert("Không xác định được tiêu chí cha.");
      return;
    }

    if (!childForm.name.trim()) {
      alert("Vui lòng nhập tên tiêu chí con.");
      return;
    }

    const point = Number(childForm.point);

    if (Number.isNaN(point)) {
      alert("Điểm phải là một số.");
      return;
    }

    const options = childForm.optionsText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    const childData = {
      id: editingChildId || createId("child"),
      name: childForm.name.trim(),
      point,
      inputType: childForm.inputType,
      options,
    };

    setConfig((prev) => ({
      ...prev,
      criteria: prev.criteria.map((criteria) => {
        if (criteria.id !== currentParentCriteriaId) {
          return criteria;
        }

        if (editingChildId) {
          return {
            ...criteria,
            children: criteria.children.map((child) =>
              child.id === editingChildId ? childData : child,
            ),
          };
        }

        return {
          ...criteria,
          children: [...criteria.children, childData],
        };
      }),
    }));

    setShowChildModal(false);
  }

  function deleteChild(criteriaId, childId) {
    const confirmed = window.confirm(
      "Bạn có chắc muốn xóa tiêu chí con này không?",
    );

    if (!confirmed) return;

    setConfig((prev) => ({
      ...prev,
      criteria: prev.criteria.map((criteria) =>
        criteria.id === criteriaId
          ? {
              ...criteria,
              children: criteria.children.filter(
                (child) => child.id !== childId,
              ),
            }
          : criteria,
      ),
    }));

  }

  function deleteHistory(id) {
    const confirmed = window.confirm("Bạn có chắc muốn xóa bản ghi này không?");

    if (!confirmed) return;

    setHistory((prev) => prev.filter((item) => item.id !== id));

    if (selectedHistory?.id === id) {
      setSelectedHistory(null);
    }
  }

  function clearAllHistory() {
    if (!history.length) return;

    const confirmed = window.confirm(
      "Bạn có chắc muốn xóa toàn bộ lịch sử chấm thi đua không?",
    );

    if (!confirmed) return;

    setHistory([]);
  }

  function resetAllConfig() {
    const confirmed = window.confirm(
      "Khôi phục cấu hình mặc định?\n\nToàn bộ tiêu chí bạn đã thêm sẽ bị thay thế.",
    );

    if (!confirmed) return;

    setConfig(cloneData(DEFAULT_CONFIG));
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="competition-page">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="competition-header">
        <div>
          <div className="breadcrumb">
            Giáo viên
            <span>/</span>
            Thi đua & Nề nếp
          </div>

          <h1>Thi đua & Nề nếp</h1>

          <p>
            Quản lý cấu hình buổi học, tiêu chí thi đua và tra cứu lịch sử đã lưu.
          </p>
        </div>

        <div className="header-actions">
          {activeTab === "config" && (
            <button className="btn btn-secondary" onClick={resetAllConfig}>
              <span>↺</span>
              Khôi phục mặc định
            </button>
          )}

          {activeTab === "history" && history.length > 0 && (
            <button
              className="btn btn-danger-outline"
              onClick={clearAllHistory}
            >
              <span>🗑</span>
              Xóa lịch sử
            </button>
          )}
        </div>
      </div>

      {/* =====================================================
          STAT CARDS
      ===================================================== */}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">📅</div>

          <div className="stat-content">
            <span className="stat-label">Buổi học</span>
            <strong>{totalSessions}</strong>
            <small>Đang cấu hình</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple">📋</div>

          <div className="stat-content">
            <span className="stat-label">Tiêu chí lớn</span>
            <strong>{config.criteria.length}</strong>
            <small>Nhóm tiêu chí</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">☑</div>

          <div className="stat-content">
            <span className="stat-label">Tiêu chí con</span>
            <strong>{totalCriteria}</strong>
            <small>Có thể tùy chỉnh</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">📊</div>

          <div className="stat-content">
            <span className="stat-label">Đã chấm</span>
            <strong>{history.length}</strong>
            <small>Phiếu thi đua</small>
          </div>
        </div>
      </div>

      {/* =====================================================
          MAIN TABS
      ===================================================== */}

      <div className="main-tabs">
        <button
          className={activeTab === "config" ? "active" : ""}
          onClick={() => setActiveTab("config")}
        >
          <span>⚙️</span>
          Cấu hình
        </button>

        <button
          className={activeTab === "history" ? "active" : ""}
          onClick={() => setActiveTab("history")}
        >
          <span>📚</span>
          Lịch sử
          {history.length > 0 && <b className="tab-count">{history.length}</b>}
        </button>
      </div>

      {/* =====================================================
          CONFIG TAB
      ===================================================== */}

      {activeTab === "config" && (
        <div className="config-layout">
          <aside className="config-sidebar">
            <div className="config-sidebar-title">
              <span>⚙️</span>
              Cấu hình hệ thống
            </div>

            <button
              className={
                configSection === "sessions"
                  ? "config-nav active"
                  : "config-nav"
              }
              onClick={() => setConfigSection("sessions")}
            >
              <span className="nav-icon">📅</span>

              <div>
                <strong>Buổi học</strong>
                <small>{config.sessions.length} buổi</small>
              </div>
            </button>

            <button
              className={
                configSection === "criteria"
                  ? "config-nav active"
                  : "config-nav"
              }
              onClick={() => setConfigSection("criteria")}
            >
              <span className="nav-icon">📋</span>

              <div>
                <strong>Tiêu chí chấm</strong>
                <small>{config.criteria.length} nhóm</small>
              </div>
            </button>

            <div className="config-help">
              <div className="help-icon">💡</div>

              <strong>Mẹo</strong>

              <p>Bạn có thể tự thêm các tiêu chí mới mà không cần sửa code.</p>
            </div>
          </aside>

          <section className="config-content">
            {/* =================================================
                SESSIONS
            ================================================= */}

            {configSection === "sessions" && (
              <div className="content-card">
                <div className="content-card-header">
                  <div>
                    <h2>Thiết lập buổi học</h2>

                    <p>Thiết lập số buổi trong ngày và khung giờ áp dụng.</p>
                  </div>

                  <button
                    className="btn btn-primary"
                    onClick={openCreateSession}
                  >
                    <span>＋</span>
                    Thêm buổi
                  </button>
                </div>

                <div className="session-info-box">
                  <div className="info-icon">ℹ️</div>

                  <div>
                    <strong>Có thể thiết lập Sáng, Chiều hoặc Cả ngày</strong>

                    <p>
                      Bạn có thể thêm, sửa, bật hoặc tắt buổi theo mô hình hoạt động của đơn vị.
                    </p>
                  </div>
                </div>

                <div className="session-list">
                  {config.sessions.length === 0 ? (
                    <div className="empty-state">
                      <div>📅</div>

                      <h3>Chưa có buổi học</h3>

                      <p>Hãy thêm buổi học để bắt đầu cấu hình.</p>

                      <button
                        className="btn btn-primary"
                        onClick={openCreateSession}
                      >
                        Thêm buổi đầu tiên
                      </button>
                    </div>
                  ) : (
                    config.sessions.map((session, index) => (
                      <div
                        className={`session-item ${
                          session.enabled ? "" : "disabled"
                        }`}
                        key={session.id}
                      >
                        <div className="session-number">{index + 1}</div>

                        <div className="session-main">
                          <div className="session-title-row">
                            <h3>{session.name}</h3>

                            <span
                              className={
                                session.enabled
                                  ? "status-badge active"
                                  : "status-badge inactive"
                              }
                            >
                              {session.enabled ? "Đang dùng" : "Tạm tắt"}
                            </span>
                          </div>

                          <div className="session-time">
                            <span>🕐</span>
                            {session.startTime} – {session.endTime}
                          </div>
                        </div>

                        <div className="session-actions">
                          <button
                            className="icon-btn"
                            title={session.enabled ? "Tạm tắt" : "Bật"}
                            onClick={() => toggleSession(session.id)}
                          >
                            {session.enabled ? "◉" : "○"}
                          </button>

                          <button
                            className="icon-btn"
                            title="Chỉnh sửa"
                            onClick={() => openEditSession(session)}
                          >
                            ✏️
                          </button>

                          <button
                            className="icon-btn danger"
                            title="Xóa"
                            onClick={() => deleteSession(session.id)}
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* =================================================
                CRITERIA
            ================================================= */}

            {configSection === "criteria" && (
              <div className="content-card">
                <div className="content-card-header">
                  <div>
                    <h2>Nhóm tiêu chí</h2>

                    <p>
                      Tạo nhóm tiêu chí và các tiêu chí con theo nhu cầu thực
                      tế.
                    </p>
                  </div>

                  <button
                    className="btn btn-primary"
                    onClick={openCreateCriteria}
                  >
                    <span>＋</span>
                    Thêm tiêu chí
                  </button>
                </div>

                <div className="criteria-note">
                  <div className="info-icon">💡</div>

                  <div>
                    <strong>Tiêu chí hoàn toàn linh hoạt</strong>

                    <p>
                      Ví dụ: Sĩ số, Nề nếp, Vệ sinh, Học tập, Đồng phục, Trực
                      nhật...
                    </p>
                  </div>
                </div>

                <div className="criteria-list">
                  {config.criteria.length === 0 ? (
                    <div className="empty-state">
                      <div>📋</div>

                      <h3>Chưa có tiêu chí</h3>

                      <p>Hãy tạo nhóm tiêu chí đầu tiên.</p>

                      <button
                        className="btn btn-primary"
                        onClick={openCreateCriteria}
                      >
                        Tạo tiêu chí
                      </button>
                    </div>
                  ) : (
                    config.criteria.map((criteria, index) => (
                      <div className="criteria-card" key={criteria.id}>
                        <div className="criteria-header">
                          <div className="criteria-title">
                            <div className="criteria-icon">
                              {criteria.icon || "📌"}
                            </div>

                            <div>
                              <div className="criteria-name-row">
                                <h3>{criteria.name}</h3>

                                <span className="criteria-count">
                                  {criteria.children.length} tiêu chí con
                                </span>
                              </div>

                              <p>{criteria.description || "Chưa có mô tả"}</p>
                            </div>
                          </div>

                          <div className="criteria-actions">
                            <button
                              className="btn btn-small btn-secondary"
                              onClick={() => openEditCriteria(criteria)}
                            >
                              ✏️ Sửa
                            </button>

                            <button
                              className="btn btn-small btn-danger-outline"
                              onClick={() => deleteCriteria(criteria.id)}
                            >
                              🗑 Xóa
                            </button>
                          </div>
                        </div>

                        <div className="criteria-children">
                          <div className="children-header">
                            <span>Tiêu chí con</span>

                            <button
                              className="text-btn"
                              onClick={() => openCreateChild(criteria.id)}
                            >
                              ＋ Thêm tiêu chí con
                            </button>
                          </div>

                          {criteria.children.length === 0 ? (
                            <div className="children-empty">
                              <span>Chưa có tiêu chí con.</span>

                              <button
                                onClick={() => openCreateChild(criteria.id)}
                              >
                                Thêm ngay
                              </button>
                            </div>
                          ) : (
                            <div className="children-table">
                              <div className="children-table-head">
                                <span>Tên tiêu chí</span>
                                <span>Điểm</span>
                                <span>Loại input</span>
                                <span></span>
                              </div>

                              {criteria.children.map((child) => (
                                <div className="child-row" key={child.id}>
                                  <div className="child-name">
                                    <span className="child-dot"></span>

                                    <div>
                                      <strong>{child.name}</strong>

                                      {child.options?.length > 0 && (
                                        <small>
                                          {child.options.join(" • ")}
                                        </small>
                                      )}
                                    </div>
                                  </div>

                                  <div
                                    className={`point-badge ${
                                      child.point < 0 ? "minus" : "plus"
                                    }`}
                                  >
                                    {child.point > 0 ? "+" : ""}
                                    {child.point}
                                  </div>

                                  <div>
                                    <span className="input-type-badge">
                                      {getInputTypeLabel(child.inputType)}
                                    </span>
                                  </div>

                                  <div className="child-actions">
                                    <button
                                      className="icon-btn"
                                      onClick={() =>
                                        openEditChild(criteria.id, child)
                                      }
                                    >
                                      ✏️
                                    </button>

                                    <button
                                      className="icon-btn danger"
                                      onClick={() =>
                                        deleteChild(criteria.id, child.id)
                                      }
                                    >
                                      🗑
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* =====================================================
          HISTORY TAB
      ===================================================== */}

      {activeTab === "history" && (
        <div className="content-card">
          <div className="content-card-header">
            <div>
              <h2>Lịch sử chấm thi đua</h2>

              <p>Theo dõi các phiếu thi đua đã được ghi nhận.</p>
            </div>

            <div className="history-total">
              {filteredHistory.length} bản ghi
            </div>
          </div>

          <div className="history-filters">
            <div className="form-group">
              <label>Ngày</label>

              <input
                type="date"
                className="form-input"
                value={historyFilter.date}
                onChange={(event) =>
                  setHistoryFilter((prev) => ({
                    ...prev,
                    date: event.target.value,
                  }))
                }
              />
            </div>

            <div className="form-group">
              <label>Buổi</label>

              <select
                className="form-select"
                value={historyFilter.sessionId}
                onChange={(event) =>
                  setHistoryFilter((prev) => ({
                    ...prev,
                    sessionId: event.target.value,
                  }))
                }
              >
                <option value="">Tất cả buổi</option>

                {config.sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Lớp</label>

              <select
                className="form-select"
                value={historyFilter.className}
                onChange={(event) =>
                  setHistoryFilter((prev) => ({
                    ...prev,
                    className: event.target.value,
                  }))
                }
              >
                <option value="">Tất cả lớp</option>

                {DEFAULT_CLASSES.map((className) => (
                  <option key={className} value={className}>
                    {className}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="btn btn-secondary filter-reset"
              onClick={() =>
                setHistoryFilter({
                  date: "",
                  className: "",
                  sessionId: "",
                })
              }
            >
              Xóa bộ lọc
            </button>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="empty-state history-empty">
              <div>📚</div>

              <h3>Chưa có dữ liệu lịch sử</h3>

              <p>Các bản ghi lịch sử đã lưu trước đây sẽ hiển thị tại đây.</p>

            </div>
          ) : (
            <div className="history-table-wrapper">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Buổi</th>
                    <th>Lớp</th>
                    <th>Điểm</th>
                    <th>Ghi chú</th>
                    <th>Thời gian lưu</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredHistory.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{formatDate(`${item.date}T00:00:00`)}</strong>
                      </td>

                      <td>
                        <span className="table-session">
                          {item.sessionName}
                        </span>
                      </td>

                      <td>
                        <span className="class-badge">{item.className}</span>
                      </td>

                      <td>
                        <span
                          className={`table-score ${
                            item.totalPoint < 0 ? "negative" : "positive"
                          }`}
                        >
                          {item.totalPoint > 0 ? "+" : ""}
                          {item.totalPoint}
                        </span>
                      </td>

                      <td>
                        <span className="table-note">{item.note || "—"}</span>
                      </td>

                      <td className="created-time">
                        {formatDateTime(item.createdAt)}
                      </td>

                      <td>
                        <div className="table-actions">
                          <button
                            className="icon-btn"
                            title="Xem chi tiết"
                            onClick={() => setSelectedHistory(item)}
                          >
                            👁
                          </button>

                          <button
                            className="icon-btn danger"
                            title="Xóa"
                            onClick={() => deleteHistory(item.id)}
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =====================================================
          SESSION MODAL
      ===================================================== */}

      {showSessionModal && (
        <div
          className="modal-overlay"
          onMouseDown={() => setShowSessionModal(false)}
        >
          <div
            className="modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3>
                  {editingSessionId ? "Chỉnh sửa buổi học" : "Thêm buổi học"}
                </h3>

                <p>Thiết lập tên và thời gian của buổi.</p>
              </div>

              <button
                className="modal-close"
                onClick={() => setShowSessionModal(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>
                  Tên buổi <span>*</span>
                </label>

                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: Sáng, Chiều, Cả ngày..."
                  value={sessionForm.name}
                  onChange={(event) =>
                    setSessionForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Giờ bắt đầu</label>

                  <input
                    type="time"
                    className="form-input"
                    value={sessionForm.startTime}
                    onChange={(event) =>
                      setSessionForm((prev) => ({
                        ...prev,
                        startTime: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Giờ kết thúc</label>

                  <input
                    type="time"
                    className="form-input"
                    value={sessionForm.endTime}
                    onChange={(event) =>
                      setSessionForm((prev) => ({
                        ...prev,
                        endTime: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={sessionForm.enabled}
                  onChange={(event) =>
                    setSessionForm((prev) => ({
                      ...prev,
                      enabled: event.target.checked,
                    }))
                  }
                />

                <span className="switch"></span>

                <span>
                  <strong>Kích hoạt buổi này</strong>
                  <small>Bật hoặc tắt buổi này trong cấu hình.</small>
                </span>
              </label>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowSessionModal(false)}
              >
                Hủy
              </button>

              <button className="btn btn-primary" onClick={saveSession}>
                Lưu buổi học
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          CRITERIA MODAL
      ===================================================== */}

      {showCriteriaModal && (
        <div
          className="modal-overlay"
          onMouseDown={() => setShowCriteriaModal(false)}
        >
          <div
            className="modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3>
                  {editingCriteriaId ? "Chỉnh sửa tiêu chí" : "Thêm tiêu chí"}
                </h3>

                <p>Tạo một nhóm tiêu chí lớn.</p>
              </div>

              <button
                className="modal-close"
                onClick={() => setShowCriteriaModal(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-grid-2">
                <div className="form-group">
                  <label>
                    Tên tiêu chí <span>*</span>
                  </label>

                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ví dụ: Sĩ số"
                    value={criteriaForm.name}
                    onChange={(event) =>
                      setCriteriaForm((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Biểu tượng</label>

                  <input
                    type="text"
                    className="form-input emoji-input"
                    placeholder="👥"
                    value={criteriaForm.icon}
                    onChange={(event) =>
                      setCriteriaForm((prev) => ({
                        ...prev,
                        icon: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Mô tả</label>

                <textarea
                  className="form-textarea"
                  rows="3"
                  placeholder="Mô tả ngắn về nhóm tiêu chí..."
                  value={criteriaForm.description}
                  onChange={(event) =>
                    setCriteriaForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowCriteriaModal(false)}
              >
                Hủy
              </button>

              <button className="btn btn-primary" onClick={saveCriteria}>
                Lưu tiêu chí
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          CHILD MODAL
      ===================================================== */}

      {showChildModal && (
        <div
          className="modal-overlay"
          onMouseDown={() => setShowChildModal(false)}
        >
          <div
            className="modal modal-large"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3>
                  {editingChildId
                    ? "Chỉnh sửa tiêu chí con"
                    : "Thêm tiêu chí con"}
                </h3>

                <p>Cấu hình nội dung, điểm và kiểu nhập dữ liệu.</p>
              </div>

              <button
                className="modal-close"
                onClick={() => setShowChildModal(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>
                  Tên tiêu chí <span>*</span>
                </label>

                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: Vắng không phép"
                  value={childForm.name}
                  onChange={(event) =>
                    setChildForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Điểm</label>

                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    value={childForm.point}
                    onChange={(event) =>
                      setChildForm((prev) => ({
                        ...prev,
                        point: event.target.value,
                      }))
                    }
                  />

                  <small className="form-help">
                    Ví dụ -1, -2, -3 là điểm trừ.
                  </small>
                </div>

                <div className="form-group">
                  <label>Loại input</label>

                  <select
                    className="form-select"
                    value={childForm.inputType}
                    onChange={(event) =>
                      setChildForm((prev) => ({
                        ...prev,
                        inputType: event.target.value,
                      }))
                    }
                  >
                    {INPUT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>

                  <small className="form-help">
                    {
                      INPUT_TYPES.find(
                        (type) => type.value === childForm.inputType,
                      )?.description
                    }
                  </small>
                </div>
              </div>

              {(childForm.inputType === "select" ||
                childForm.inputType === "radio") && (
                <div className="form-group">
                  <label>Danh sách phương án</label>

                  <textarea
                    className="form-textarea"
                    rows="5"
                    placeholder={
                      "Mỗi phương án một dòng\nVí dụ:\nTốt\nKhá\nTrung bình\nChưa đạt"
                    }
                    value={childForm.optionsText}
                    onChange={(event) =>
                      setChildForm((prev) => ({
                        ...prev,
                        optionsText: event.target.value,
                      }))
                    }
                  />

                  <small className="form-help">
                    Mỗi phương án nhập trên một dòng.
                  </small>
                </div>
              )}

              <div className="input-preview">
                <div className="preview-label">Xem trước</div>

                <div className="preview-content">
                  {childForm.inputType === "checkbox" && (
                    <label className="competition-checkbox">
                      <input type="checkbox" />
                      <span className="custom-check"></span>
                      <span>{childForm.name || "Tiêu chí checkbox"}</span>
                    </label>
                  )}

                  {childForm.inputType === "number" && (
                    <div className="input-with-unit">
                      <input type="number" placeholder="0" />
                      <span>lần</span>
                    </div>
                  )}

                  {childForm.inputType === "text" && (
                    <input
                      className="form-input"
                      placeholder={childForm.name || "Nhập nội dung..."}
                    />
                  )}

                  {childForm.inputType === "textarea" && (
                    <textarea
                      className="form-textarea"
                      rows="3"
                      placeholder={childForm.name || "Nhập nội dung..."}
                    />
                  )}

                  {childForm.inputType === "select" && (
                    <select className="form-select">
                      <option>-- Chọn phương án --</option>

                      {childForm.optionsText
                        .split("\n")
                        .filter(Boolean)
                        .map((item, index) => (
                          <option key={index}>{item}</option>
                        ))}
                    </select>
                  )}

                  {childForm.inputType === "radio" && (
                    <div className="radio-list">
                      {childForm.optionsText
                        .split("\n")
                        .filter(Boolean)
                        .map((item, index) => (
                          <label className="radio-option" key={index}>
                            <input type="radio" name="preview-radio" />
                            <span>{item}</span>
                          </label>
                        ))}
                    </div>
                  )}

                  {childForm.inputType === "score" && (
                    <div className="input-with-unit">
                      <input type="number" step="0.1" placeholder="0" />
                      <span>điểm</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowChildModal(false)}
              >
                Hủy
              </button>

              <button className="btn btn-primary" onClick={saveChild}>
                Lưu tiêu chí con
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          HISTORY DETAIL MODAL
      ===================================================== */}

      {selectedHistory && (
        <div
          className="modal-overlay"
          onMouseDown={() => setSelectedHistory(null)}
        >
          <div
            className="modal modal-large"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3>Chi tiết phiếu thi đua</h3>

                <p>
                  {selectedHistory.className} ·{" "}
                  {formatDate(`${selectedHistory.date}T00:00:00`)} ·{" "}
                  {selectedHistory.sessionName}
                </p>
              </div>

              <button
                className="modal-close"
                onClick={() => setSelectedHistory(null)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-summary">
                <div>
                  <span>Lớp</span>
                  <strong>{selectedHistory.className}</strong>
                </div>

                <div>
                  <span>Ngày</span>
                  <strong>
                    {formatDate(`${selectedHistory.date}T00:00:00`)}
                  </strong>
                </div>

                <div>
                  <span>Buổi</span>
                  <strong>{selectedHistory.sessionName}</strong>
                </div>

                <div>
                  <span>Tổng điểm</span>
                  <strong className="detail-total">
                    {selectedHistory.totalPoint}
                  </strong>
                </div>
              </div>

              <div className="detail-list">
                {config.criteria.map((criteria) => {
                  const activeChildren = criteria.children.filter((child) => {
                    const value = selectedHistory.values?.[child.id];

                    return (
                      value !== undefined &&
                      value !== null &&
                      value !== "" &&
                      value !== false &&
                      value !== 0 &&
                      value !== "0"
                    );
                  });

                  if (!activeChildren.length) {
                    return null;
                  }

                  return (
                    <div className="detail-section" key={criteria.id}>
                      <div className="detail-section-title">
                        <span>{criteria.icon || "📌"}</span>

                        <strong>{criteria.name}</strong>
                      </div>

                      {activeChildren.map((child) => (
                        <div className="detail-row" key={child.id}>
                          <span>{child.name}</span>

                          <strong>
                            {String(selectedHistory.values[child.id])}

                            {child.inputType === "number" && " lần"}
                          </strong>

                          <b>
                            {calculateChildPoint(
                              child,
                              selectedHistory.values[child.id],
                            )}
                          </b>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {selectedHistory.note && (
                <div className="detail-note">
                  <strong>Ghi chú</strong>
                  <p>{selectedHistory.note}</p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedHistory(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
