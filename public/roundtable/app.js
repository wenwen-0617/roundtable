const state = {
  busy: false,
  lastMessageCount: 0,
  lastMessageSig: "",
  target: "",
  topicId: "",
  topicsOpen: false,
  topicDrawerMode: "topics",
  latestTopics: [],
  currentTopicTitle: "",
  fixedRooms: {},
  directChats: {},
  sidebarProjects: [],
  hiddenTopicIds: [],
  summaryPending: false,
  runtimeStatus: null,
  serverMessages: [],
  optimisticMessages: [],
  summarySelectedIds: new Set(),
  notebook: null,
  notebookProjectId: "",
};

const els = {
  statusText: document.querySelector("#statusText"),
  roundText: document.querySelector("#roundText"),
  topicInput: document.querySelector("#topicInput"),
  startButton: document.querySelector("#startButton"),
  stepButton: document.querySelector("#stepButton"),
  mobileNavToggle: document.querySelector("#mobileNavToggle"),
  mobileSearchBtn: document.querySelector("#mobileSearchBtn"),
  roomActionsToggle: document.querySelector("#roomActionsToggle"),
  endTopicButton: document.querySelector("#endTopicButton"),
  newCodexButton: document.querySelector("#newCodexButton"),
  newClaudeButton: document.querySelector("#newClaudeButton"),
  summaryButton: document.querySelector("#summaryButton"),
  topicsToggleButton: document.querySelector("#topicsToggleButton"),
  topicsDrawer: document.querySelector("#topicsDrawer"),
  topicsCloseButton: document.querySelector("#topicsCloseButton"),
  topicsScrim: document.querySelector("#topicsScrim"),
  currentTopicText: document.querySelector("#currentTopicText"),
  topicsList: document.querySelector("#topicsList"),
  errorBox: document.querySelector("#errorBox"),
  approvalPanel: document.querySelector("#approvalPanel"),
  runtimeStatusPanel: document.querySelector("#runtimeStatusPanel"),
  messages: document.querySelector("#messages"),
  interjectForm: document.querySelector("#interjectForm"),
  interjectInput: document.querySelector("#interjectInput"),
  sendButton: document.querySelector("#sendButton"),
  interruptSendButton: document.querySelector("#interruptSendButton"),
  attachmentInput: document.querySelector("#attachmentInput"),
  attachButton: document.querySelector("#attachButton"),
  attachmentTray: document.querySelector("#attachmentTray"),
  targetButtons: [...document.querySelectorAll(".target-toggle [data-target]")],
  targetToggleBtn: document.querySelector("#targetToggleBtn"),
  targetToggle: document.querySelector(".target-toggle"),
  targetLabel: document.querySelector("#targetLabel"),
  roomTitleText: document.querySelector("#roomTitleText"),
  roomMetaText: document.querySelector("#roomMetaText"),
  roomButtons: [...document.querySelectorAll("[data-room-id]")],
  directButtons: [...document.querySelectorAll("[data-direct-id]")],
  newTopicKindInputs: [...document.querySelectorAll("input[name='newTopicKind']")],
  projectsList: document.querySelector("#projectsList"),
  fixedTopicsList: document.querySelector("#fixedTopicsList"),
  fixedRoomsList: document.querySelector("#fixedRoomsList"),
  temporaryTopicsList: document.querySelector("#temporaryTopicsList"),
  otherTopicsList: document.querySelector("#otherTopicsList"),
  topicRenameInput: document.querySelector("#topicRenameInput"),
  renameTopicButton: document.querySelector("#renameTopicButton"),
  deleteCurrentTopicButton: document.querySelector("#deleteCurrentTopicButton"),
  fixedRoomIconPicker: document.querySelector("#fixedRoomIconPicker"),
  fixedRoomIconOptions: document.querySelector("#fixedRoomIconOptions"),
  summaryTimeline: document.querySelector("#summaryTimeline"),
  summarySelectedCount: document.querySelector("#summarySelectedCount"),
  summaryManualButton: document.querySelector("#summaryManualButton"),
  summaryMergeButton: document.querySelector("#summaryMergeButton"),
  summaryClearSelectionButton: document.querySelector("#summaryClearSelectionButton"),
  summaryActionStatus: document.querySelector("#summaryActionStatus"),
  summaryEditDialog: document.querySelector("#summaryEditDialog"),
  summaryEditForm: document.querySelector("#summaryEditForm"),
  summaryEditId: document.querySelector("#summaryEditId"),
  summaryEditTitleText: document.querySelector("#summaryEditTitleText"),
  summaryEditTitleInput: document.querySelector("#summaryEditTitleInput"),
  summaryEditTextInput: document.querySelector("#summaryEditTextInput"),
  summaryEditDecisionsInput: document.querySelector("#summaryEditDecisionsInput"),
  summaryEditOpenItemsInput: document.querySelector("#summaryEditOpenItemsInput"),
  summaryEditLatestStateInput: document.querySelector("#summaryEditLatestStateInput"),
  summaryEditTagsInput: document.querySelector("#summaryEditTagsInput"),
  summaryEditCloseButton: document.querySelector("#summaryEditCloseButton"),
  summaryEditCancelButton: document.querySelector("#summaryEditCancelButton"),
  summaryEditSaveButton: document.querySelector("#summaryEditSaveButton"),
  notebookGrid: document.querySelector("#notebookGrid"),
  archiveOpenButton: document.querySelector("#archiveOpenButton"),
  archiveForm: document.querySelector("#archiveForm"),
  archiveTitleInput: document.querySelector("#archiveTitleInput"),
  archiveSummaryInput: document.querySelector("#archiveSummaryInput"),
  archiveTagsInput: document.querySelector("#archiveTagsInput"),
  archiveSourceInput: document.querySelector("#archiveSourceInput"),
  archiveSubmitButton: document.querySelector("#archiveSubmitButton"),
  archiveCancelButton: document.querySelector("#archiveCancelButton"),
  msgSearchInput: document.querySelector("#msgSearchInput"),
  memoryScopeSelect: document.querySelector("#memoryScopeSelect"),
  memoryProjectInput: document.querySelector("#memoryProjectInput"),
  msgSearchResults: document.querySelector("#msgSearchResults"),
  searchOverlay: document.querySelector("#searchOverlay"),
  searchOverlayInput: document.querySelector("#searchOverlayInput"),
  searchOverlayClose: document.querySelector("#searchOverlayClose"),
  searchOverlayBackdrop: document.querySelector("#searchOverlayBackdrop"),
  searchOverlayScope: document.querySelector("#searchOverlayScope"),
  searchOverlayResults: document.querySelector("#searchOverlayResults"),
  searchTypeTabs: [...document.querySelectorAll(".search-type-tab")],
  studyOverviewSaveButton: document.querySelector("#studyOverviewSaveButton"),
  studyCurrentGoalInput: document.querySelector("#studyCurrentGoalInput"),
  studyCurrentPhaseInput: document.querySelector("#studyCurrentPhaseInput"),
  studyCurrentScoresInput: document.querySelector("#studyCurrentScoresInput"),
  studyMainRisksInput: document.querySelector("#studyMainRisksInput"),
  studyNextThreeDaysInput: document.querySelector("#studyNextThreeDaysInput"),
  studyPlanSaveButton: document.querySelector("#studyPlanSaveButton"),
  studyPlanDateInput: document.querySelector("#studyPlanDateInput"),
  studyPlanPhaseInput: document.querySelector("#studyPlanPhaseInput"),
  studyPlanFocusInput: document.querySelector("#studyPlanFocusInput"),
  studyPlanTasksInput: document.querySelector("#studyPlanTasksInput"),
  studyPlanMetricsInput: document.querySelector("#studyPlanMetricsInput"),
  studyPlanReviewInput: document.querySelector("#studyPlanReviewInput"),
  studyPlanNotesInput: document.querySelector("#studyPlanNotesInput"),
  studyProgressSaveButton: document.querySelector("#studyProgressSaveButton"),
  studyProgressDateInput: document.querySelector("#studyProgressDateInput"),
  studyActualCompletedInput: document.querySelector("#studyActualCompletedInput"),
  studyEvidenceInput: document.querySelector("#studyEvidenceInput"),
  studySelfNoteInput: document.querySelector("#studySelfNoteInput"),
  studyTeacherFeedbackInput: document.querySelector("#studyTeacherFeedbackInput"),
  studyReviewDebtInput: document.querySelector("#studyReviewDebtInput"),
  studyNextAdjustmentInput: document.querySelector("#studyNextAdjustmentInput"),
  studyPlanTable: document.querySelector("#studyPlanTable"),
  studyProgressTable: document.querySelector("#studyProgressTable"),
  notebookProjectSelect: document.querySelector("#notebookProjectSelect"),
  notebookInboxForm: document.querySelector("#notebookInboxForm"),
  notebookInboxInput: document.querySelector("#notebookInboxInput"),
  roundtableNotebook: document.querySelector("#roundtableNotebook"),
  worklogContent: document.querySelector("#worklogContent"),
  worklogRefreshButton: document.querySelector("#worklogRefreshButton"),
};

const pendingAttachments = [];

els.startButton.addEventListener("click", async () => {
  const selectedKind = els.newTopicKindInputs.find((input) => input.checked)?.value || "temporary";
  const topic = normalizeCreatedTopicTitle(els.topicInput.value, selectedKind);
  if (!topic) return;
  await postJson("/api/start", {
    topic,
    kind: selectedKind,
  });
  setTopicsOpen(false);
  setTimeout(refreshState, 250);
});

els.stepButton.addEventListener("click", async () => {
  await postJson("/api/step", {});
});

els.summaryButton.addEventListener("click", async () => {
  if (state.summaryPending) {
    return;
  }
  state.summaryPending = true;
  renderSummaryButton();
  const data = await postJson("/api/summary", {}, { timeoutMs: 120000 });
  if (!data) {
    state.summaryPending = false;
    renderSummaryButton();
    return;
  }
  scheduleSummaryRefresh();
});

document.querySelector('[data-view="summaries"]')?.addEventListener("click", () => {
  refreshSummaries();
});

els.summaryMergeButton?.addEventListener("click", mergeSelectedSummaries);
els.summaryManualButton?.addEventListener("click", openSummaryCreateDialog);
els.summaryClearSelectionButton?.addEventListener("click", () => {
  state.summarySelectedIds.clear();
  renderSummaryTimeline(summaryDaysCache);
  renderSummaryBulkControls();
  setSummaryActionStatus("已清除选择。");
});
els.summaryEditCloseButton?.addEventListener("click", closeSummaryEditDialog);
els.summaryEditCancelButton?.addEventListener("click", closeSummaryEditDialog);
els.summaryEditForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveSummaryEdit();
});

document.querySelector('[data-view="plan"]')?.addEventListener("click", () => {
  refreshStudyTracker();
});

document.querySelector('[data-view="notes"]')?.addEventListener("click", () => {
  refreshNotebook();
});

els.worklogRefreshButton?.addEventListener("click", () => {
  refreshWorklog();
});

els.notebookProjectSelect?.addEventListener("change", () => {
  state.notebookProjectId = els.notebookProjectSelect.value || "";
  renderNotebook(state.notebook);
});

els.notebookInboxForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = (els.notebookInboxInput?.value || "").trim();
  if (!text) return;
  const notebook = cloneNotebook(state.notebook);
  notebook.inbox = Array.isArray(notebook.inbox) ? notebook.inbox : [];
  notebook.inbox.unshift({
    id: createNotebookId("inbox"),
    text,
    done: false,
    kind: "bug",
  });
  if (els.notebookInboxInput) els.notebookInboxInput.value = "";
  await saveNotebook(notebook);
});

els.notebookInboxInput?.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    els.notebookInboxForm?.requestSubmit();
  }
});

for (const button of document.querySelectorAll("[data-view]")) {
  button.addEventListener("click", () => {
    setActiveView(button.dataset.view || "chat");
  });
}

els.topicsToggleButton.addEventListener("click", () => {
  setTopicsOpen(!state.topicsOpen || state.topicDrawerMode !== "topics", "topics");
});

document.querySelectorAll("[data-open-topics]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    setTopicsOpen(true, "create");
    setTimeout(() => els.topicInput?.focus(), 80);
  });
});

// Mobile nav panel toggle (side panel collapse)
(function initMobileNav() {
  const appShell = document.querySelector(".app-shell");
  const btn = els.mobileNavToggle;
  if (!appShell || !btn) return;
  const isMobile = () => window.matchMedia("(max-width: 620px)").matches;
  const STORAGE_KEY = "roundtable_nav_collapsed";

  const backdrop = document.createElement("div");
  backdrop.className = "mobile-nav-backdrop";
  appShell.appendChild(backdrop);

  function setNavCollapsed(collapsed) {
    appShell.classList.toggle("nav-collapsed", collapsed);
    appShell.classList.toggle("mobile-nav-open", !collapsed && isMobile());
    backdrop.classList.toggle("visible", !collapsed && isMobile());
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    btn.title = collapsed ? "Show navigation" : "Hide navigation";
    try { localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0"); } catch {}
  }
  // Default collapsed on mobile
  if (isMobile()) {
    const stored = (() => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } })();
    setNavCollapsed(stored !== "0");
  }
  btn.addEventListener("click", () => setNavCollapsed(!appShell.classList.contains("nav-collapsed")));
  backdrop.addEventListener("click", () => setNavCollapsed(true));
  appShell.addEventListener("click", (event) => {
    if (!isMobile() || appShell.classList.contains("nav-collapsed")) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(".side-panel .room-item, .side-panel .side-topic-item, .side-panel .new-chat-button")) {
      setNavCollapsed(true);
    }
  });
})();

// Mobile search button
if (els.mobileSearchBtn) {
  els.mobileSearchBtn.addEventListener("click", () => openSearchOverlay(""));
}

if (els.roomActionsToggle) {
  const roomActionsEl = document.querySelector(".room-actions");
  els.roomActionsToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = roomActionsEl?.classList.toggle("open");
    els.roomActionsToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  roomActionsEl?.addEventListener("click", () => {
    roomActionsEl.classList.remove("open");
    els.roomActionsToggle.setAttribute("aria-expanded", "false");
  });
  document.addEventListener("click", (e) => {
    if (roomActionsEl?.classList.contains("open")
      && !roomActionsEl.contains(e.target)
      && e.target !== els.roomActionsToggle) {
      roomActionsEl.classList.remove("open");
      els.roomActionsToggle.setAttribute("aria-expanded", "false");
    }
  });
}

els.topicsCloseButton.addEventListener("click", () => {
  setTopicsOpen(false);
});

els.topicsScrim.addEventListener("click", () => {
  setTopicsOpen(false);
});

els.interjectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitUserMessage({ interrupt: false });
});

els.interruptSendButton?.addEventListener("click", async () => {
  const text = els.interjectInput?.value.trim() || "";
  const hasAttachments = pendingAttachments.length > 0;
  if (!text && !hasAttachments) {
    const activeRuns = state.runtimeStatus?.activeRuns || [];
    const speakers = [...new Set(activeRuns.map((r) => r.speaker).filter(Boolean))];
    const targets = speakers.length ? speakers : ["codex", "claude"];
    await Promise.allSettled(targets.map((speaker) => postJson("/api/interrupt-speaker", { speaker })));
    return;
  }
  await submitUserMessage({ interrupt: true });
});

els.interjectInput?.addEventListener("input", resizeInterjectInput);

els.interjectInput?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing || prefersMultilineEnter()) {
    return;
  }
  event.preventDefault();
  els.interjectForm?.requestSubmit();
});

els.attachButton?.addEventListener("click", () => {
  els.attachmentInput?.click();
});

els.attachmentInput?.addEventListener("change", async () => {
  const files = [...(els.attachmentInput.files || [])];
  els.attachmentInput.value = "";
  for (const file of files) {
    await uploadAttachment(file);
  }
});

if (els.targetToggleBtn) {
  els.targetToggleBtn.addEventListener("click", () => {
    if (els.targetToggle) {
      els.targetToggle.hidden = !els.targetToggle.hidden;
    }
  });
}

for (const button of els.targetButtons) {
  button.addEventListener("click", () => {
    state.target = button.dataset.target || "";
    renderTargetButtons();
    els.targetToggle.hidden = true;
  });
}

for (const button of els.roomButtons) {
  button.addEventListener("click", async () => {
    const roomId = button.dataset.roomId || "";
    if (!roomId) return;
    await postJson("/api/open-room", { roomId }, { timeoutMs: 12000 });
  });
}

for (const button of els.directButtons || []) {
  button.addEventListener("click", async () => {
    const id = button.dataset.directId || "";
    if (!id) return;
    await postJson("/api/open-direct", { id }, { timeoutMs: 12000 });
  });
}

function findActiveCustomizableFixedRoom() {
  const rooms = state.fixedRooms || {};
  for (const [id, room] of Object.entries(rooms)) {
    if (room?.customizable && room.topicId && room.topicId === state.topicId) {
      return { id, room };
    }
  }
  return null;
}

function findActiveProject() {
  const projects = state.sidebarProjects || [];
  return projects.find((p) => p?.topicId && p.topicId === state.topicId) || null;
}

function isActiveBuiltinFixedRoom() {
  const rooms = state.fixedRooms || {};
  for (const [, room] of Object.entries(rooms)) {
    if (room?.topicId && room.topicId === state.topicId && !room.customizable) {
      return true;
    }
  }
  return false;
}

function isActiveFixedRoom() {
  const rooms = state.fixedRooms || {};
  return Object.values(rooms).some((room) => room?.topicId && room.topicId === state.topicId);
}

function isActiveDirectChat() {
  const chats = state.directChats || {};
  return Object.values(chats).some((chat) => chat?.topicId && chat.topicId === state.topicId);
}

els.renameTopicButton?.addEventListener("click", async () => {
  const raw = els.topicRenameInput?.value || "";
  if (!state.topicId) return;
  const slot = findActiveCustomizableFixedRoom();
  if (slot) {
    const nextTitle = topicDisplayName(raw).trim();
    if (!nextTitle) return;
    await postJson("/api/fixed-room/update", { roomId: slot.id, title: nextTitle }, { timeoutMs: 12000 });
    return;
  }
  const project = findActiveProject();
  if (project) {
    const nextTitle = topicDisplayName(raw).trim();
    if (!nextTitle) return;
    await postJson("/api/project/update", { id: project.id, title: nextTitle }, { timeoutMs: 12000 });
    return;
  }
  if (isActiveBuiltinFixedRoom()) {
    return;
  }
  const nextTitle = preserveCurrentKind(raw);
  if (!nextTitle) return;
  await postJson("/api/update-topic", { id: state.topicId, topic: nextTitle }, { timeoutMs: 12000 });
});

els.deleteCurrentTopicButton?.addEventListener("click", async () => {
  if (!state.topicId) return;
  if (isActiveFixedRoom() || isActiveDirectChat()) return;
  await deleteTopicPermanently(state.topicId, state.currentTopicTitle || "");
});


els.studyOverviewSaveButton?.addEventListener("click", async () => {
  await postJson("/api/study-tracker/overview", {
    currentGoal: els.studyCurrentGoalInput?.value || "",
    currentPhase: els.studyCurrentPhaseInput?.value || "",
    currentScores: parseKeyValueText(els.studyCurrentScoresInput?.value || ""),
    mainRisks: linesFromText(els.studyMainRisksInput?.value || ""),
    nextThreeDays: linesFromText(els.studyNextThreeDaysInput?.value || ""),
  });
  refreshStudyTracker();
});

els.studyPlanSaveButton?.addEventListener("click", async () => {
  await postJson("/api/study-tracker/plan", {
    date: els.studyPlanDateInput?.value || todayText(),
    phase: els.studyPlanPhaseInput?.value || "",
    focus: els.studyPlanFocusInput?.value || "",
    tasks: linesFromText(els.studyPlanTasksInput?.value || ""),
    targetMetrics: linesFromText(els.studyPlanMetricsInput?.value || ""),
    reviewPlan: linesFromText(els.studyPlanReviewInput?.value || ""),
    teacherNotes: els.studyPlanNotesInput?.value || "",
  });
  refreshStudyTracker();
});

els.studyProgressSaveButton?.addEventListener("click", async () => {
  await postJson("/api/study-tracker/progress", {
    date: els.studyProgressDateInput?.value || todayText(),
    actualCompleted: els.studyActualCompletedInput?.value || "",
    evidence: els.studyEvidenceInput?.value || "",
    selfNote: els.studySelfNoteInput?.value || "",
    teacherFeedback: els.studyTeacherFeedbackInput?.value || "",
    reviewDebt: linesFromText(els.studyReviewDebtInput?.value || ""),
    nextAdjustment: els.studyNextAdjustmentInput?.value || "",
  });
  refreshStudyTracker();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.topicsOpen) {
    setTopicsOpen(false);
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

let refreshStateInFlight = null;

async function refreshState({ silentTimeout = false } = {}) {
  if (refreshStateInFlight) {
    return refreshStateInFlight;
  }
  refreshStateInFlight = refreshStateNow({ silentTimeout });
  try {
    return await refreshStateInFlight;
  } finally {
    refreshStateInFlight = null;
  }
}

async function refreshStateNow({ silentTimeout = false } = {}) {
  try {
    const data = await fetchJson("/api/state");
    render(data);
  } catch (error) {
    if (silentTimeout && isRequestTimeoutError(error)) {
      console.warn(error.message);
      return;
    }
    showError(error.message);
  }
}

async function postJson(url, body, options = {}) {
  state.busy = true;
  state.lastPostError = null;
  try {
    const data = await fetchJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, { timeoutMs: options.timeoutMs || 8000 });
    if (isRoundtableStatePayload(data)) {
      render(data);
    }
    return data;
  } catch (error) {
    state.lastPostError = error;
    showError(error.message);
    return null;
  } finally {
    state.busy = false;
  }
}

function isRoundtableStatePayload(data) {
  return Boolean(data && typeof data === "object" && (
    Array.isArray(data.messages) ||
    Object.prototype.hasOwnProperty.call(data, "runtimeStatus") ||
    Object.prototype.hasOwnProperty.call(data, "running") ||
    Object.prototype.hasOwnProperty.call(data, "status")
  ));
}

async function submitUserMessage({ interrupt = false } = {}) {
  const text = els.interjectInput.value.trim();
  if (!text && !pendingAttachments.length) {
    return;
  }
  if (pendingAttachments.some((item) => item.uploading)) {
    showError("Please wait for attachments to finish uploading.");
    return;
  }
  const attachments = pendingAttachments.map(({ attachment }) => attachment).filter(Boolean);
  const baseBody = { text, attachments, target: state.target };
  const sentDraft = els.interjectInput.value;
  const optimisticId = addOptimisticUserMessage({ text, attachments });
  els.interjectInput.value = "";
  resizeInterjectInput();
  let result = null;
  if (state.target === "none") {
    result = await postJson("/api/user-only", { ...baseBody, noReply: true, interrupt });
  } else {
    result = await postJson("/api/user", { ...baseBody, interrupt });
  }
  if (result || isSubmitLikelyAlreadyAccepted(state.lastPostError)) {
    clearPendingAttachments();
    void refreshState();
  } else {
    removeOptimisticMessage(optimisticId);
    els.interjectInput.value = sentDraft;
    resizeInterjectInput();
  }
}

function isSubmitLikelyAlreadyAccepted(error) {
  return isRequestTimeoutError(error);
}

function isRequestTimeoutError(error) {
  return /request took too long/i.test(String(error?.message || ""));
}

async function fetchJson(url, options = {}, { timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Request took too long. Buttons remain usable.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data;
}

function render(data) {
  const topicChanged = state.topicId !== (data.id || "");
  state.topicId = data.id || "";
  state.currentTopicTitle = data.topic || "";
  state.latestTopics = data.topics || [];
  state.fixedRooms = data.fixedRooms || {};
  state.directChats = data.directChats || {};
  state.sidebarProjects = data.sidebarProjects || [];
  state.hiddenTopicIds = Array.isArray(data.hiddenTopicIds) ? data.hiddenTopicIds : [];
  state.summaryPending = Boolean(data.running && /summarizing/.test(data.status || ""));
  state.runtimeStatus = data.runtimeStatus || null;
  els.statusText.textContent = formatStatus(data);
  els.roundText.textContent = String(data.round || 0);
  els.errorBox.hidden = !data.lastError;
  els.errorBox.textContent = data.lastError || "";
  if (data.topic && (topicChanged || !els.topicInput.value.trim())) {
    els.topicInput.value = data.topic;
  }
  els.currentTopicText.textContent = data.topic ? topicDisplayName(data.topic) : "No active topic";
  if (els.roomTitleText) {
    els.roomTitleText.textContent = data.topic ? topicDisplayName(data.topic) : "主厅";
  }
  if (els.roomMetaText) {
    els.roomMetaText.textContent = data.id ? `${topicKindLabel(data.topic)} · 本地记录` : "本地记录 · 当前圆桌";
  }
  if (els.topicRenameInput && (topicChanged || !els.topicRenameInput.value.trim())) {
    els.topicRenameInput.value = data.topic ? topicDisplayName(data.topic) : "";
  }
  if (topicChanged) resetRenderedMessages();
  state.serverMessages = data.messages || [];
  reconcileOptimisticMessages(state.serverMessages);
  renderMessages(messagesWithOptimisticState(state.serverMessages));
  renderRuntimeStatus(data.runtimeStatus || null);
  renderApprovals(data.pendingApprovals || []);
  if (data.runtimeStatus?.busy && isWorklogActive()) {
    refreshWorklog();
  }
  renderTopics(data.topics || []);
  renderSideTopics(data);
  syncLocalHiddenTopicsToServer();
  renderTopicsDrawer();
  renderSummaryButton();
  renderFixedRoomIconPicker();
  renderRenameButtonState();
  renderDeleteButtonState();
}

let hiddenTopicSyncSig = "";

function syncLocalHiddenTopicsToServer() {
  const localIds = readLocalHiddenTopicIds();
  if (!localIds.size) return;
  const serverIds = new Set(Array.isArray(state.hiddenTopicIds) ? state.hiddenTopicIds : []);
  const missing = [...localIds].filter((id) => !serverIds.has(id));
  const sig = missing.sort().join("|");
  if (!sig || sig === hiddenTopicSyncSig) return;
  hiddenTopicSyncSig = sig;
  postJson("/api/topic/archive-sidebar/bulk", { ids: missing }, { timeoutMs: 12000 });
}

function renderRenameButtonState() {
  if (!els.renameTopicButton) return;
  const slot = findActiveCustomizableFixedRoom();
  const project = findActiveProject();
  const builtin = isActiveBuiltinFixedRoom();
  const allow = Boolean(state.topicId) && !builtin;
  els.renameTopicButton.disabled = !allow;
  if (slot) {
    els.renameTopicButton.title = "改名（固定房间）";
  } else if (project) {
    els.renameTopicButton.title = "改名（项目）";
  } else if (builtin) {
    els.renameTopicButton.title = "内置房间不支持改名";
  } else {
    els.renameTopicButton.title = "改名";
  }
}

function renderDeleteButtonState() {
  if (!els.deleteCurrentTopicButton) return;
  const fixed = isActiveFixedRoom();
  const direct = isActiveDirectChat();
  const allow = Boolean(state.topicId) && !fixed && !direct;
  els.deleteCurrentTopicButton.hidden = !allow;
  els.deleteCurrentTopicButton.disabled = !allow;
  if (fixed) {
    els.deleteCurrentTopicButton.title = "固定房间不能删除";
  } else if (direct) {
    els.deleteCurrentTopicButton.title = "单聊不能删除";
  } else {
    els.deleteCurrentTopicButton.title = "彻底删除当前话题";
  }
}

function renderFixedRoomIconPicker() {
  if (!els.fixedRoomIconPicker || !els.fixedRoomIconOptions) return;
  const slot = findActiveCustomizableFixedRoom();
  if (!slot) {
    els.fixedRoomIconPicker.hidden = true;
    return;
  }
  els.fixedRoomIconPicker.hidden = false;
  const currentIcon = slot.room.icon || "";
  const sig = `${slot.id}|${currentIcon}`;
  if (els.fixedRoomIconOptions.dataset.sig === sig) return;
  els.fixedRoomIconOptions.dataset.sig = sig;
  els.fixedRoomIconOptions.replaceChildren(...ICON_POOL.map((symbol) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fixed-room-icon-option";
    if (symbol === currentIcon) btn.classList.add("active");
    btn.textContent = symbol;
    btn.title = `换为 ${symbol}`;
    btn.addEventListener("click", async () => {
      await postJson("/api/fixed-room/update", { roomId: slot.id, icon: symbol }, { timeoutMs: 12000 });
    });
    return btn;
  }));
}

function renderApprovals(approvals) {
  if (!els.approvalPanel) {
    return;
  }
  const pending = approvals.filter((approval) => approval?.speaker && approval?.requestId);
  els.approvalPanel.hidden = pending.length === 0;
  if (!pending.length) {
    els.approvalPanel.replaceChildren();
    return;
  }
  els.approvalPanel.replaceChildren(...pending.map(renderApprovalCard));
}

function renderRuntimeStatus(runtimeStatus) {
  if (!els.runtimeStatusPanel) {
    return;
  }
  updateComposerForRuntime(runtimeStatus);
  const activeRuns = Array.isArray(runtimeStatus?.activeRuns) ? runtimeStatus.activeRuns : [];

  if (!runtimeStatus?.busy && !activeRuns.length) {
    els.runtimeStatusPanel.hidden = true;
    els.runtimeStatusPanel.replaceChildren();
    return;
  }

  els.runtimeStatusPanel.hidden = false;

  if (activeRuns.length) {
    const runs = document.createElement("div");
    runs.className = "runtime-runs";
    for (const run of activeRuns) {
      runs.append(renderRuntimeChip(run));
    }
    els.runtimeStatusPanel.replaceChildren(runs);
  } else if (runtimeStatus?.busy) {
    const head = document.createElement("div");
    head.className = "runtime-status-head";
    const title = document.createElement("span");
    title.textContent = "准备中…";
    head.append(title);
    els.runtimeStatusPanel.replaceChildren(head);
  }
}

function renderRuntimeChip(run) {
  const chip = document.createElement("span");
  const speaker = run.speaker || "";
  chip.className = `runtime-chip ${speaker} ${run.status || ""}`.trim();

  const dot = document.createElement("span");
  dot.className = "runtime-dot";
  const label = document.createElement("span");
  const elapsed = formatElapsed(run.since);
  label.textContent = [
    run.label || "System",
    runtimeStatusLabel(run.status),
    runtimePhaseLabel(run.phase),
    run.detail || "",
    elapsed,
  ].filter(Boolean).join(" · ");
  chip.append(dot, label);

  const canInterrupt = (speaker === "codex" || speaker === "claude")
    && ["running", "waiting_approval", "checking_in"].includes(run.status);
  if (canInterrupt) {
    const interruptBtn = document.createElement("button");
    interruptBtn.type = "button";
    interruptBtn.className = "runtime-chip-interrupt";
    interruptBtn.textContent = "中断";
    interruptBtn.title = `仅中断 ${run.label || speaker}`;
    interruptBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      interruptBtn.disabled = true;
      try {
        await postJson("/api/interrupt-speaker", { speaker });
      } catch (error) {
        console.error("interrupt-speaker failed", error);
        interruptBtn.disabled = false;
      }
    });
    chip.append(interruptBtn);
  }

  return chip;
}

function updateComposerForRuntime(runtimeStatus) {
  const busy = Boolean(runtimeStatus?.busy);
  if (els.interjectInput) {
    els.interjectInput.placeholder = busy
      ? "发送补充信息，不会中断正在干活的 AI…"
      : "Send a message to the round…";
  }
  if (els.sendButton) {
    els.sendButton.title = busy ? "Send as a supplement" : "Send";
    els.sendButton.setAttribute("aria-label", busy ? "Send supplement" : "Send");
  }
  if (els.interruptSendButton) {
    els.interruptSendButton.hidden = !busy;
    els.interruptSendButton.title = "Interrupt active work and send this message";
  }
}

function runtimeStatusLabel(value) {
  if (value === "waiting_approval") return "等审批";
  if (value === "checking_in") return "巡房";
  if (value === "running") return "工作中";
  if (value === "completed") return "已完成";
  if (value === "failed") return "失败";
  if (value === "interrupted") return "已中断";
  return value || "";
}

function runtimePhaseLabel(value) {
  if (value === "queued") return "排队";
  if (value === "started") return "启动";
  if (value === "replying") return "回复中";
  if (value === "reply_ready") return "回复就绪";
  if (value === "waiting_approval") return "待审批";
  if (value === "resumed") return "继续";
  if (value === "context_updated") return "上下文更新";
  if (value === "turn_completed") return "回合完成";
  if (value === "completed") return "完成";
  if (value === "failed") return "失败";
  if (value === "interrupted") return "中断";
  return value || "";
}

function formatElapsed(isoText) {
  if (!isoText) return "";
  const started = Date.parse(isoText);
  if (!Number.isFinite(started)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - started) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remain}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function renderApprovalCard(approval) {
  const card = document.createElement("article");
  card.className = "approval-card";

  const head = document.createElement("div");
  head.className = "approval-head";

  const title = document.createElement("div");
  title.className = "approval-title";
  title.textContent = `${speakerName({ speaker: approval.speaker })} needs approval`;

  const badge = document.createElement("span");
  badge.className = hasApprovalCommandTokens(approval) ? "approval-badge" : "approval-badge warning";
  badge.textContent = hasApprovalCommandTokens(approval) ? "manual" : "unknown command";

  head.append(title, badge);

  const detail = document.createElement("pre");
  detail.className = "approval-detail";
  detail.textContent = formatApprovalDetail(approval);

  const actions = document.createElement("div");
  actions.className = "approval-actions";

  const allowButton = document.createElement("button");
  allowButton.type = "button";
  allowButton.className = "approval-allow";
  allowButton.textContent = "Allow once";
  allowButton.addEventListener("click", async () => {
    await submitApproval(approval, "accept");
  });

  const denyButton = document.createElement("button");
  denyButton.type = "button";
  denyButton.className = "approval-deny";
  denyButton.textContent = "Deny";
  denyButton.addEventListener("click", async () => {
    await submitApproval(approval, "decline");
  });

  actions.append(allowButton, denyButton);
  card.append(head, detail, actions);
  return card;
}

async function submitApproval(approval, decision) {
  await postJson("/api/approval", {
    speaker: approval.speaker,
    requestId: approval.requestId,
    decision,
  }, { timeoutMs: 12000 });
}

function hasApprovalCommandTokens(approval) {
  return Array.isArray(approval?.commandTokens) && approval.commandTokens.length > 0;
}

function formatApprovalDetail(approval) {
  const lines = [];
  if (approval.reason) {
    lines.push(`Reason: ${approval.reason}`);
  }
  if (approval.command) {
    lines.push(approval.command);
  }
  if (Array.isArray(approval.filePaths) && approval.filePaths.length) {
    lines.push(`Files: ${approval.filePaths.join(", ")}`);
  } else if (approval.filePath) {
    lines.push(`File: ${approval.filePath}`);
  }
  if (hasApprovalCommandTokens(approval)) {
    lines.push(`Tokens: ${approval.commandTokens.join(" ")}`);
  } else {
    lines.push("Tokens: none supplied by runtime");
  }
  return lines.join("\n").trim();
}

let lastTopicsSignature = "";

async function deleteTopicPermanently(topicId, title = "") {
  if (!topicId) return;
  const label = title ? `「${topicDisplayName(title)}」` : "这个话题";
  const ok = window.confirm(`彻底删除 ${label} 的聊天记录、事件、审批和总结？这个操作不能恢复。`);
  if (!ok) return;
  await postJson("/api/topic/delete", { id: topicId }, { timeoutMs: 12000 });
  const hiddenTopics = getHiddenTopicIds();
  hiddenTopics.delete(topicId);
  saveHiddenTopicIds(hiddenTopics);
  lastTopicsSignature = "";
  setTopicsOpen(false);
  refreshState();
  refreshSummaries();
}

function renderTopics(topics) {
  const hiddenTopicIds = getHiddenTopicIds();
  const hiddenProjectIds = getHiddenProjectIds();
  const archivedProjects = (state.sidebarProjects || []).filter((p) => hiddenProjectIds.has(p.id));
  const signature = [
    topics.map((t) => `${t.id}:${t.topic || ""}:${t.round || 0}:${t.messageCount || 0}:${hiddenTopicIds.has(t.id) ? "H" : ""}`).join("\n"),
    "PROJ:" + archivedProjects.map((p) => `${p.id}:${p.title}:${p.icon}`).join("|"),
  ].join("\n");
  if (signature === lastTopicsSignature && els.topicsList.children.length > 0) {
    return;
  }
  lastTopicsSignature = signature;
  if (!topics.length && !archivedProjects.length) {
    els.topicsList.replaceChildren(emptyTopicsNode());
    return;
  }
  const projectTopicIds = new Set(
    (state.sidebarProjects || []).map((p) => p.topicId).filter(Boolean)
  );
  const fixed = topics.filter((topic) => topicKind(topic.topic) === "fixed" && !projectTopicIds.has(topic.id));
  const tempAll = topics.filter((topic) => topicKind(topic.topic) === "temporary");
  const tempVisible = tempAll.filter((topic) => !hiddenTopicIds.has(topic.id));
  const tempArchived = tempAll.filter((topic) => hiddenTopicIds.has(topic.id));
  const direct = topics.filter((topic) => topicKind(topic.topic) === "direct");
  const other = topics.filter((topic) => {
    const kind = topicKind(topic.topic);
    return !["fixed", "temporary", "direct"].includes(kind);
  });
  const nodes = [];
  appendTopicGroup(nodes, "固定房间", fixed);
  appendTopicGroup(nodes, "临时草稿", tempVisible);
  appendTopicGroup(nodes, "单聊记录", direct, renderDirectTopicButton);
  appendTopicGroup(nodes, "其他记录", other);
  appendArchivedGroup(nodes, tempArchived, archivedProjects);
  els.topicsList.replaceChildren(...nodes);
}

function appendArchivedGroup(nodes, archivedTopics, archivedProjects) {
  if (!archivedTopics.length && !archivedProjects.length) return;
  const head = document.createElement("div");
  head.className = "topic-group-label";
  head.textContent = `已归档（${archivedTopics.length + archivedProjects.length}）`;
  nodes.push(head);
  for (const topic of archivedTopics) {
    nodes.push(renderArchivedTopicRow(topic));
  }
  for (const project of archivedProjects) {
    nodes.push(renderArchivedProjectRow(project));
  }
}

function renderArchivedTopicRow(topic) {
  const item = document.createElement("article");
  item.className = "topic-item rich archived";
  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "topic-open-button";
  const title = document.createElement("span");
  title.className = "topic-title";
  title.textContent = topicDisplayName(topic.topic || "(untitled)");
  const meta = document.createElement("span");
  meta.className = "topic-meta";
  meta.textContent = `临时归档 · ${topic.messageCount || 0} msgs`;
  openButton.append(title, meta);
  openButton.addEventListener("click", async () => {
    await postJson("/api/open-topic", { id: topic.id }, { force: true });
    setTopicsOpen(false);
  });
  const actions = document.createElement("div");
  actions.className = "topic-row-actions";
  const restoreBtn = document.createElement("button");
  restoreBtn.type = "button";
  restoreBtn.textContent = "恢复";
  restoreBtn.addEventListener("click", async (event) => {
    event.stopPropagation();
    const hidden = getHiddenTopicIds();
    hidden.delete(topic.id);
    saveHiddenTopicIds(hidden);
    await postJson("/api/topic/restore-sidebar", { id: topic.id }, { timeoutMs: 12000 });
    lastTopicsSignature = "";
    refreshState();
  });
  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.textContent = "删除";
  deleteBtn.addEventListener("click", async (event) => {
    event.stopPropagation();
    await deleteTopicPermanently(topic.id, topic.topic || "");
  });
  actions.append(restoreBtn, deleteBtn);
  item.append(openButton, actions);
  return item;
}

function renderArchivedProjectRow(project) {
  const item = document.createElement("article");
  item.className = "topic-item rich archived";
  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "topic-open-button";
  const title = document.createElement("span");
  title.className = "topic-title";
  title.textContent = `${project.icon || "□"} ${project.title || "未命名项目"}`;
  const meta = document.createElement("span");
  meta.className = "topic-meta";
  meta.textContent = "项目归档";
  openButton.append(title, meta);
  openButton.addEventListener("click", async () => {
    await postJson("/api/open-project", { id: project.id }, { timeoutMs: 12000 });
    setTopicsOpen(false);
  });
  const actions = document.createElement("div");
  actions.className = "topic-row-actions";
  const restoreBtn = document.createElement("button");
  restoreBtn.type = "button";
  restoreBtn.textContent = "恢复";
  restoreBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const hidden = getHiddenProjectIds();
    hidden.delete(project.id);
    saveHiddenProjectIds(hidden);
    lastTopicsSignature = "";
    refreshState();
  });
  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.textContent = "删除";
  deleteBtn.addEventListener("click", async (event) => {
    event.stopPropagation();
    await deleteTopicPermanently(project.topicId, project.topicTitle || project.title || "");
    const hidden = getHiddenProjectIds();
    hidden.delete(project.id);
    saveHiddenProjectIds(hidden);
    lastTopicsSignature = "";
  });
  actions.append(restoreBtn, deleteBtn);
  item.append(openButton, actions);
  return item;
}

function appendTopicGroup(nodes, label, topics, renderItem = renderTopicButton) {
  if (!topics.length) return;
  const head = document.createElement("div");
  head.className = "topic-group-label";
  head.textContent = label;
  nodes.push(head, ...topics.map(renderItem));
}

function emptyTopicsNode() {
  const div = document.createElement("div");
  div.className = "topic-empty";
  div.textContent = "No archived topics";
  return div;
}

function renderTopicButton(topic) {
  const item = document.createElement("article");
  item.className = "topic-item rich";

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "topic-open-button";

  const title = document.createElement("span");
  title.className = "topic-title";
  title.textContent = topicDisplayName(topic.topic || "(untitled)");

  const meta = document.createElement("span");
  meta.className = "topic-meta";
  meta.textContent = `${topicKindLabel(topic.topic)} · ${topic.messageCount || 0} msgs`;

  openButton.append(title, meta);
  openButton.addEventListener("click", async () => {
    await postJson("/api/open-topic", { id: topic.id }, { force: true });
    setTopicsOpen(false);
  });

  const kind = topicKind(topic.topic);

  // Fixed rooms: no action buttons — can only rename (handled in panel header)
  if (kind === "fixed") {
    item.append(openButton);
    return item;
  }

  // Temporary/other rooms: delete only (收/归档 is the sidebar button)
  const actions = document.createElement("div");
  actions.className = "topic-row-actions";

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.textContent = "删除";
  deleteBtn.addEventListener("click", async (event) => {
    event.stopPropagation();
    await deleteTopicPermanently(topic.id, topic.topic || "");
  });

  actions.append(deleteBtn);
  item.append(openButton, actions);
  return item;
}

function renderDirectTopicButton(topic) {
  const item = document.createElement("article");
  item.className = "topic-item rich";

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "topic-open-button";

  const title = document.createElement("span");
  title.className = "topic-title";
  title.textContent = topicDisplayName(topic.topic || "(untitled)");

  const meta = document.createElement("span");
  meta.className = "topic-meta";
  meta.textContent = `单聊记录 · ${topic.messageCount || 0} msgs`;

  openButton.append(title, meta);
  openButton.addEventListener("click", async () => {
    await postJson("/api/open-topic", { id: topic.id }, { force: true });
    setTopicsOpen(false);
  });

  item.append(openButton);
  return item;
}

function setTopicsOpen(open, mode = state.topicDrawerMode || "topics") {
  state.topicsOpen = Boolean(open);
  if (state.topicsOpen) {
    state.topicDrawerMode = mode === "create" ? "create" : "topics";
  }
  renderTopicsDrawer();
}

function renderTopicsDrawer() {
  els.topicsDrawer.classList.toggle("open", state.topicsOpen);
  els.topicsDrawer.classList.toggle("mode-create", state.topicDrawerMode === "create");
  els.topicsDrawer.classList.toggle("mode-topics", state.topicDrawerMode !== "create");
  els.topicsDrawer.setAttribute("aria-hidden", state.topicsOpen ? "false" : "true");
  els.topicsToggleButton.setAttribute("aria-expanded", state.topicsOpen ? "true" : "false");
  const title = els.topicsDrawer.querySelector(".topic-panel-head h2");
  if (title) title.textContent = state.topicDrawerMode === "create" ? "新聊天" : "话题";
}

// Keyed cache so existing messages are updated in-place, never re-animated
const renderedMsgMap = new Map(); // key → { element }

// Clear all rendered messages/day-dividers (e.g. on topic switch) so the
// append-only renderer rebuilds from a clean slate instead of reusing stale
// elements that would otherwise keep their old DOM position.
function resetRenderedMessages() {
  for (const { element } of renderedMsgMap.values()) {
    element.remove();
  }
  renderedMsgMap.clear();
  state.lastMessageSig = "";
  state.lastMessageCount = 0;
}

function addOptimisticUserMessage({ text = "", attachments = [] } = {}) {
  const message = {
    id: `optimistic-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    speaker: "user",
    text,
    attachments,
    at: new Date().toISOString(),
    optimistic: true,
  };
  state.optimisticMessages.push(message);
  renderMessages(messagesWithOptimisticState(state.serverMessages || []));
  return message.id;
}

function removeOptimisticMessage(id) {
  if (!id) return;
  state.optimisticMessages = state.optimisticMessages.filter((message) => message.id !== id);
  renderMessages(messagesWithOptimisticState(state.serverMessages || []));
}

function reconcileOptimisticMessages(serverMessages = []) {
  if (!state.optimisticMessages.length) return;
  state.optimisticMessages = state.optimisticMessages.filter((optimistic) =>
    !serverMessages.some((message) => isServerMatchForOptimistic(message, optimistic))
  );
}

function messagesWithOptimisticState(serverMessages = []) {
  if (!state.optimisticMessages.length) return serverMessages;
  return [...serverMessages, ...state.optimisticMessages];
}

function isServerMatchForOptimistic(message, optimistic) {
  if (!message || !optimistic || message.speaker !== "user") return false;
  if ((message.text || "") !== (optimistic.text || "")) return false;
  if (attachmentSig(message.attachments) !== attachmentSig(optimistic.attachments)) return false;
  const serverTime = Date.parse(message.at || "");
  const optimisticTime = Date.parse(optimistic.at || "");
  if (!Number.isFinite(serverTime) || !Number.isFinite(optimisticTime)) return true;
  return serverTime >= optimisticTime - 5000 && serverTime <= optimisticTime + 60000;
}

function messagesSig(messages) {
  return messages.map((m, index) =>
    `${msgKey(m, index)}|${m.speaker || ""}|${m.pending ? "1" : "0"}|${m.runtimeReplyReady ? "1" : "0"}|${m.optimistic ? "1" : "0"}|${m.voiceOnly ? "1" : "0"}|${m.audioUrl || ""}|${m.at || ""}|${(m.text || "").slice(-40)}|${attachmentSig(m.attachments)}|${worklogSig(m.runtimeWorklog)}`
  ).join("~");
}

function msgKey(message, index) {
  return message?.id ? String(message.id) : `${message?.at || ""}:${message?.speaker || ""}:idx-${index}`;
}

function renderMessages(messages) {
  const sig = messagesSig(messages);
  if (sig === state.lastMessageSig) return;
  const shouldScroll = messages.length !== state.lastMessageCount;
  state.lastMessageCount = messages.length;
  state.lastMessageSig = sig;

  const activeKeys = new Set();
  let prevDayKey = null;

  messages.filter(shouldRenderMessage).forEach((message, index) => {
    const dayKey = messageDayKey(message);
    if (dayKey && dayKey !== prevDayKey) {
      prevDayKey = dayKey;
      const dividerKey = `daydivider:${dayKey}`;
      activeKeys.add(dividerKey);
      if (!renderedMsgMap.has(dividerKey)) {
        const dividerEl = renderDayDivider(message);
        els.messages.appendChild(dividerEl);
        renderedMsgMap.set(dividerKey, { element: dividerEl, divider: true });
      }
    }

    const key = msgKey(message, index);
    activeKeys.add(key);

    if (renderedMsgMap.has(key)) {
      // Update existing element in-place — no re-animation
      const entry = renderedMsgMap.get(key);
      const { element } = entry;
      const textEl = element.querySelector(".text");
      const timeEl = element.querySelector("time");
      updateMessageContent(textEl, message, entry);
      updateMessageWorklog(element, message, entry);
      if (timeEl) {
        timeEl.textContent = formatMessageTimeLabel(message);
      }
    } else {
      // Brand-new message — create and append (animation fires once)
      const element = renderMessage(message);
      els.messages.appendChild(element);
      renderedMsgMap.set(key, {
        element,
        text: message.text || "",
        attachments: attachmentSig(message.attachments),
        audioUrl: message.audioUrl || "",
        voiceOnly: Boolean(message.voiceOnly),
        pending: Boolean(message.pending),
        worklog: worklogSig(message.runtimeWorklog),
      });
    }
  });

  // Remove messages that disappeared
  for (const [key, { element }] of renderedMsgMap) {
    if (!activeKeys.has(key)) {
      element.remove();
      renderedMsgMap.delete(key);
    }
  }

  if (shouldScroll) {
    requestAnimationFrame(() => {
      els.messages.scrollTop = els.messages.scrollHeight;
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    });
  }
}

function shouldRenderMessage(message) {
  if (!message || message.injectionTarget) {
    return false;
  }
  if (message.speaker === "system" && message.transcript === false) {
    return !isSummaryInjectionNotice(message.text);
  }
  return true;
}

function isSummaryInjectionNotice(text = "") {
  return /^Saved (?:summary|current-topic summaries)\b/.test(String(text || "").trim());
}

function renderMessage(message) {
  const article = document.createElement("article");
  article.className = `message ${message.speaker || "user"}`;
  if (message.id) article.id = message.id;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = initials(message.speaker);

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const head = document.createElement("div");
  head.className = "summary-card-head";

  const meta = document.createElement("div");
  meta.className = "meta";

  const name = document.createElement("span");
  name.className = "name";
  name.textContent = speakerName(message);

  const time = document.createElement("time");
  time.textContent = formatMessageTimeLabel(message);

  const actions = renderMessageActions(message);

  const text = document.createElement("div");
  text.className = "text";
  renderMessageContent(text, message);

  const worklog = renderMessageWorklog(message.runtimeWorklog);
  meta.append(name);
  if (worklog) meta.append(worklog);
  meta.append(time, actions);
  bubble.append(meta, text);
  article.append(avatar, bubble);
  return article;
}

function renderMessageActions(message) {
  const wrap = document.createElement("div");
  wrap.className = "message-actions";

  const menuButton = document.createElement("button");
  menuButton.type = "button";
  menuButton.className = "message-menu-button";
  menuButton.title = "更多";
  menuButton.setAttribute("aria-label", "更多");
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.textContent = "...";
  menuButton.disabled = !message.id;

  const menu = document.createElement("div");
  menu.className = "message-menu";
  menu.hidden = true;

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "message-menu-delete";
  deleteButton.textContent = "删除";
  deleteButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    closeAllMessageMenus();
    await deleteMessage(message.id);
  });

  menuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const nextOpen = menu.hidden;
    closeAllMessageMenus();
    menu.hidden = !nextOpen;
    menuButton.setAttribute("aria-expanded", nextOpen ? "true" : "false");
  });

  menu.append(deleteButton);
  wrap.append(menuButton, menu);
  return wrap;
}

function formatMessageTimeLabel(message = {}) {
  if (message.optimistic) return "sending";
  if (message.runtimeReplyReady) return "finalizing";
  if (message.pending) return "generating";
  return formatTime(message.at);
}

function worklogSig(worklog = null) {
  if (!worklog) return "";
  const run = worklog.run || {};
  const events = Array.isArray(worklog.events) ? worklog.events : [];
  return [
    run.id || "",
    run.status || "",
    run.phase || "",
    run.detail || "",
    worklog.summary || "",
    events.map((event) => `${event.id || ""}:${event.type || ""}:${event.title || ""}`).join(","),
  ].join("|");
}

function updateMessageWorklog(element, message, entry) {
  const nextSig = worklogSig(message.runtimeWorklog);
  if (nextSig === entry.worklog) return;
  const existing = element.querySelector(".message-worklog");
  const next = renderMessageWorklog(message.runtimeWorklog);
  if (existing && next) {
    existing.replaceWith(next);
  } else if (existing) {
    existing.remove();
  } else if (next) {
    const meta = element.querySelector(".meta");
    const timeEl = meta?.querySelector("time");
    if (meta && timeEl) {
      meta.insertBefore(next, timeEl);
    } else if (meta) {
      meta.append(next);
    }
  }
  entry.worklog = nextSig;
}

function isActiveRunStatus(status) {
  return ["running", "waiting_approval", "checking_in", "queued"].includes(status);
}

function renderMessageWorklog(worklog = null) {
  if (!worklog?.run) return null;
  const events = Array.isArray(worklog.events) ? worklog.events : [];
  if (!events.length && !worklog.summary) return null;
  const active = isActiveRunStatus(worklog.run.status);
  const wrap = document.createElement("details");
  wrap.className = `message-worklog ${active ? "active" : "done"}`;

  const summary = document.createElement("summary");
  summary.className = "message-worklog-summary";

  const status = document.createElement("span");
  status.className = "message-worklog-status";
  status.textContent = active ? formatWorklogStatusHuman(worklog) : `${events.length}步`;

  summary.append(status);
  wrap.append(summary);

  if (events.length) {
    const list = document.createElement("ol");
    list.className = "message-worklog-events";
    for (const event of events.slice(-6)) {
      list.append(renderWorklogEventHuman(event));
    }
    wrap.append(list);
  }
  return wrap;
}

function renderWorklogEventHuman(event = {}) {
  const item = document.createElement("li");
  const isThinking = event.type === "thinking.updated" && Boolean((event.detail?.text || "").trim());
  item.className = `message-worklog-event ${event.level || "info"}${isThinking ? " thinking" : ""}`;
  item.textContent = humanizeWorklogEvent(event);
  return item;
}

function formatWorklogStatusHuman(worklog = {}) {
  const run = worklog.run || {};
  const status = run.status || "";
  if (status === "waiting_approval") return "等待授权…";
  if (status === "checking_in") return "巡房中…";
  const phase = run.phase || "";
  if (phase === "queued") return "排队中…";
  if (phase === "started") return "启动中…";
  if (phase === "replying") return "正在回复…";
  if (phase === "context_updated") return "读取上下文…";
  if (phase === "waiting_approval") return "等待授权…";
  return run.detail || "处理中…";
}

function humanizeWorklogEvent(event = {}) {
  const type = event.type || "";
  const title = event.title || "";
  const time = event.createdAt ? new Date(event.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
  const prefix = time ? `${time} ` : "";
  const detail = event.detail || {};
  if (type === "input.captured") return `${prefix}记录本轮发给 AI 的完整上下文`;
  if (type === "thinking.updated") {
    const thought = (detail.text || "").trim();
    return thought ? `${prefix}💭 ${thought}` : `${prefix}记录 Claude 思路`;
  }
  if (type === "terminal.stderr") return `${prefix}终端 stderr：${firstLine(detail.text) || "有输出"}`;
  if (type === "tool.started") return `${prefix}调用工具：${detail.name || title || "tool"}`;
  if (type === "tool.finished") return `${prefix}${detail.status === "error" ? "工具报错" : "工具返回"}${detail.name ? `：${detail.name}` : ""}`;
  if (type.includes("queued") || title.includes("Queued")) return `${prefix}已排队`;
  if (type.includes("started") || title.includes("started")) return `${prefix}开始处理`;
  if (type.includes("context") || title.includes("Context")) return `${prefix}上下文当前占用${formatContextTokens(detail)}`;
  if (type.includes("approval.requested") || title.includes("approval")) return `${prefix}请求授权${detail.command ? `：${firstLine(detail.command)}` : ""}`;
  if (type.includes("approval.responded") || type.includes("approval.resolved")) return `${prefix}授权已回应`;
  if (type.includes("replying") || title.includes("Replying")) return `${prefix}正在生成回复`;
  if (type.includes("reply_ready") || title.includes("Reply")) return `${prefix}回复就绪`;
  if (type.includes("completed") || title.includes("Completed")) return `${prefix}完成`;
  if (type.includes("failed") || title.includes("Failed")) return `${prefix}运行失败${detail.error ? `：${firstLine(detail.error)}` : ""}`;
  if (type.includes("interrupted")) return `${prefix}已中断`;
  if (type.includes("resumed")) return `${prefix}继续运行`;
  return `${prefix}${title || type || "运行中"}`;
}

function firstLine(value = "") {
  return String(value || "").split(/\r?\n/u).map((line) => line.trim()).find(Boolean) || "";
}

function formatTokenCount(value) {
  const n = Number(value) || 0;
  if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatContextTokens(detail = {}) {
  const current = Number(detail.currentTokens) || 0;
  if (!current) return "";
  const reused = Number(detail.reusedTokens) || 0;
  // Only surface cache reuse when it is a meaningful share of the window;
  // the first step writes the cache (reused≈0) and would otherwise look identical.
  const reusedNote = reused >= current * 0.2 ? `，复用缓存 ${formatTokenCount(reused)}` : "";
  return `（${formatTokenCount(current)} tokens${reusedNote}）`;
}

function closeAllMessageMenus() {
  for (const menu of document.querySelectorAll(".message-menu")) {
    menu.hidden = true;
  }
  for (const button of document.querySelectorAll(".message-menu-button")) {
    button.setAttribute("aria-expanded", "false");
  }
}

async function deleteMessage(messageId) {
  if (!messageId) return;
  if (!window.confirm("删除这条消息？")) return;
  await postJson("/api/message/delete", { id: messageId }, { timeoutMs: 12000 });
}

document.addEventListener("click", closeAllMessageMenus);

function attachmentSig(attachments) {
  return (Array.isArray(attachments) ? attachments : [])
    .map((attachment) => `${attachment.url || ""}:${attachment.size || 0}`)
    .join(",");
}

function renderMessageContent(container, message) {
  if (!container) return;
  container.className = "text";
  container.replaceChildren();
  if (message.pending && !message.text) {
    container.classList.add("pending-text");
    container.textContent = "Generating...";
    return;
  }
  if (message.voiceOnly) {
    if (message.audioUrl) {
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = message.audioUrl;
      audio.className = "tts-audio";
      container.append(audio);
    } else {
      const generating = document.createElement("span");
      generating.className = "tts-generating";
      generating.textContent = "生成语音中…";
      container.append(generating);
    }
    if (message.text) {
      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "tts-transcript-toggle";
      toggleBtn.textContent = "转写";
      const transcript = document.createElement("div");
      transcript.className = "tts-transcript";
      transcript.hidden = true;
      transcript.textContent = message.text;
      toggleBtn.addEventListener("click", () => {
        transcript.hidden = !transcript.hidden;
        toggleBtn.textContent = transcript.hidden ? "转写" : "收起";
      });
      container.append(toggleBtn, transcript);
    }
    return;
  }
  if (message.text) {
    container.append(document.createTextNode(message.text));
  }
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  if (attachments.length) {
    container.append(renderAttachmentList(attachments));
  }
}

function updateMessageContent(container, message, entry) {
  const nextText = message.text || "";
  const nextAttachments = attachmentSig(message.attachments);
  const nextAudioUrl = message.audioUrl || "";
  const canAppendPlainText = !message.pending
    && !entry.pending
    && !nextAttachments
    && !entry.attachments
    && !message.voiceOnly
    && nextText.startsWith(entry.text);
  if (canAppendPlainText && nextText.length > entry.text.length) {
    container.append(document.createTextNode(nextText.slice(entry.text.length)));
  } else if (
    nextText !== entry.text
    || nextAttachments !== entry.attachments
    || Boolean(message.pending) !== entry.pending
    || Boolean(message.voiceOnly) !== Boolean(entry.voiceOnly)
    || nextAudioUrl !== (entry.audioUrl || "")
  ) {
    renderMessageContent(container, message);
  }
  entry.text = nextText;
  entry.attachments = nextAttachments;
  entry.audioUrl = nextAudioUrl;
  entry.voiceOnly = Boolean(message.voiceOnly);
  entry.pending = Boolean(message.pending);
}

function renderAttachmentList(attachments) {
  const wrap = document.createElement("div");
  wrap.className = "message-attachments";
  for (const attachment of attachments) {
    const mimeType = attachment.mimeType || "";
    const url = attachment.url || "";
    if (!url) continue;
    if (mimeType.startsWith("image/")) {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.className = "message-attachment-image";

      const image = document.createElement("img");
      image.src = url;
      image.alt = attachment.name || "Attached image";
      image.loading = "lazy";
      link.append(image);
      wrap.append(link);
      continue;
    }

    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.className = "message-attachment-file";

    const name = document.createElement("strong");
    name.textContent = attachment.name || "Attachment";
    const meta = document.createElement("small");
    meta.textContent = [mimeType || "file", formatFileSize(attachment.size)].filter(Boolean).join(" · ");
    link.append(name, meta);
    wrap.append(link);
  }
  return wrap;
}

async function uploadAttachment(file) {
  if (!file) return;
  const pending = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    uploading: true,
    attachment: null,
  };
  pendingAttachments.push(pending);
  renderPendingAttachments();
  try {
    const data = await fileToBase64(file);
    const attachment = await fetchJson("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data,
        mimeType: file.type || "application/octet-stream",
        name: file.name,
      }),
    }, { timeoutMs: 30000 });
    if (!attachment) {
      removePendingAttachment(pending.id);
      return;
    }
    pending.uploading = false;
    pending.attachment = attachment;
    renderPendingAttachments();
  } catch (error) {
    removePendingAttachment(pending.id);
    showError(error.message);
  }
}

function renderPendingAttachments() {
  if (!els.attachmentTray) return;
  if (!pendingAttachments.length) {
    els.attachmentTray.hidden = true;
    els.attachmentTray.replaceChildren();
    return;
  }
  const nodes = pendingAttachments.map((item) => {
    const chip = document.createElement("div");
    chip.className = "attachment-chip";
    if (item.uploading) chip.classList.add("uploading");

    const label = document.createElement("span");
    label.textContent = item.attachment?.name || item.file?.name || "Uploading...";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.setAttribute("aria-label", "Remove attachment");
    remove.title = "Remove attachment";
    remove.textContent = "×";
    remove.addEventListener("click", () => removePendingAttachment(item.id));

    chip.append(label, remove);
    return chip;
  });
  els.attachmentTray.hidden = false;
  els.attachmentTray.replaceChildren(...nodes);
}

function resizeInterjectInput() {
  if (!els.interjectInput) return;
  els.interjectInput.style.height = "auto";
  els.interjectInput.style.height = `${Math.min(els.interjectInput.scrollHeight, 160)}px`;
  if (els.interjectForm) {
    document.documentElement.style.setProperty("--mobile-composer-height", `${els.interjectForm.offsetHeight}px`);
  }
}

function scrollToMessage(id, attempts) {
  if (!id) return;
  const target = document.getElementById(id);
  if (target) {
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("message-focus");
      setTimeout(() => target.classList.remove("message-focus"), 1600);
    });
    return;
  }
  if ((attempts || 0) < 15) setTimeout(() => scrollToMessage(id, (attempts || 0) + 1), 150);
}

function searchTargetMessageId(item = {}) {
  const source = item.source || {};
  return item.matchMessage?.id
    || item.messageId
    || item.id
    || source.messageId
    || "";
}

function prefersMultilineEnter() {
  return Boolean(window.matchMedia?.("(pointer: coarse)")?.matches);
}

function clearPendingAttachments() {
  pendingAttachments.splice(0, pendingAttachments.length);
  renderPendingAttachments();
}

function removePendingAttachment(id) {
  const index = pendingAttachments.findIndex((item) => item.id === id);
  if (index >= 0) {
    pendingAttachments.splice(index, 1);
    renderPendingAttachments();
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name || "file"}`));
    reader.readAsDataURL(file);
  });
}

function formatFileSize(value) {
  const size = Number(value || 0);
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 102.4) / 10} KB`;
  return `${Math.round(size / 1024 / 102.4) / 10} MB`;
}

function renderTargetButtons() {
  for (const button of els.targetButtons) {
    button.classList.toggle("active", (button.dataset.target || "") === state.target);
  }
  const activeButton = els.targetButtons.find((b) => (b.dataset.target || "") === state.target);
  const label = activeButton ? activeButton.textContent.trim() : "Round";
  const dotClass = activeButton ? activeButton.querySelector(".target-dot")?.className.replace("target-dot ", "") : "dot-all";
  if (els.targetLabel) {
    els.targetLabel.textContent = label;
  }
  const dotEl = els.targetToggleBtn?.querySelector(".target-dot");
  if (dotEl) {
    dotEl.className = `target-dot ${dotClass}`;
  }
}

function showError(message) {
  els.errorBox.hidden = false;
  els.errorBox.textContent = message;
}

function isWorklogActive() {
  return document.querySelector('.view-panel[data-panel="worklog"]')?.classList.contains("active") || false;
}

function setActiveView(view) {
  const target = view || "chat";
  for (const button of document.querySelectorAll("[data-view]")) {
    button.classList.toggle("active", (button.dataset.view || "") === target);
  }
  for (const panel of document.querySelectorAll("[data-panel]")) {
    panel.classList.toggle("active", (panel.dataset.panel || "") === target);
  }
  if (target === "summaries") {
    refreshSummaries();
  }
  if (target === "notebook") {
    refreshStorage();
  }
  if (target === "notes") {
    refreshNotebook();
  }
  if (target === "worklog") {
    refreshWorklog();
  }
}

function scheduleSummaryRefresh() {
  refreshSummaries();
  for (const delay of [1500, 4000, 9000, 15000]) {
    setTimeout(refreshSummaries, delay);
  }
}

function renderSummaryButton() {
  if (!els.summaryButton) {
    return;
  }
  els.summaryButton.disabled = state.summaryPending;
  els.summaryButton.textContent = state.summaryPending ? "Summarizing..." : "Summary";
}

function formatStatus(data) {
  if (!data.id) {
    return "Start a topic";
  }
  if (data.status === "complete") {
    return "Round complete";
  }
  if (data.status === "waiting approval") {
    return "Waiting for approval";
  }
  if (data.running || /thinking|running|summarizing/.test(data.status || "")) {
    return data.status;
  }
  return "Ready";
}

function speakerName(message) {
  if (message.label) {
    return message.label;
  }
  switch (message.speaker) {
    case "codex":
      return "Codex";
    case "claude":
      return "Claude Code";
    case "deepseek":
      return "DeepSeek";
    case "gemini":
      return "Gemini";
    case "system":
      return "Summary";
    default:
      return "You";
  }
}

function initials(speaker) {
  switch (speaker) {
    case "codex":
      return "C";
    case "claude":
      return "CC";
    case "deepseek":
      return "DS";
    case "gemini":
      return "G";
    case "system":
      return "S";
    default:
      return "Y";
  }
}

function messageDayKey(message) {
  const date = new Date(message?.at || "");
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function formatDayLabel(message) {
  const date = new Date(message?.at || "");
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays === 2) return "前天";
  const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${weekday}`;
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function renderDayDivider(message) {
  const wrap = document.createElement("div");
  wrap.className = "day-divider";
  const label = document.createElement("span");
  label.textContent = formatDayLabel(message);
  wrap.append(label);
  return wrap;
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}


const FIXED_ROOM_ICONS = {
  main:       { icon: "⌂", color: "var(--codex)" },
  philosophy: { icon: "∞", color: "var(--deepseek)" },
  otherworld: { icon: "◇", color: "var(--claude)" },
  alone:      { icon: "◯", color: "var(--muted)" },
  slot1:      { icon: "◇", color: "var(--muted)" },
  slot2:      { icon: "◆", color: "var(--muted)" },
};
const ICON_POOL = ["◇", "◆", "□", "○", "☆", "♠", "♦", "♣", "♥", "◉"];
const HIDDEN_FIXED_ROOM_IDS = new Set(["codex", "code"]);
const HIDDEN_PROJECT_TITLES = new Set(["codex", "哲学场"]);

function reconcileList(container, items, getKey, getSignature, renderItem) {
  if (!container) return;
  const existing = new Map();
  // Scan once, remove any duplicate-keyed children up front
  for (const child of [...container.children]) {
    const key = child.dataset?.reconcileKey;
    if (key === undefined) continue;
    if (existing.has(key)) {
      child.remove();
    } else {
      existing.set(key, child);
    }
  }
  const next = [];
  for (const item of items) {
    const key = String(getKey(item));
    const signature = String(getSignature(item));
    const existingNode = existing.get(key);
    if (existingNode && existingNode.dataset.reconcileSig === signature) {
      existing.delete(key);
      next.push(existingNode);
    } else {
      const node = renderItem(item);
      node.dataset.reconcileKey = key;
      node.dataset.reconcileSig = signature;
      next.push(node);
      // Leave the old node in `existing` so the stale-cleanup loop removes it from the DOM.
    }
  }
  for (const stale of existing.values()) stale.remove();
  for (let i = 0; i < next.length; i++) {
    if (container.children[i] !== next[i]) {
      container.insertBefore(next[i], container.children[i] || null);
    }
  }
}

function renderFixedRooms(fixedRooms, activeId) {
  if (!els.fixedRoomsList) return;
  const entries = Object.entries(fixedRooms || {}).filter(([id]) => !HIDDEN_FIXED_ROOM_IDS.has(id));
  if (!entries.length) {
    if (els.fixedRoomsList.children.length) els.fixedRoomsList.replaceChildren();
    return;
  }
  reconcileList(
    els.fixedRoomsList,
    entries,
    ([id]) => id,
    ([id, room]) => `${room.title || ""}|${room.icon || ""}|${room.topicId || ""}|${room.topicId && room.topicId === activeId ? 1 : 0}`,
    ([id, room]) => renderFixedRoomButton(id, room, activeId),
  );
}

function renderFixedRoomButton(id, room, activeId) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "room-item fixed-room-item";
  if (room.topicId && room.topicId === activeId) btn.classList.add("active");

  const icon = document.createElement("span");
  icon.className = "room-index";
  const meta = FIXED_ROOM_ICONS[id] || { icon: "◇", color: "var(--muted)" };
  const stateIcon = room.icon && room.icon.trim();
  icon.textContent = stateIcon || meta.icon;
  icon.style.color = meta.color;
  icon.style.fontSize = "16px";

  const text = document.createElement("span");
  const strong = document.createElement("strong");
  strong.textContent = room.title || id;
  const small = document.createElement("small");
  small.textContent = room.topicId ? "固定 · 有记录" : "固定 · 空";
  text.append(strong, small);

  const dot = document.createElement("i");
  if (room.topicId && room.topicId === activeId) dot.style.background = meta.color;

  btn.append(icon, text, dot);
  btn.addEventListener("click", async () => {
    await postJson("/api/open-room", { roomId: id }, { timeoutMs: 12000 });
  });
  return btn;
}

function replaceSideTopicList(container, topics, activeId, emptyText) {
  if (!container) return;
  if (!topics.length) {
    if (container.children.length !== 1 || !container.firstElementChild?.classList?.contains("side-empty")) {
      const empty = document.createElement("div");
      empty.className = "side-empty";
      if (emptyText) empty.textContent = emptyText;
      container.replaceChildren(empty);
    }
    return;
  }
  reconcileList(
    container,
    topics,
    (t) => t.id,
    (t) => `${t.topic || ""}|${t.messageCount || 0}|${t.id === activeId ? 1 : 0}`,
    (t) => renderSideTopicButton(t, activeId),
  );
}

function sortTopicsWithActiveFirst(activeId) {
  return (a, b) => {
    if (a.id === activeId) return -1;
    if (b.id === activeId) return 1;
    const ta = b.updatedAt || b.createdAt || "";
    const tb = a.updatedAt || a.createdAt || "";
    return ta.localeCompare(tb);
  };
}

function renderSideTopics(data) {
  updateDirectButtons(data);
  const activeId = data.id || "";
  const currentTopic = activeId ? {
    id: activeId,
    topic: data.topic || "(untitled)",
    round: data.round || 0,
    messageCount: Array.isArray(data.messages) ? data.messages.length : 0,
    updatedAt: data.updatedAt || "",
    createdAt: data.createdAt || "",
    active: true,
  } : null;

  const allById = new Map();
  if (currentTopic) allById.set(currentTopic.id, currentTopic);
  for (const topic of Array.isArray(data.topics) ? data.topics : []) {
    if (topic?.id && !allById.has(topic.id)) allById.set(topic.id, topic);
  }

  const all = [...allById.values()];
  const hiddenIds = getHiddenTopicIds();
  const temporary = all
    .filter((topic) => topicKind(topic.topic) === "temporary")
    .filter((topic) => topic.id === activeId || !hiddenIds.has(topic.id))
    .sort(sortTopicsWithActiveFirst(activeId));

  renderFixedRooms(data.fixedRooms || {}, activeId);
  renderProjects(data.sidebarProjects || [], activeId);
  replaceSideTopicList(els.temporaryTopicsList, temporary, activeId, "还没有最近话题");
  replaceSideTopicList(els.otherTopicsList, [], activeId, "");
}

function renderProjects(projects, activeId) {
  if (!els.projectsList) return;
  const hiddenProjectIds = getHiddenProjectIds();
  const seenIds = new Set();
  const normalized = (Array.isArray(projects) ? projects : [])
    .filter((project) => !isHiddenProject(project))
    .filter((project) => project.topicId === activeId || !hiddenProjectIds.has(project.id))
    .filter((project) => {
      const id = project?.id || "";
      if (!id || seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });
  if (!normalized.length) {
    if (els.projectsList.children.length !== 1 || !els.projectsList.firstElementChild?.classList?.contains("side-empty")) {
      const empty = document.createElement("div");
      empty.className = "side-empty";
      empty.textContent = "还没有项目";
      els.projectsList.replaceChildren(empty);
    }
    return;
  }
  reconcileList(
    els.projectsList,
    normalized,
    (p) => p.id,
    (p) => `${p.title || ""}|${p.icon || ""}|${p.topicId || ""}|${p.topicId && p.topicId === activeId ? 1 : 0}`,
    (p) => renderProjectButton(p, activeId),
  );
}

function isHiddenProject(project) {
  const title = String(project?.title || "").trim().toLowerCase();
  const topicTitle = topicDisplayName(project?.topicTitle || "").toLowerCase();
  return HIDDEN_PROJECT_TITLES.has(title) || HIDDEN_PROJECT_TITLES.has(topicTitle);
}

function renderProjectButton(project, activeId) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "room-item side-topic-item project-item";
  if (project.topicId && project.topicId === activeId) button.classList.add("active");

  const index = document.createElement("span");
  index.className = "room-index";
  index.textContent = project.icon || "□";

  const text = document.createElement("span");
  const strong = document.createElement("strong");
  strong.textContent = project.title || topicDisplayName(project.topicTitle || "未命名项目");
  const small = document.createElement("small");
  small.textContent = "项目 · 固定话题";
  text.append(strong, small);

  const archiveBtn = document.createElement("button");
  archiveBtn.type = "button";
  archiveBtn.className = "side-archive-btn";
  archiveBtn.title = "归档";
  archiveBtn.textContent = "收";
  archiveBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const hidden = getHiddenProjectIds();
    hidden.add(project.id);
    saveHiddenProjectIds(hidden);
    button.remove();
    if (project.topicId && project.topicId === state.topicId) {
      await postJson("/api/end-topic", {});
    }
  });

  const dot = document.createElement("i");
  button.append(index, text, archiveBtn, dot);
  button.addEventListener("click", async () => {
    await postJson("/api/open-project", { id: project.id }, { timeoutMs: 12000 });
  });
  return button;
}

function updateDirectButtons(data) {
  const directChats = data.directChats || {};
  for (const button of els.directButtons || []) {
    const id = button.dataset.directId || "";
    const topicId = directChats?.[id]?.topicId || "";
    button.classList.toggle("active", Boolean(topicId && topicId === data.id));
  }
}

function updateFixedRoomButtons(data) {
  const fixedRooms = data.fixedRooms || {};
  for (const button of els.roomButtons || []) {
    const roomId = button.dataset.roomId || "";
    const topicId = fixedRooms?.[roomId]?.topicId || "";
    button.classList.toggle("active", Boolean(topicId && topicId === data.id));
  }
}

function renderSideTopicButton(topic, activeId) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "room-item side-topic-item";
  if (topic.id === activeId) button.classList.add("active");
  button.dataset.topicId = topic.id;
  button.dataset.topicKind = topicKind(topic.topic);

  const index = document.createElement("span");
  index.className = "room-index";
  const kind = topicKind(topic.topic);
  index.textContent = kind === "fixed" ? "F" : kind === "temporary" ? "·" : "·";

  const text = document.createElement("span");
  const strong = document.createElement("strong");
  strong.textContent = topicDisplayName(topic.topic || "(untitled)");
  const small = document.createElement("small");
  small.textContent = `${topic.messageCount || 0} 条消息`;
  text.append(strong, small);

  const archiveBtn = document.createElement("button");
  archiveBtn.type = "button";
  archiveBtn.className = "side-archive-btn";
  archiveBtn.title = "归档";
  archiveBtn.textContent = "收";
  archiveBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const hidden = getHiddenTopicIds();
    hidden.add(topic.id);
    saveHiddenTopicIds(hidden);
    button.closest(".side-topic-item")?.remove() || button.remove();
    await postJson("/api/topic/archive-sidebar", { id: topic.id }, { timeoutMs: 12000 });
    if (topic.id === activeId) {
      await postJson("/api/end-topic", {});
    }
  });

  button.append(index, text, archiveBtn);
  button.addEventListener("click", async () => {
    if (topic.id === activeId) return;
    await postJson("/api/open-topic", { id: topic.id }, { force: true });
  });
  return button;
}

async function markTopicKind(topic, kind) {
  if (!topic?.id) return;
  const baseTitle = topicDisplayName(topic.topic || "未命名");
  const prefix = kind === "fixed" ? "固定" : "临时";
  await postJson("/api/update-topic", { id: topic.id, topic: `${prefix}｜${baseTitle}` }, { timeoutMs: 12000 });
}

function normalizeCreatedTopicTitle(value, kind = "temporary") {
  const text = (value || "").trim();
  if (!text) return "";
  if (/^(固定|临时|单聊)\s*[｜|:：-]/.test(text)) return text;
  return `${kind === "project" || kind === "fixed" ? "固定" : "临时"}｜${text}`;
}

function topicKind(title) {
  const text = String(title || "").trim();
  if (/^固定\s*[｜|:：-]/.test(text)) return "fixed";
  if (/^临时\s*[｜|:：-]/.test(text)) return "temporary";
  if (/^单聊\s*[｜|:：-]/.test(text)) return "direct";
  return "";
}

function topicKindLabel(title) {
  const kind = topicKind(title);
  if (kind === "fixed") return "固定房间";
  if (kind === "temporary") return "临时草稿";
  return "圆桌话题";
}

function topicDisplayName(title) {
  return String(title || "").trim().replace(/^(固定|临时|单聊)\s*[｜|:：-]\s*/, "");
}

function preserveCurrentKind(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  if (/^(固定|临时)[｜|]/.test(text)) return text;
  const kind = topicKind(state.currentTopicTitle);
  if (kind === "fixed") return `固定｜${text}`;
  if (kind === "temporary") return `临时｜${text}`;
  return text;
}

function updateRoomButtons(currentTopic) {
  for (const button of els.roomButtons || []) {
    button.classList.toggle("active", (button.dataset.roomTopic || "") === currentTopic);
  }
}

function getHiddenTopicIds() {
  const ids = new Set(Array.isArray(state.hiddenTopicIds) ? state.hiddenTopicIds : []);
  for (const id of readLocalHiddenTopicIds()) ids.add(id);
  return ids;
}

function readLocalHiddenTopicIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem("hiddenTopicIds") || "[]").filter(Boolean));
  } catch { return new Set(); }
}

function saveHiddenTopicIds(set) {
  try {
    localStorage.setItem("hiddenTopicIds", JSON.stringify([...set]));
  } catch {}
}

function getHiddenProjectIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem("hiddenProjectIds") || "[]"));
  } catch { return new Set(); }
}

function saveHiddenProjectIds(set) {
  try {
    localStorage.setItem("hiddenProjectIds", JSON.stringify([...set]));
  } catch {}
}

if (els.archiveOpenButton) {
  els.archiveOpenButton.addEventListener("click", () => {
    if (els.archiveForm) els.archiveForm.style.display = "block";
    if (els.archiveTitleInput) els.archiveTitleInput.focus();
  });
}

if (els.archiveCancelButton) {
  els.archiveCancelButton.addEventListener("click", () => {
    if (els.archiveForm) els.archiveForm.style.display = "none";
  });
}

if (els.archiveSubmitButton) {
  els.archiveSubmitButton.addEventListener("click", async () => {
    const title = (els.archiveTitleInput?.value || "").trim();
    const summary = (els.archiveSummaryInput?.value || "").trim();
    if (!title) {
      els.archiveTitleInput?.focus();
      return;
    }
    const tags = (els.archiveTagsInput?.value || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const sourceTopic = (els.archiveSourceInput?.value || "").trim() || state.currentTopicTitle;
    try {
      await fetchJson("/api/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, summary, tags, sourceTopic, sourceType: "topic" }),
      });
      if (els.archiveForm) els.archiveForm.style.display = "none";
      if (els.archiveTitleInput) els.archiveTitleInput.value = "";
      if (els.archiveSummaryInput) els.archiveSummaryInput.value = "";
      if (els.archiveTagsInput) els.archiveTagsInput.value = "";
      if (els.archiveSourceInput) els.archiveSourceInput.value = "";
      refreshStorage();
    } catch (error) {
      showError(error.message);
    }
  });
}

async function refreshStorage() {
  try {
    const entries = await fetchJson("/api/storage");
    renderNotebooks(entries);
  } catch {
    // non-critical, leave grid as-is
  }
}

async function refreshWorklog() {
  if (!els.worklogContent) return;
  try {
    const [status, worklog] = await Promise.all([
      fetchJson("/api/runtime/status"),
      fetchJson("/api/runtime/worklog?scope=all&days=7&limit=1000").catch(() => ({ runs: [], events: [] })),
    ]);
    renderWorklog(status, worklog);
  } catch (error) {
    els.worklogContent.innerHTML = `<p class="worklog-empty">${escapeHtml(error.message || "日志读取失败。")}</p>`;
  }
}

function renderWorklog(status, worklog = {}) {
  if (!els.worklogContent) return;
  const activeRuns = Array.isArray(status?.activeRuns) ? status.activeRuns : [];
  const allEvents = Array.isArray(worklog?.events) ? worklog.events : [];
  const recentEvents = Array.isArray(status?.recentEvents) ? status.recentEvents : [];
  const events = allEvents.length ? allEvents : recentEvents;

  if (!activeRuns.length && !events.length) {
    els.worklogContent.innerHTML = '<p class="worklog-empty">暂无运行记录。</p>';
    return;
  }

  const sections = [];

  if (activeRuns.length) {
    const sec = document.createElement("section");
    sec.className = "worklog-section";
    const h = document.createElement("h3");
    h.textContent = "当前活跃";
    const list = document.createElement("ul");
    list.className = "worklog-runs";
    for (const run of activeRuns) {
      const li = document.createElement("li");
      li.className = `worklog-run active`;
      const speaker = run.label || run.speaker || "System";
      const statusText = formatWorklogStatusHuman({ run });
      const elapsed = formatElapsed(run.since);
      li.innerHTML = `<strong>${escapeHtml(speaker)}</strong> <span class="worklog-run-status">${escapeHtml(statusText)}</span>${elapsed ? ` <time>${escapeHtml(elapsed)}</time>` : ""}`;
      list.append(li);
    }
    sec.append(h, list);
    sections.push(sec);
  }

  const diagnostics = renderWorklogDiagnostics(activeRuns, events);
  if (diagnostics) {
    sections.push(diagnostics);
  }

  if (events.length) {
    const runs = Array.isArray(worklog?.runs) ? worklog.runs : [];
    const sec = document.createElement("section");
    sec.className = "worklog-section";
    const h = document.createElement("h3");
    h.textContent = "运行记录";
    sec.append(h, renderGroupedWorklogTimeline(events, runs));
    sections.push(sec);
  }

  els.worklogContent.replaceChildren(...sections);
}

const WORKLOG_TOPIC_INITIAL_EVENTS = 18;

function renderGroupedWorklogTimeline(events = [], runs = []) {
  const runById = new Map((Array.isArray(runs) ? runs : [])
    .filter((run) => run?.id)
    .map((run) => [run.id, run]));
  const dayGroups = groupWorklogEvents(events, runById);
  const wrap = document.createElement("div");
  wrap.className = "worklog-days";
  if (!dayGroups.length) {
    const empty = document.createElement("p");
    empty.className = "worklog-empty";
    empty.textContent = "暂无运行记录。";
    wrap.append(empty);
    return wrap;
  }
  const todayKey = worklogDateKey(new Date());
  for (const day of dayGroups) {
    const details = document.createElement("details");
    details.className = "worklog-day";
    details.open = day.key === todayKey;

    const summary = document.createElement("summary");
    summary.className = "worklog-day-summary";
    const date = document.createElement("span");
    date.textContent = day.label;
    const count = document.createElement("small");
    count.textContent = `${day.eventCount} 条`;
    summary.append(date, count);
    details.append(summary);

    for (const topic of day.topics) {
      details.append(renderWorklogTopicGroup(topic, runById));
    }
    wrap.append(details);
  }
  return wrap;
}

function groupWorklogEvents(events = [], runById = new Map()) {
  const sortedEvents = [...events].sort((a, b) => (
    Date.parse(worklogEventTimestamp(a)) - Date.parse(worklogEventTimestamp(b))
    || Number(a.id || 0) - Number(b.id || 0)
  ));
  const dayByKey = new Map();
  for (const event of sortedEvents) {
    const date = worklogEventDate(event);
    const dayKey = worklogDateKey(date);
    if (!dayByKey.has(dayKey)) {
      dayByKey.set(dayKey, {
        key: dayKey,
        label: formatWorklogDateLabel(date),
        topics: new Map(),
        eventCount: 0,
      });
    }
    const day = dayByKey.get(dayKey);
    const topicKey = worklogTopicKey(event, runById);
    if (!day.topics.has(topicKey)) {
      day.topics.set(topicKey, {
        key: topicKey,
        title: worklogTopicLabel(event, runById),
        events: [],
      });
    }
    day.topics.get(topicKey).events.push(event);
    day.eventCount += 1;
  }
  return [...dayByKey.values()]
    .sort((a, b) => b.key.localeCompare(a.key))
    .map((day) => ({
      ...day,
      topics: [...day.topics.values()],
    }));
}

function renderWorklogTopicGroup(topic, runById) {
  const section = document.createElement("section");
  section.className = "worklog-topic";
  const title = document.createElement("h4");
  title.textContent = topic.title || "未命名话题";
  const list = document.createElement("ul");
  list.className = "worklog-timeline";
  const visibleEvents = topic.events.slice(0, WORKLOG_TOPIC_INITIAL_EVENTS);
  for (const event of visibleEvents) {
    list.append(renderWorklogTimelineItem(event, runById));
  }
  section.append(title, list);
  if (topic.events.length > visibleEvents.length) {
    const more = document.createElement("button");
    more.type = "button";
    more.className = "worklog-more";
    more.textContent = `显示更多 ${topic.events.length - visibleEvents.length}`;
    more.addEventListener("click", () => {
      for (const event of topic.events.slice(visibleEvents.length)) {
        list.append(renderWorklogTimelineItem(event, runById));
      }
      more.remove();
    });
    section.append(more);
  }
  return section;
}

function renderWorklogTimelineItem(event = {}, runById = new Map()) {
  const li = document.createElement("li");
  li.className = `worklog-timeline-item ${event.level || "info"}`;
  const timeStr = formatWorklogTimeLabel(worklogEventDate(event));
  const speakerLabel = worklogSpeakerLabel(event, runById);
  const humanText = humanizeWorklogEvent(event).replace(/^\d{2}:\d{2}:\d{2}\s*/, "");
  const row = document.createElement("div");
  row.className = "worklog-timeline-row";
  row.innerHTML = `<time>${escapeHtml(timeStr)}</time>${speakerLabel ? ` <strong>${escapeHtml(speakerLabel)}</strong>` : ""} <span>${escapeHtml(humanText)}</span>`;
  li.append(row);
  const detail = renderWorklogEventDetail(event);
  if (detail) {
    li.append(detail);
  }
  return li;
}

function worklogEventTimestamp(event = {}) {
  return event.createdAt || event.at || "";
}

function worklogEventDate(event = {}) {
  const date = new Date(worklogEventTimestamp(event));
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function worklogDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatWorklogDateLabel(date) {
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}

function formatWorklogTimeLabel(date) {
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function worklogTopicKey(event = {}, runById = new Map()) {
  const run = runById.get(event.runId) || {};
  return event.topicId || run.topicId || event.topicTitle || run.topicTitle || "unknown";
}

function worklogTopicLabel(event = {}, runById = new Map()) {
  const run = runById.get(event.runId) || {};
  return topicDisplayName(event.topicTitle || run.topicTitle || event.topicId || run.topicId || "未命名话题");
}

function worklogSpeakerLabel(event = {}, runById = new Map()) {
  if (event.type === "input.captured") return "圆桌";
  const run = runById.get(event.runId) || {};
  const speaker = event.speaker || run.speaker || "";
  if (speaker === "codex") return "Codex";
  if (speaker === "claude") return "Claude Code";
  return speaker || "系统";
}

function renderWorklogDiagnostics(activeRuns = [], events = []) {
  if (!activeRuns.length || !events.length) return null;
  const hints = [];
  const eventsByRun = new Map();
  for (const event of events) {
    if (!event.runId) continue;
    const list = eventsByRun.get(event.runId) || [];
    list.push(event);
    eventsByRun.set(event.runId, list);
  }
  for (const run of activeRuns) {
    const runEvents = eventsByRun.get(run.id) || [];
    const latest = runEvents.at(-1);
    const contextCount = runEvents.filter((event) => event.type === "context.updated").length;
    const toolStart = [...runEvents].reverse().find((event) => event.type === "tool.started");
    const toolFinishedAfterStart = toolStart
      ? runEvents.some((event) => event.type === "tool.finished" && event.id > toolStart.id)
      : false;
    const waitSeconds = latest?.createdAt ? Math.floor((Date.now() - Date.parse(latest.createdAt)) / 1000) : 0;
    if (run.status === "waiting_approval") {
      hints.push(`${speakerName({ speaker: run.speaker })} 正在等你授权，已经 ${formatElapsed(run.since) || "一会儿"}。`);
    } else if (toolStart && !toolFinishedAfterStart && waitSeconds > 20) {
      hints.push(`${speakerName({ speaker: run.speaker })} 可能卡在工具调用：${toolStart.detail?.name || toolStart.title || "tool"}，${waitSeconds}s 没有返回。`);
    } else if (contextCount >= 6 && latest?.type === "context.updated") {
      hints.push(`${speakerName({ speaker: run.speaker })} 一直在刷新上下文，已记录 ${contextCount} 次，暂时还没稳定产出。`);
    }
  }
  if (!hints.length) return null;
  const sec = document.createElement("section");
  sec.className = "worklog-section worklog-diagnostics";
  const h = document.createElement("h3");
  h.textContent = "监控提示";
  const list = document.createElement("ul");
  list.className = "worklog-runs";
  for (const hint of hints) {
    const li = document.createElement("li");
    li.className = "worklog-run warning";
    li.textContent = hint;
    list.append(li);
  }
  sec.append(h, list);
  return sec;
}

function renderWorklogEventDetail(event = {}) {
  const detail = event.detail && typeof event.detail === "object" ? event.detail : {};
  const blocks = [];
  if (detail.prompt) {
    blocks.push({
      title: `AI 实际上下文 (${detail.promptChars || detail.prompt.length} chars${detail.promptTruncated ? ", truncated" : ""})`,
      text: detail.prompt,
    });
  }
  if (Array.isArray(detail.messages) && detail.messages.length) {
    blocks.push({
      title: `消息范围 (${detail.messageCount || detail.messages.length})`,
      text: JSON.stringify(detail.messages, null, 2),
    });
  }
  if (Array.isArray(detail.attachments) && detail.attachments.length) {
    blocks.push({
      title: `附件 (${detail.attachments.length})`,
      text: JSON.stringify(detail.attachments, null, 2),
    });
  }
  if (detail.command) {
    blocks.push({ title: "命令 / 工具请求", text: detail.command });
  }
  if (detail.input) {
    blocks.push({ title: "工具输入", text: JSON.stringify(detail.input, null, 2) });
  }
  if (detail.output) {
    blocks.push({ title: detail.status === "error" ? "工具错误输出" : "工具输出", text: detail.output });
  }
  if (detail.text) {
    blocks.push({ title: event.type === "terminal.stderr" ? "stderr" : "思路 / 终端文本", text: detail.text });
  }
  if (detail.error) {
    blocks.push({ title: "错误", text: detail.error });
  }
  if (!blocks.length) return null;
  const wrap = document.createElement("div");
  wrap.className = "worklog-detail-blocks";
  for (const block of blocks) {
    const details = document.createElement("details");
    details.className = "worklog-detail";
    const summary = document.createElement("summary");
    summary.textContent = block.title;
    const pre = document.createElement("pre");
    pre.textContent = block.text || "";
    details.append(summary, pre);
    wrap.append(details);
  }
  return wrap;
}

async function refreshNotebook() {
  if (!els.roundtableNotebook) return;
  try {
    const notebook = await fetchJson("/api/notebook");
    state.notebook = notebook;
    renderNotebook(notebook);
  } catch (error) {
    els.roundtableNotebook.innerHTML = `<p class="notebook-empty">${escapeHtml(error.message || "本子读取失败。")}</p>`;
  }
}

async function saveNotebook(notebook) {
  state.notebook = notebook;
  renderNotebook(notebook);
  const saved = await postJson("/api/notebook", { notebook }, { timeoutMs: 12000 });
  if (saved) {
    state.notebook = saved;
    renderNotebook(saved);
  }
}

async function refreshStudyTracker() {
  try {
    const data = await fetchJson("/api/study-tracker?limit=14");
    renderStudyTracker(data);
  } catch {
    // non-critical
  }
}

function renderStudyTracker(data = {}) {
  const overview = data.overview || {};
  if (els.studyCurrentGoalInput) els.studyCurrentGoalInput.value = overview.currentGoal || "";
  if (els.studyCurrentPhaseInput) els.studyCurrentPhaseInput.value = overview.currentPhase || "";
  if (els.studyCurrentScoresInput) els.studyCurrentScoresInput.value = formatKeyValueText(overview.currentScores || {});
  if (els.studyMainRisksInput) els.studyMainRisksInput.value = (overview.mainRisks || []).join("\n");
  if (els.studyNextThreeDaysInput) els.studyNextThreeDaysInput.value = (overview.nextThreeDays || []).join("\n");

  const latestPlan = (data.planEntries || [])[0];
  const latestProgress = (data.progressEntries || [])[0];
  hydratePlanForm(latestPlan);
  hydrateProgressForm(latestProgress);
  renderPlanTable(data.planEntries || []);
  renderProgressTable(data.progressEntries || []);
}

function hydratePlanForm(entry) {
  if (els.studyPlanDateInput) els.studyPlanDateInput.value = entry?.date || todayText();
  if (els.studyPlanPhaseInput) els.studyPlanPhaseInput.value = entry?.phase || "";
  if (els.studyPlanFocusInput) els.studyPlanFocusInput.value = entry?.focus || "";
  if (els.studyPlanTasksInput) els.studyPlanTasksInput.value = (entry?.tasks || []).join("\n");
  if (els.studyPlanMetricsInput) els.studyPlanMetricsInput.value = (entry?.targetMetrics || []).join("\n");
  if (els.studyPlanReviewInput) els.studyPlanReviewInput.value = (entry?.reviewPlan || []).join("\n");
  if (els.studyPlanNotesInput) els.studyPlanNotesInput.value = entry?.teacherNotes || "";
}

function hydrateProgressForm(entry) {
  if (els.studyProgressDateInput) els.studyProgressDateInput.value = entry?.date || todayText();
  if (els.studyActualCompletedInput) els.studyActualCompletedInput.value = entry?.actualCompleted || "";
  if (els.studyEvidenceInput) els.studyEvidenceInput.value = entry?.evidence || "";
  if (els.studySelfNoteInput) els.studySelfNoteInput.value = entry?.selfNote || "";
  if (els.studyTeacherFeedbackInput) els.studyTeacherFeedbackInput.value = entry?.teacherFeedback || "";
  if (els.studyReviewDebtInput) els.studyReviewDebtInput.value = (entry?.reviewDebt || []).join("\n");
  if (els.studyNextAdjustmentInput) els.studyNextAdjustmentInput.value = entry?.nextAdjustment || "";
}

function renderPlanTable(entries) {
  if (!els.studyPlanTable) return;
  if (!entries.length) {
    els.studyPlanTable.innerHTML = '<p class="tracker-empty">还没有教学计划。</p>';
    return;
  }
  els.studyPlanTable.innerHTML = entries.map((entry) => `
    <article class="tracker-row">
      <small>${escapeHtml(entry.date || "")} · ${escapeHtml(entry.phase || "")}</small>
      <strong>${escapeHtml(entry.focus || "未写重点")}</strong>
      ${renderTrackerList(entry.tasks)}
      ${entry.teacherNotes ? `<p>${escapeHtml(entry.teacherNotes)}</p>` : ""}
    </article>
  `).join("");
}

function renderProgressTable(entries) {
  if (!els.studyProgressTable) return;
  if (!entries.length) {
    els.studyProgressTable.innerHTML = '<p class="tracker-empty">还没有执行记录。</p>';
    return;
  }
  els.studyProgressTable.innerHTML = entries.map((entry) => `
    <article class="tracker-row">
      <small>${escapeHtml(entry.date || "")}</small>
      <strong>${escapeHtml(entry.actualCompleted || "未写完成情况")}</strong>
      ${entry.selfNote ? `<p>${escapeHtml(entry.selfNote)}</p>` : ""}
      ${renderTrackerList(entry.reviewDebt)}
      ${entry.teacherFeedback ? `<p>${escapeHtml(entry.teacherFeedback)}</p>` : ""}
    </article>
  `).join("");
}

function renderTrackerList(items) {
  const values = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!values.length) return "";
  return `<ul>${values.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function linesFromText(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseKeyValueText(value) {
  const result = {};
  for (const line of linesFromText(String(value || "").replace(/；/g, "\n").replace(/;/g, "\n"))) {
    const [key, ...rest] = line.split(/[:：]/);
    const cleanKey = (key || "").trim();
    const cleanValue = rest.join(":").trim();
    if (cleanKey && cleanValue) result[cleanKey] = cleanValue;
  }
  return result;
}

function formatKeyValueText(record) {
  return Object.entries(record || {})
    .map(([key, value]) => `${key}：${value}`)
    .join("；");
}

function todayText() {
  return new Date().toISOString().slice(0, 10);
}

function renderNotebooks(entries) {
  if (!els.notebookGrid) return;
  if (!entries || entries.length === 0) {
    els.notebookGrid.innerHTML = '<p class="notebook-empty">还没有归档条目。</p>';
    return;
  }
  els.notebookGrid.innerHTML = entries.map((entry) => {
    const tags = (entry.tags || []).map((t) => `<span class="nb-tag">${escapeHtml(t)}</span>`).join("");
    const source = entry.sourceTopic ? `<small class="nb-source">来源：${escapeHtml(entry.sourceTopic)}</small>` : "";
    const date = entry.createdAt ? new Date(entry.createdAt).toLocaleDateString("zh-CN") : "";
    return `<article class="notebook-card" data-storage-id="${escapeHtml(entry.id)}">
      <div class="nb-meta">${date ? `<small>${date}</small>` : ""}${source}</div>
      <h3>${escapeHtml(entry.title)}</h3>
      ${entry.summary ? `<p>${escapeHtml(entry.summary)}</p>` : ""}
      ${tags ? `<div class="nb-tags">${tags}</div>` : ""}
      <button class="nb-delete" type="button" data-delete-id="${escapeHtml(entry.id)}">删除</button>
    </article>`;
  }).join("");

  for (const btn of els.notebookGrid.querySelectorAll(".nb-delete")) {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.deleteId;
      try {
        await fetchJson("/api/storage/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        refreshStorage();
      } catch (error) {
        showError(error.message);
      }
    });
  }
}

function renderNotebook(notebook) {
  if (!els.roundtableNotebook) return;
  const projects = Array.isArray(notebook?.projects) ? notebook.projects : [];
  if (!projects.length) {
    els.roundtableNotebook.innerHTML = '<p class="notebook-empty">本子里还没有项目。</p>';
    return;
  }
  if (!state.notebookProjectId || !projects.some((project) => project.id === state.notebookProjectId)) {
    state.notebookProjectId = projects[0].id;
  }
  renderNotebookProjectSelect(projects);
  const project = projects.find((item) => item.id === state.notebookProjectId) || projects[0];
  const nodes = [];
  nodes.push(renderNotebookInbox(notebook.inbox || []));
  nodes.push(renderNotebookCompleted(notebook.completed || []));
  for (const target of project.targets || []) {
    nodes.push(renderNotebookTargetCard(project.id, target));
  }
  els.roundtableNotebook.replaceChildren(...nodes);
}

function renderNotebookProjectSelect(projects) {
  if (!els.notebookProjectSelect) return;
  const signature = projects.map((project) => `${project.id}:${project.title}`).join("|");
  if (els.notebookProjectSelect.dataset.signature === signature) {
    els.notebookProjectSelect.value = state.notebookProjectId;
    return;
  }
  els.notebookProjectSelect.dataset.signature = signature;
  els.notebookProjectSelect.replaceChildren(...projects.map((project) => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.title;
    return option;
  }));
  els.notebookProjectSelect.value = state.notebookProjectId;
}

function renderNotebookInbox(items) {
  const card = document.createElement("article");
  card.className = "notebook-goal-card inbox";
  const title = document.createElement("h3");
  title.textContent = "收件箱";
  const hint = document.createElement("p");
  hint.className = "notebook-card-hint";
  hint.textContent = "新问题先进这里，开工前再归到目标里。";
  card.append(title, hint);
  if (items.length) {
    card.append(renderNotebookItemList(items, {
      onToggle: (itemId) => toggleNotebookInboxItem(itemId),
    }));
  }
  if (els.notebookInboxForm) {
    const composer = document.createElement("div");
    composer.className = "notebook-inbox-composer";
    composer.append(els.notebookInboxForm);
    card.append(composer);
  }
  return card;
}

function renderNotebookTargetCard(projectId, target) {
  const card = document.createElement("article");
  card.className = "notebook-goal-card";

  const head = document.createElement("header");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = false;
  checkbox.addEventListener("change", () => toggleNotebookTarget(projectId, target.id));
  const title = document.createElement("h3");
  title.textContent = target.title || "未命名目标";
  const progress = document.createElement("small");
  progress.textContent = notebookProgressText(target);
  head.append(checkbox, title, progress);
  card.append(head);

  const sections = [
    ["现在规则", "rules"],
    ["要做", "todo"],
    ["Bug", "bugs"],
  ];
  for (const [label, key] of sections) {
    const section = renderNotebookSection(label, target.sections?.[key], {
      tone: key,
      onToggle: (itemId) => toggleNotebookTargetItem(projectId, target.id, key, itemId),
    });
    if (section) card.append(section);
  }

  const notes = target.sections?.notes || [];
  if (notes.length) {
    const details = document.createElement("details");
    details.className = "notebook-notes";
    const summary = document.createElement("summary");
    summary.textContent = "备注";
    details.append(summary, renderNotebookItemList(notes, {
      readonly: true,
    }));
    card.append(details);
  }
  return card;
}

function renderNotebookCompleted(items = []) {
  const values = Array.isArray(items) ? items : [];
  const card = document.createElement("article");
  card.className = "notebook-goal-card completed";
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = `完成区（${values.length}）`;
  if (!values.length) {
    const empty = document.createElement("p");
    empty.className = "notebook-empty compact";
    empty.textContent = "还没有完成归档。";
    details.append(summary, empty);
    card.append(details);
    return card;
  }
  const list = document.createElement("ul");
  list.className = "notebook-completed-list";
  for (const item of values.slice(0, 80)) {
    const li = document.createElement("li");
    const body = document.createElement("div");
    body.className = "notebook-completed-body";
    const meta = document.createElement("small");
    const source = [item.sourceTarget, item.sourceSection].filter(Boolean).join(" · ");
    const date = item.completedAt ? new Date(item.completedAt).toLocaleDateString("zh-CN") : "";
    meta.textContent = [source, date].filter(Boolean).join(" · ");
    const text = document.createElement("span");
    text.textContent = item.text || "";
    body.append(meta, text);
    const restoreButton = document.createElement("button");
    restoreButton.type = "button";
    restoreButton.textContent = "放回";
    restoreButton.addEventListener("click", () => restoreNotebookCompletedItem(item.id));
    li.append(body, restoreButton);
    list.append(li);
  }
  details.append(summary, list);
  card.append(details);
  return card;
}

function renderNotebookSection(label, items = [], options = {}) {
  const values = Array.isArray(items) ? items : [];
  if (!values.length) return null;
  const section = document.createElement("section");
  section.className = `notebook-section tone-${options.tone || "default"}`;
  const title = document.createElement("h4");
  title.textContent = label;
  section.append(title, renderNotebookItemList(values, options));
  return section;
}

function renderNotebookItemList(items = [], options = {}) {
  const list = document.createElement("ul");
  list.className = "notebook-check-list";
  for (const item of items) {
    const li = document.createElement("li");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(item.done);
    checkbox.disabled = Boolean(options.readonly);
    checkbox.addEventListener("change", () => options.onToggle?.(item.id));
    const text = document.createElement("span");
    text.textContent = item.text || "";
    li.append(checkbox, text);
    list.append(li);
  }
  return list;
}

function notebookProgressText(target) {
  const sections = target.sections || {};
  const items = ["rules", "todo", "bugs"]
    .flatMap((key) => Array.isArray(sections[key]) ? sections[key] : []);
  return `${items.length} 项`;
}

function toggleNotebookTarget(projectId, targetId) {
  const notebook = cloneNotebook(state.notebook);
  const target = findNotebookTarget(notebook, projectId, targetId);
  if (!target) return;
  const ok = window.confirm(`把「${target.title || "未命名目标"}」整张卡移入完成区？`);
  if (!ok) return;
  completeNotebookItem(notebook, {
    id: createNotebookId(`completed-${target.id}`),
    text: target.title || "未命名目标",
    sourceTarget: target.title || "未命名目标",
    sourceSection: "卡片",
    restore: {
      type: "target",
      projectId,
      target,
    },
  });
  removeNotebookTarget(notebook, projectId, targetId);
  void saveNotebook(notebook).catch((error) => showError(error.message));
}

function toggleNotebookTargetItem(projectId, targetId, sectionKey, itemId) {
  const notebook = cloneNotebook(state.notebook);
  const target = findNotebookTarget(notebook, projectId, targetId);
  const list = Array.isArray(target?.sections?.[sectionKey]) ? target.sections[sectionKey] : [];
  const index = list.findIndex((entry) => entry.id === itemId);
  const item = index >= 0 ? list[index] : null;
  if (!item) return;
  list.splice(index, 1);
  completeNotebookItem(notebook, {
    ...item,
    sourceTarget: target.title || "未命名目标",
    sourceSection: notebookSectionLabel(sectionKey),
    restore: {
      type: "target-item",
      projectId,
      targetId,
      sectionKey,
      item,
    },
  });
  void saveNotebook(notebook).catch((error) => showError(error.message));
}

function toggleNotebookInboxItem(itemId) {
  const notebook = cloneNotebook(state.notebook);
  const list = Array.isArray(notebook.inbox) ? notebook.inbox : [];
  const index = list.findIndex((entry) => entry.id === itemId);
  const item = index >= 0 ? list[index] : null;
  if (!item) return;
  list.splice(index, 1);
  completeNotebookItem(notebook, {
    ...item,
    sourceTarget: "收件箱",
    sourceSection: "收件箱",
    restore: {
      type: "inbox",
      item,
    },
  });
  void saveNotebook(notebook).catch((error) => showError(error.message));
}

function restoreNotebookCompletedItem(itemId) {
  const notebook = cloneNotebook(state.notebook);
  const completed = Array.isArray(notebook.completed) ? notebook.completed : [];
  const index = completed.findIndex((item) => item.id === itemId);
  const entry = index >= 0 ? completed[index] : null;
  if (!entry) return;
  const restore = entry.restore || {};
  if (restore.type === "target") {
    const project = (notebook.projects || []).find((item) => item.id === restore.projectId);
    if (!project) return;
    project.targets = Array.isArray(project.targets) ? project.targets : [];
    if (!project.targets.some((target) => target.id === restore.target?.id)) {
      project.targets.push(restore.target);
    }
  } else if (restore.type === "target-item") {
    const target = findNotebookTarget(notebook, restore.projectId, restore.targetId);
    if (!target) return;
    target.sections = target.sections || {};
    target.sections[restore.sectionKey] = Array.isArray(target.sections[restore.sectionKey]) ? target.sections[restore.sectionKey] : [];
    if (!target.sections[restore.sectionKey].some((item) => item.id === restore.item?.id)) {
      target.sections[restore.sectionKey].push(restore.item);
    }
  } else if (restore.type === "inbox") {
    notebook.inbox = Array.isArray(notebook.inbox) ? notebook.inbox : [];
    if (!notebook.inbox.some((item) => item.id === restore.item?.id)) {
      notebook.inbox.unshift(restore.item);
    }
  } else {
    notebook.inbox = Array.isArray(notebook.inbox) ? notebook.inbox : [];
    notebook.inbox.unshift({
      id: createNotebookId("restored"),
      text: entry.text || "",
      done: false,
      kind: entry.kind || "",
    });
  }
  completed.splice(index, 1);
  notebook.completed = completed;
  void saveNotebook(notebook).catch((error) => showError(error.message));
}

function findNotebookTarget(notebook, projectId, targetId) {
  const project = (notebook.projects || []).find((entry) => entry.id === projectId);
  return project?.targets?.find((target) => target.id === targetId) || null;
}

function removeNotebookTarget(notebook, projectId, targetId) {
  const project = (notebook.projects || []).find((entry) => entry.id === projectId);
  if (!project || !Array.isArray(project.targets)) return;
  project.targets = project.targets.filter((target) => target.id !== targetId);
}

function completeNotebookItem(notebook, item) {
  notebook.completed = Array.isArray(notebook.completed) ? notebook.completed : [];
  notebook.completed.unshift({
    id: item.id || createNotebookId("completed"),
    text: item.text || "",
    done: true,
    kind: item.kind || "",
    sourceTarget: item.sourceTarget || "",
    sourceSection: item.sourceSection || "",
    completedAt: new Date().toISOString(),
    restore: item.restore || null,
  });
}

function notebookSectionLabel(sectionKey) {
  if (sectionKey === "rules") return "现在规则";
  if (sectionKey === "todo") return "要做";
  if (sectionKey === "bugs") return "Bug";
  if (sectionKey === "notes") return "备注";
  return sectionKey || "";
}

function cloneNotebook(notebook) {
  return JSON.parse(JSON.stringify(notebook || { version: 1, projects: [], inbox: [], completed: [] }));
}

function createNotebookId(prefix = "item") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function refreshSummaries() {
  try {
    const days = await fetchJson("/api/summaries");
    summaryDaysCache = days;
    renderSummaryTimeline(days);
  } catch {
    // non-critical
  }
}

let summaryDaysCache = [];
let summaryFilterMode = "current";

function filterSummaryDays(days) {
  if (summaryFilterMode === "all") return days;
  if (summaryFilterMode === "current") {
    const currentId = state.topicId || "";
    if (!currentId) return days;
    return days
      .map(({ day, items }) => ({ day, items: items.filter((s) => s.topicId === currentId) }))
      .filter(({ items }) => items.length > 0);
  }
  return days
    .map(({ day, items }) => ({ day, items: items.filter((s) => summaryTopicGroup(s.topicId) === summaryFilterMode) }))
    .filter(({ items }) => items.length > 0);
}

function summaryTopicGroup(topicId) {
  const id = topicId || "";
  if (!id) return "temporary";
  if (Object.values(state.fixedRooms || {}).some((room) => room?.topicId === id)) return "fixed";
  if (Object.values(state.directChats || {}).some((chat) => chat?.topicId === id)) return "direct";
  if ((state.sidebarProjects || []).some((project) => project?.topicId === id)) return "project";
  const topic = (state.latestTopics || []).find((item) => item?.id === id);
  const type = topic?.container?.type || "";
  if (type === "fixed_room") return "fixed";
  if (type === "direct_chat") return "direct";
  if (type === "project") return "project";
  return "temporary";
}

function renderSummaryTimeline(days) {
  if (!els.summaryTimeline) return;
  const filtered = filterSummaryDays(days);
  renderSummaryBulkControls();
  if (!Array.isArray(filtered) || !filtered.length) {
    const emptyText = {
      current: "当前房间暂无总结。",
      project: "项目房间暂无总结。",
      fixed: "固定房间暂无总结。",
      direct: "单聊暂无总结。",
      all: "还没有总结。点主聊天里的 Summary 按钮可以让 DeepSeek 生成一条。",
    }[summaryFilterMode] || "这里暂无总结。";
    els.summaryTimeline.innerHTML = `<p class="summary-empty">${escapeHtml(emptyText)}</p>`;
    return;
  }
  const nodes = [];
  for (const { day, items } of filtered) {
    const dayHeader = document.createElement("div");
    dayHeader.className = "summary-day-header";
    dayHeader.textContent = formatSummaryDay(day);
    nodes.push(dayHeader);
    for (const item of items) {
      nodes.push(renderSummaryCard(item));
    }
  }
  els.summaryTimeline.replaceChildren(...nodes);
}

for (const tab of document.querySelectorAll(".summary-filter-tab")) {
  tab.addEventListener("click", () => {
    summaryFilterMode = tab.dataset.filter || "all";
    for (const t of document.querySelectorAll(".summary-filter-tab")) {
      t.classList.toggle("active", t === tab);
    }
    renderSummaryTimeline(summaryDaysCache);
  });
}

function renderSummaryCard(item) {
  const card = document.createElement("article");
  card.className = `summary-card kind-${item.kind || "mixed"}`;
  if (state.summarySelectedIds.has(item.id)) {
    card.classList.add("selected");
  }

  const meta = document.createElement("div");
  meta.className = "summary-card-meta";
  meta.textContent = `${item.topicTitle || item.topicId} · ${item.timeRange?.text || ""}`;

  const head = document.createElement("div");
  head.className = "summary-card-head";

  const selectButton = document.createElement("button");
  selectButton.type = "button";
  selectButton.className = "summary-select-btn";
  const isAlreadySelected = state.summarySelectedIds.has(item.id);
  selectButton.textContent = isAlreadySelected ? "✓" : "○";
  selectButton.title = "选择这条摘要";
  selectButton.setAttribute("aria-label", "选择这条摘要");
  selectButton.setAttribute("aria-pressed", isAlreadySelected ? "true" : "false");
  selectButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleSummarySelection(item.id, card, selectButton);
  });

  const archiveButton = document.createElement("button");
  archiveButton.type = "button";
  archiveButton.className = "summary-card-archive";
  archiveButton.textContent = "Hide";
  archiveButton.title = "Hide this summary from timeline, search, and injection";
  archiveButton.addEventListener("click", async () => {
    if (!item.id) return;
    await postJson("/api/summary/archive", { id: item.id });
    state.summarySelectedIds.delete(item.id);
    setSummaryActionStatus("已隐藏这条摘要。");
    refreshSummaries();
  });

  const actions = document.createElement("div");
  actions.className = "summary-card-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "summary-card-action-btn";
  editButton.textContent = "Edit";
  editButton.title = "编辑这条摘要";
  editButton.addEventListener("click", (e) => {
    e.stopPropagation();
    openSummaryEditDialog(item);
  });

  const injectCodex = document.createElement("button");
  injectCodex.type = "button";
  injectCodex.className = "summary-card-action-btn codex";
  injectCodex.textContent = "→ Codex";
  injectCodex.title = "注入这条总结给 Codex";
  injectCodex.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!item.id) return;
    await injectSummaryToSpeaker(item.id, "codex", injectCodex);
  });

  const injectClaude = document.createElement("button");
  injectClaude.type = "button";
  injectClaude.className = "summary-card-action-btn claude";
  injectClaude.textContent = "→ Claude";
  injectClaude.title = "注入这条总结给 Claude";
  injectClaude.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!item.id) return;
    await injectSummaryToSpeaker(item.id, "claude", injectClaude);
  });

  actions.append(editButton, injectCodex, injectClaude, archiveButton);
  head.append(selectButton, meta, actions);

  const text = document.createElement("p");
  text.className = "summary-card-text";
  text.textContent = item.summary || "";

  card.append(head, text);

  if (Array.isArray(item.decisions) && item.decisions.length) {
    const list = document.createElement("ul");
    list.className = "summary-card-list";
    for (const d of item.decisions) {
      const li = document.createElement("li");
      li.textContent = d;
      list.append(li);
    }
    card.append(list);
  }

  if (Array.isArray(item.next) && item.next.length) {
    const next = document.createElement("div");
    next.className = "summary-card-next";
    next.textContent = "→ " + item.next.join("；");
    card.append(next);
  }

  return card;
}

function toggleSummarySelection(id, card, button) {
  if (!id) return;
  const selected = !state.summarySelectedIds.has(id);
  if (selected) {
    state.summarySelectedIds.add(id);
  } else {
    state.summarySelectedIds.delete(id);
  }
  card?.classList.toggle("selected", selected);
  button?.setAttribute("aria-pressed", selected ? "true" : "false");
  if (button) button.textContent = selected ? "✓" : "○";
  renderSummaryBulkControls();
}

function renderSummaryBulkControls() {
  const count = state.summarySelectedIds.size;
  if (els.summarySelectedCount) {
    els.summarySelectedCount.textContent = `已选 ${count} 条`;
  }
  if (els.summaryMergeButton) {
    els.summaryMergeButton.disabled = count < 2;
  }
  if (els.summaryClearSelectionButton) {
    els.summaryClearSelectionButton.disabled = count === 0;
  }
}

function setSummaryActionStatus(message, tone = "info") {
  if (!els.summaryActionStatus) return;
  els.summaryActionStatus.textContent = message || "";
  els.summaryActionStatus.dataset.tone = tone;
}

async function injectSummaryToSpeaker(summaryId, speaker, button) {
  if (!summaryId || !speaker || !button || button.disabled) return;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "注入中";
  setSummaryActionStatus(`正在注入给 ${speaker === "codex" ? "Codex" : "Claude"}...`);
  const result = await postJson("/api/summary/inject-one", { speaker, summaryId }, { timeoutMs: 15000 });
  if (result) {
    const mode = result.summaryInjection?.mode || "";
    const destination = mode === "current-thread" ? "当前线程的下一次回复" : "下次 fresh runtime";
    button.textContent = "已注入";
    setSummaryActionStatus(`已注入给 ${speaker === "codex" ? "Codex" : "Claude"}：${destination}会看到正文。`, "success");
    setTimeout(() => { button.textContent = original; }, 1800);
  } else {
    button.textContent = original;
    setSummaryActionStatus("注入失败，错误已显示在聊天页顶部。", "error");
  }
  button.disabled = false;
}

function openSummaryEditDialog(item) {
  if (!els.summaryEditDialog || !item?.id) return;
  els.summaryEditId.value = item.id;
  if (els.summaryEditTitleText) els.summaryEditTitleText.textContent = "编辑摘要";
  els.summaryEditTitleInput.value = item.topicTitle || "";
  els.summaryEditTextInput.value = item.summaryText || item.summary || "";
  els.summaryEditDecisionsInput.value = (item.decisions || []).join("\n");
  els.summaryEditOpenItemsInput.value = (item.openItems || item.next || []).join("\n");
  els.summaryEditLatestStateInput.value = item.latestState || "";
  els.summaryEditTagsInput.value = (item.tags || []).join(", ");
  if (typeof els.summaryEditDialog.showModal === "function") {
    els.summaryEditDialog.showModal();
  } else {
    els.summaryEditDialog.setAttribute("open", "");
  }
}

function openSummaryCreateDialog() {
  if (!els.summaryEditDialog) return;
  if (els.summaryEditTitleText) els.summaryEditTitleText.textContent = "手动新增摘要";
  if (els.summaryEditId) els.summaryEditId.value = "";
  if (els.summaryEditTitleInput) els.summaryEditTitleInput.value = state.currentTopicTitle || "";
  if (els.summaryEditTextInput) els.summaryEditTextInput.value = "";
  if (els.summaryEditDecisionsInput) els.summaryEditDecisionsInput.value = "";
  if (els.summaryEditOpenItemsInput) els.summaryEditOpenItemsInput.value = "";
  if (els.summaryEditLatestStateInput) els.summaryEditLatestStateInput.value = "";
  if (els.summaryEditTagsInput) els.summaryEditTagsInput.value = "manual";
  if (typeof els.summaryEditDialog.showModal === "function") {
    els.summaryEditDialog.showModal();
  } else {
    els.summaryEditDialog.setAttribute("open", "");
  }
  els.summaryEditTextInput?.focus();
}

function closeSummaryEditDialog() {
  if (!els.summaryEditDialog) return;
  if (typeof els.summaryEditDialog.close === "function") {
    els.summaryEditDialog.close();
  } else {
    els.summaryEditDialog.removeAttribute("open");
  }
}

async function saveSummaryEdit() {
  const id = els.summaryEditId?.value || "";
  if (els.summaryEditSaveButton) {
    els.summaryEditSaveButton.disabled = true;
  }
  const payload = {
    topicTitle: els.summaryEditTitleInput?.value || "",
    summaryText: els.summaryEditTextInput?.value || "",
    decisions: linesFromText(els.summaryEditDecisionsInput?.value || ""),
    openItems: linesFromText(els.summaryEditOpenItemsInput?.value || ""),
    latestState: els.summaryEditLatestStateInput?.value || "",
    tags: splitTags(els.summaryEditTagsInput?.value || ""),
  };
  const result = id
    ? await postJson("/api/summary/update", { id, ...payload }, { timeoutMs: 15000 })
    : await postJson("/api/summary/manual", { actor: "owner", ...payload }, { timeoutMs: 15000 });
  if (els.summaryEditSaveButton) {
    els.summaryEditSaveButton.disabled = false;
  }
  if (result) {
    closeSummaryEditDialog();
    setSummaryActionStatus(id ? "摘要已保存。" : "手动摘要已新增。", "success");
    refreshSummaries();
  }
}

async function mergeSelectedSummaries() {
  const ids = [...state.summarySelectedIds];
  if (ids.length < 2 || !els.summaryMergeButton || els.summaryMergeButton.disabled) return;
  const original = els.summaryMergeButton.textContent;
  els.summaryMergeButton.disabled = true;
  els.summaryMergeButton.textContent = "合并中";
  setSummaryActionStatus("DeepSeek 正在合并所选摘要...");
  const result = await postJson("/api/summary/merge", {
    summaryIds: ids,
    archiveSource: false,
  }, { timeoutMs: 120000 });
  els.summaryMergeButton.textContent = original;
  if (result) {
    state.summarySelectedIds.clear();
    const note = result.fallback
      ? "模型合并失败，已用本地保底合并；确认合并内容后可手动隐藏旧摘要。"
      : "合并完成，请确认新摘要内容后手动隐藏旧条目。";
    setSummaryActionStatus(note, "success");
    refreshSummaries();
  } else {
    setSummaryActionStatus("合并失败，错误已显示在聊天页顶部。", "error");
    renderSummaryBulkControls();
  }
}

function splitTags(text) {
  return String(text || "")
    .split(/[,，\n]/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatSummaryDay(day) {
  if (!day || day === "unknown") return "未知日期";
  try {
    const parts = day.split("-");
    return `${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
  } catch {
    return day;
  }
}

// Message-level search
let msgSearchTimer = null;

function speakerLabel(speaker) {
  switch (speaker) {
    case "codex": return "Codex";
    case "claude": return "Claude Code";
    case "deepseek": return "DeepSeek";
    case "gemini": return "Gemini";
    case "system": return "System";
    default: return "User";
  }
}

function fmtMsgTime(at) {
  if (!at) return "";
  try {
    const d = new Date(at);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch { return ""; }
}

function highlightQuery(text, query) {
  if (!query || !text) return escapeHtml(text || "");
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((p) => p.toLowerCase() === query.toLowerCase()
    ? `<mark>${escapeHtml(p)}</mark>`
    : escapeHtml(p)
  ).join("");
}

function renderMsgSearchResult(item, query) {
  const card = document.createElement("article");
  card.className = "msg-search-result";

  const container = item.container || {};
  const roomLabel = container.title || item.topicTitle || item.topicId;
  const meta = document.createElement("div");
  meta.className = "msg-search-result-meta";
  const timeStr = fmtMsgTime(item.matchMessage.at);
  meta.textContent = `${roomLabel}${timeStr ? " · " + timeStr : ""}`;
  card.append(meta);

  const ctx = [...item.contextBefore, { ...item.matchMessage, isMatch: true }, ...item.contextAfter];
  for (const msg of ctx) {
    const row = document.createElement("div");
    row.className = `msg-search-msg${msg.isMatch ? " match" : ""}`;
    const name = document.createElement("span");
    name.className = "msg-search-speaker";
    name.textContent = speakerLabel(msg.speaker);
    const text = document.createElement("span");
    text.className = "msg-search-text";
    text.innerHTML = msg.isMatch ? highlightQuery(msg.text, query) : escapeHtml(msg.text || "");
    row.append(name, text);
    card.append(row);
  }

  card.addEventListener("click", async () => {
    const ct = item.container || {};
    if (ct.type === "fixed" && ct.id) {
      await postJson("/api/open-room", { roomId: ct.id }, { timeoutMs: 12000 });
    } else if (ct.type === "direct" && ct.id) {
      await postJson("/api/open-direct", { id: ct.id }, { timeoutMs: 12000 });
    } else if (item.topicId) {
      await postJson("/api/open-topic", { id: item.topicId }, { timeoutMs: 12000 });
    }
    clearMsgSearch();
    scrollToMessage(searchTargetMessageId(item));
  });

  return card;
}

function renderMemorySearchResult(item, query) {
  const card = document.createElement("article");
  card.className = "msg-search-result";

  const source = item.source || item;
  const container = source.container || item.container || {};
  const roomLabel = container.title || source.topicTitle || item.topicTitle || source.topicId || item.topicId;
  const meta = document.createElement("div");
  meta.className = "msg-search-result-meta";
  const createdAt = item.createdAt || item.matchMessage?.at || "";
  const timeStr = fmtMsgTime(createdAt);
  meta.textContent = `${item.type === "summary" ? "Summary" : "Message"} · ${roomLabel}${timeStr ? " · " + timeStr : ""}`;
  card.append(meta);

  if (item.type === "summary") {
    const text = document.createElement("div");
    text.className = "msg-search-summary-text";
    text.innerHTML = highlightQuery(item.text || "", query);
    card.append(text);
    for (const detail of [...(item.decisions || []), ...(item.openItems || [])].slice(0, 3)) {
      const row = document.createElement("div");
      row.className = "msg-search-summary-detail";
      row.textContent = detail;
      card.append(row);
    }
  } else {
    const matchMessage = item.matchMessage || {
      speaker: item.speaker,
      text: item.text,
      at: item.createdAt,
    };
    const ctx = [...(item.contextBefore || []), { ...matchMessage, isMatch: true }, ...(item.contextAfter || [])];
    for (const msg of ctx) {
      const row = document.createElement("div");
      row.className = `msg-search-msg${msg.isMatch ? " match" : ""}`;
      const name = document.createElement("span");
      name.className = "msg-search-speaker";
      name.textContent = speakerLabel(msg.speaker);
      const text = document.createElement("span");
      text.className = "msg-search-text";
      text.innerHTML = msg.isMatch ? highlightQuery(msg.text, query) : escapeHtml(msg.text || "");
      row.append(name, text);
      card.append(row);
    }
  }

  card.addEventListener("click", async () => {
    const ct = container || {};
    const topicId = source.topicId || item.topicId;
    if ((ct.type === "fixed" || ct.type === "fixed_room") && ct.id) {
      await postJson("/api/open-room", { roomId: ct.id }, { timeoutMs: 12000 });
    } else if ((ct.type === "direct" || ct.type === "direct_chat") && ct.id) {
      await postJson("/api/open-direct", { id: ct.id }, { timeoutMs: 12000 });
    } else if (topicId) {
      await postJson("/api/open-topic", { id: topicId }, { timeoutMs: 12000 });
    }
    clearMsgSearch();
    scrollToMessage(searchTargetMessageId(item));
  });

  return card;
}

function clearMsgSearch() {
  if (els.msgSearchResults) {
    els.msgSearchResults.replaceChildren();
    els.msgSearchResults.hidden = true;
  }
  if (els.msgSearchInput) els.msgSearchInput.value = "";
  if (els.memoryProjectInput) els.memoryProjectInput.value = "";
}

// ── Search overlay ────────────────────────────────
let searchOverlayType = "all";
let searchOverlayTimer = null;
let searchOverlayCachedItems = [];
let searchOverlayCachedQuery = "";

function fmtDayGroup(at) {
  if (!at) return "未知日期";
  const d = new Date(at);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (+msgDay === +today) return "今天";
  if (+msgDay === +yesterday) return "昨天";
  const yearPrefix = d.getFullYear() !== now.getFullYear() ? `${d.getFullYear()} · ` : "";
  return `${yearPrefix}${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

function getItemTime(item) {
  return item.matchMessage?.at || item.createdAt || item.at || "";
}

function renderOverlayResult(item, query) {
  const card = document.createElement("article");
  card.className = "search-overlay-result";

  const source = item.source || item;
  const container = source.container || item.container || {};
  const roomLabel = container.title || source.topicTitle || item.topicTitle || source.topicId || item.topicId || "";
  const timeAt = getItemTime(item);
  const timeStr = fmtMsgTime(timeAt);

  const meta = document.createElement("div");
  meta.className = "search-result-meta";
  const badge = document.createElement("span");
  badge.className = `search-result-type-badge ${item.type === "summary" ? "summary" : "message"}`;
  badge.textContent = item.type === "summary" ? "总结" : "消息";
  const room = document.createElement("span");
  room.className = "search-result-room";
  room.textContent = roomLabel;
  const time = document.createElement("span");
  time.className = "search-result-time";
  time.textContent = timeStr;
  meta.append(badge, room, time);
  card.append(meta);

  if (item.type === "summary") {
    const text = document.createElement("div");
    text.className = "msg-search-summary-text";
    text.innerHTML = highlightQuery(item.text || "", query);
    card.append(text);
    for (const detail of [...(item.decisions || []), ...(item.openItems || [])].slice(0, 3)) {
      const row = document.createElement("div");
      row.className = "msg-search-summary-detail";
      row.textContent = detail;
      card.append(row);
    }
  } else {
    const matchMessage = item.matchMessage || { speaker: item.speaker, text: item.text, at: item.createdAt };
    const ctx = [...(item.contextBefore || []), { ...matchMessage, isMatch: true }, ...(item.contextAfter || [])];
    for (const msg of ctx) {
      const row = document.createElement("div");
      row.className = `msg-search-msg${msg.isMatch ? " match" : ""}`;
      const name = document.createElement("span");
      name.className = "msg-search-speaker";
      name.textContent = speakerLabel(msg.speaker);
      const txt = document.createElement("span");
      txt.className = "msg-search-text";
      txt.innerHTML = msg.isMatch ? highlightQuery(msg.text, query) : escapeHtml(msg.text || "");
      row.append(name, txt);
      card.append(row);
    }
  }

  card.addEventListener("click", async () => {
    const ct = container;
    const topicId = source.topicId || item.topicId;
    if ((ct.type === "fixed" || ct.type === "fixed_room") && ct.id) {
      await postJson("/api/open-room", { roomId: ct.id }, { timeoutMs: 12000 });
    } else if ((ct.type === "direct" || ct.type === "direct_chat") && ct.id) {
      await postJson("/api/open-direct", { id: ct.id }, { timeoutMs: 12000 });
    } else if (topicId) {
      await postJson("/api/open-topic", { id: topicId }, { timeoutMs: 12000 });
    }
    closeSearchOverlay();
    scrollToMessage(searchTargetMessageId(item));
  });

  return card;
}

function renderOverlayResults(items, query) {
  const container = els.searchOverlayResults;
  if (!container) return;
  if (!items.length) {
    container.innerHTML = '<p class="search-overlay-hint">没有找到相关内容</p>';
    return;
  }

  const filtered = searchOverlayType === "all" ? items
    : items.filter((i) => i.type === searchOverlayType);

  if (!filtered.length) {
    const typeName = searchOverlayType === "message" ? "消息" : "总结";
    container.innerHTML = `<p class="search-overlay-hint">没有匹配的${typeName}</p>`;
    return;
  }

  const count = document.createElement("div");
  count.className = "search-overlay-count";
  count.textContent = `共 ${filtered.length} 条结果`;

  const grouped = new Map();
  for (const item of filtered) {
    const day = fmtDayGroup(getItemTime(item));
    if (!grouped.has(day)) grouped.set(day, []);
    grouped.get(day).push(item);
  }

  const frag = document.createDocumentFragment();
  frag.append(count);
  for (const [day, dayItems] of grouped) {
    const group = document.createElement("div");
    group.className = "search-day-group";
    const label = document.createElement("div");
    label.className = "search-day-label";
    label.textContent = day;
    group.append(label);
    for (const item of dayItems) {
      group.append(renderOverlayResult(item, query));
    }
    frag.append(group);
  }
  container.replaceChildren(frag);
}

async function runOverlaySearch(query) {
  const container = els.searchOverlayResults;
  if (!query || !container) {
    if (container) container.innerHTML = '<p class="search-overlay-hint">输入关键词开始搜索</p>';
    return;
  }
  container.innerHTML = '<p class="search-overlay-hint">搜索中…</p>';
  try {
    const scope = els.searchOverlayScope?.value || "global";
    const params = new URLSearchParams({ q: query, scope, limit: "20", context: "2" });
    const data = await fetchJson(`/api/memory/search?${params.toString()}`);
    searchOverlayCachedItems = Array.isArray(data.items) ? data.items : [];
    searchOverlayCachedQuery = query;
    renderOverlayResults(searchOverlayCachedItems, query);
  } catch {
    if (container) container.innerHTML = '<p class="search-overlay-hint">搜索失败，请重试</p>';
  }
}

function openSearchOverlay(initialQuery = "") {
  if (!els.searchOverlay) return;
  searchOverlayType = "all";
  for (const t of els.searchTypeTabs) t.classList.toggle("active", t.dataset.type === "all");
  els.searchOverlay.hidden = false;
  document.body.style.overflow = "hidden";
  const query = initialQuery || searchOverlayCachedQuery;
  if (els.searchOverlayInput) {
    els.searchOverlayInput.value = query;
    requestAnimationFrame(() => els.searchOverlayInput.focus());
  }
  if (query && searchOverlayCachedItems.length && query === searchOverlayCachedQuery) {
    renderOverlayResults(searchOverlayCachedItems, query);
  } else if (query) {
    runOverlaySearch(query);
  } else {
    clearSearchOverlayResults();
  }
}

function closeSearchOverlay() {
  if (!els.searchOverlay) return;
  clearTimeout(searchOverlayTimer);
  els.searchOverlay.hidden = true;
  document.body.style.overflow = "";
  if (els.msgSearchInput) els.msgSearchInput.value = "";
}

function clearSearchOverlayResults() {
  if (!els.searchOverlayResults) return;
  els.searchOverlayResults.scrollTop = 0;
  els.searchOverlayResults.innerHTML = '<p class="search-overlay-hint">输入关键词开始搜索</p>';
}

if (els.searchOverlayClose) {
  els.searchOverlayClose.addEventListener("click", closeSearchOverlay);
}
if (els.searchOverlayBackdrop) {
  els.searchOverlayBackdrop.addEventListener("click", closeSearchOverlay);
}

if (els.searchOverlayInput) {
  els.searchOverlayInput.addEventListener("input", () => {
    clearTimeout(searchOverlayTimer);
    const q = els.searchOverlayInput.value.trim();
    searchOverlayTimer = setTimeout(() => runOverlaySearch(q), 280);
  });
  els.searchOverlayInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSearchOverlay();
  });
}

if (els.searchOverlayScope) {
  els.searchOverlayScope.addEventListener("change", () => {
    const q = els.searchOverlayInput?.value.trim() || "";
    if (q) runOverlaySearch(q);
  });
}

for (const tab of els.searchTypeTabs) {
  tab.addEventListener("click", () => {
    searchOverlayType = tab.dataset.type || "all";
    for (const t of els.searchTypeTabs) t.classList.toggle("active", t === tab);
    if (searchOverlayCachedItems.length) {
      renderOverlayResults(searchOverlayCachedItems, searchOverlayCachedQuery);
    }
  });
}

document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    openSearchOverlay();
  }
});

async function runMsgSearch(query) {
  if (!query || !els.msgSearchResults) {
    if (els.msgSearchResults) {
      els.msgSearchResults.replaceChildren();
      els.msgSearchResults.hidden = true;
    }
    return;
  }
  try {
    const data = await fetchMemorySearch(query);
    if (!els.msgSearchResults) return;
    if (!Array.isArray(data.items) || !data.items.length) {
      els.msgSearchResults.innerHTML = '<p class="msg-search-empty">No matching memory.</p>';
      els.msgSearchResults.hidden = false;
      return;
    }
    els.msgSearchResults.replaceChildren(...data.items.map((item) => renderMemorySearchResult(item, query)));
    els.msgSearchResults.hidden = false;
  } catch (error) {
    if (els.msgSearchResults) {
      els.msgSearchResults.innerHTML = `<p class="msg-search-empty">${escapeHtml(error?.message || "Search failed.")}</p>`;
      els.msgSearchResults.hidden = false;
    }
  }
}

async function fetchMemorySearch(query) {
  const scope = els.memoryScopeSelect?.value || "global";
  const project = scope === "project" ? (els.memoryProjectInput?.value || "").trim() : "";
  const params = new URLSearchParams({
    q: query,
    scope,
    limit: "10",
    context: "3",
  });
  if (project) params.set("project", project);
  try {
    return await fetchJson(`/api/memory/search?${params.toString()}`);
  } catch (error) {
    const fallback = await fetchJson(`/api/messages/search?q=${encodeURIComponent(query)}&scope=${encodeURIComponent(scope)}&limit=10&context=3`);
    return {
      ...fallback,
      items: (fallback.items || []).map((item) => ({ ...item, type: "message" })),
      fallback: true,
      fallbackReason: error?.message || "memory endpoint unavailable",
    };
  }
}

function refreshMemoryProjectInput() {
  if (!els.memoryProjectInput) return;
  els.memoryProjectInput.hidden = (els.memoryScopeSelect?.value || "global") !== "project";
}

if (els.msgSearchInput) {
  els.msgSearchInput.addEventListener("focus", () => {
    const q = els.msgSearchInput.value.trim();
    openSearchOverlay(q);
    els.msgSearchInput.blur();
  });
  els.msgSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") clearMsgSearch();
  });
}

els.memoryScopeSelect?.addEventListener("change", () => {
  refreshMemoryProjectInput();
});

els.memoryProjectInput?.addEventListener("input", () => {
  clearTimeout(msgSearchTimer);
});

refreshMemoryProjectInput();

refreshState();
setInterval(() => {
  if (document.hidden) return;
  refreshState({ silentTimeout: true });
}, 1200);
refreshStorage();
setInterval(refreshStorage, 10000);
refreshNotebook();
refreshStudyTracker();
setInterval(refreshStudyTracker, 15000);
