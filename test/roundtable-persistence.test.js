const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { RoundtableCheckinStore } = require("../src/app/roundtable-checkin");
const { RoundtableServer, StorageStore, buildRuntimeStatus } = require("../src/app/roundtable-server");
const { RoundtableStore, StudyTrackerStore } = require("../src/app/roundtable-store");
const { SessionStore } = require("../src/adapters/runtime/codex/session-store");
const { runMigrations } = require("../src/db/connection");

test("check-ins persist through SQLite", () => {
  const { db } = createDb();
  const first = new RoundtableCheckinStore({ db });
  first.setNextAt("codex", "2026-05-17T08:00:00.000Z", {
    enabled: true,
    minIntervalMs: 1000,
    maxIntervalMs: 2000,
  });
  first.recordAction("codex", {
    action: "silent",
    reason: "quiet room",
  });

  const second = new RoundtableCheckinStore({ db });
  const codex = second.getSpeaker("codex");

  assert.equal(codex.nextAt, "2026-05-17T08:00:00.000Z");
  assert.equal(codex.lastAction, "silent");
  assert.equal(codex.lastReason, "quiet room");
  assert.equal(second.snapshot().speakers.codex.maxIntervalMs, 2000);
});

test("storage entries persist through SQLite", () => {
  const { db } = createDb();
  const storage = newStorageStore(db);
  const saved = storage.add({
    title: "note",
    summary: "stored in db",
    tags: ["roundtable"],
  });

  const listed = newStorageStore(db).list();

  assert.equal(listed[0].id, saved.id);
  assert.equal(listed[0].summary, "stored in db");
  assert.deepEqual(listed[0].tags, ["roundtable"]);
  assert.equal(newStorageStore(db).remove(saved.id), true);
  assert.deepEqual(newStorageStore(db).list(), []);
});

test("hidden recent topic ids persist through SQLite snapshots", () => {
  const { db } = createDb();
  const store = new RoundtableStore({ db });

  store.hideTopicFromSidebar("topic-old");

  assert.deepEqual(store.snapshot().hiddenTopicIds, ["topic-old"]);
  assert.deepEqual(new RoundtableStore({ db }).snapshot().hiddenTopicIds, ["topic-old"]);
});

test("study tracker persists through SQLite", () => {
  const { db } = createDb();
  const tracker = new StudyTrackerStore({ db });
  tracker.upsertOverview({
    currentGoal: "IELTS 5.5",
    currentPhase: "diagnosis",
    currentScores: { listening: "4.5-5" },
    mainRisks: ["speaking"],
    nextThreeDays: ["baseline"],
  });
  tracker.upsertPlanEntry({
    date: "2026-05-18",
    phase: "diagnosis",
    focus: "baseline",
    tasks: ["listening slice"],
    targetMetrics: ["identify weak spots"],
    reviewPlan: ["review listening errors"],
    teacherNotes: "start with diagnosis",
  });
  tracker.upsertProgressEntry({
    date: "2026-05-18",
    actualCompleted: "listening slice",
    evidence: "score sheet",
    selfNote: "maps are hard",
    teacherFeedback: "review maps",
    reviewDebt: ["maps"],
    nextAdjustment: "repeat P2 maps",
  });

  const snapshot = new StudyTrackerStore({ db }).snapshot();
  assert.equal(snapshot.overview.currentGoal, "IELTS 5.5");
  assert.deepEqual(snapshot.overview.mainRisks, ["speaking"]);
  assert.equal(snapshot.planEntries[0].focus, "baseline");
  assert.deepEqual(snapshot.progressEntries[0].reviewDebt, ["maps"]);
});

test("runtime sessions persist through SQLite", () => {
  const { db } = createDb();
  const first = new SessionStore({ db, runtimeId: "codex" });
  first.setThreadIdForWorkspace("roundtable:topic-1:codex", "C:\\work", "thread-1");
  first.setRuntimeParamsForWorkspace("roundtable:topic-1:codex", "C:\\work", { model: "gpt-5.5" });

  const second = new SessionStore({ db, runtimeId: "codex" });

  assert.equal(
    second.getThreadIdForWorkspace("roundtable:topic-1:codex", "C:\\work"),
    "thread-1",
  );
  assert.equal(
    second.getRuntimeParamsForWorkspace("roundtable:topic-1:codex", "C:\\work").model,
    "gpt-5.5",
  );
});

test("message attachments persist through SQLite", () => {
  const { db } = createDb();
  const first = new RoundtableStore({ db });
  first.replace({
    id: "topic-1",
    topic: "临时｜附件",
    messages: [{
      id: "m1",
      speaker: "user",
      text: "看一下",
      attachments: [{
        name: "diagram.png",
        url: "/uploads/2026-05-17/diagram.png",
        mimeType: "image/png",
        size: 1234,
      }],
    }],
  });

  const second = new RoundtableStore({ db });
  assert.deepEqual(second.get().messages[0].attachments, [{
    name: "diagram.png",
    url: "/uploads/2026-05-17/diagram.png",
    mimeType: "image/png",
    size: 1234,
  }]);
});

test("voice message metadata persists through SQLite", () => {
  const { db } = createDb();
  const first = new RoundtableStore({ db });
  first.replace({
    id: "topic-1",
    topic: "temporary voice",
    messages: [{
      id: "m1",
      speaker: "codex",
      text: "User, listen.",
      audioUrl: "/uploads/2026-05-22/codex.mp3",
      voiceOnly: true,
    }],
  });

  const message = new RoundtableStore({ db }).get().messages[0];
  assert.equal(message.audioUrl, "/uploads/2026-05-22/codex.mp3");
  assert.equal(message.voiceOnly, true);
});

test("voice TTS success preserves transcript text", async () => {
  const store = makeMutableStore({
    id: "topic-1",
    messages: [{
      id: "m1",
      speaker: "codex",
      text: "用户，听得到吗？",
      voiceOnly: true,
    }],
  });
  const app = makeTtsAppLike(store, {
    elevenLabsApiKey: "test-key",
    elevenLabsVoiceCodex: "codex-voice",
  });
  app.generateAndSaveTts = async ({ text }) => {
    assert.equal(text, "用户，听得到吗？");
    return "/uploads/2026-05-23/codex.mp3";
  };

  const ok = await RoundtableServer.prototype.maybeRunTts.call(app, {
    speaker: "codex",
    messageId: "m1",
  });

  assert.equal(ok, true);
  assert.equal(store.current.messages[0].text, "用户，听得到吗？");
  assert.equal(store.current.messages[0].voiceOnly, true);
  assert.equal(store.current.messages[0].audioUrl, "/uploads/2026-05-23/codex.mp3");
});

test("voice TTS missing config falls back to visible text", async () => {
  const store = makeMutableStore({
    id: "topic-1",
    messages: [{
      id: "m1",
      speaker: "claude",
      text: "我先用文字留下来。",
      voiceOnly: true,
    }],
  });
  const app = makeTtsAppLike(store, {});

  const ok = await RoundtableServer.prototype.maybeRunTts.call(app, {
    speaker: "claude",
    messageId: "m1",
  });

  assert.equal(ok, false);
  assert.equal(store.current.messages[0].text, "我先用文字留下来。");
  assert.equal(store.current.messages[0].voiceOnly, false);
  assert.equal(store.current.messages[0].audioUrl, "");
});

test("transient updates stay in memory until explicitly saved", () => {
  const { db } = createDb();
  const store = new RoundtableStore({ db });
  store.replace({
    id: "topic-1",
    topic: "临时｜流式",
    messages: [{ id: "m1", speaker: "codex", text: "", pending: true }],
  });

  store.updateTransient((draft) => {
    draft.messages[0].text = "partial";
    return draft;
  });

  assert.equal(store.get().messages[0].text, "partial");
  assert.equal(
    new RoundtableStore({ db }).get().messages[0].text,
    "Previous run was interrupted by server restart.",
  );

  store.save();
  assert.equal(new RoundtableStore({ db }).get().messages[0].text, "partial");
});

test("runtime worklog persists as append-only message timeline", () => {
  const { db } = createDb();
  const store = new RoundtableStore({ db });
  store.replace({
    id: "topic-1",
    topic: "runtime worklog",
    messages: [{ id: "codex-1", speaker: "codex", text: "done", pending: false }],
  });

  store.upsertRuntimeRun("topic-1", {
    id: "runtime_turn:codex-1",
    kind: "runtime_turn",
    speaker: "codex",
    status: "completed",
    phase: "completed",
    messageId: "codex-1",
    startedAt: "2026-05-20T06:00:00.000Z",
    endedAt: "2026-05-20T06:00:02.000Z",
  });
  store.appendRuntimeWorklogEvent("topic-1", {
    runId: "runtime_turn:codex-1",
    messageId: "codex-1",
    type: "run.started",
    title: "Queued",
    detail: { phase: "queued" },
    createdAt: "2026-05-20T06:00:01.000Z",
  });
  store.appendRuntimeWorklogEvent("topic-1", {
    runId: "runtime_turn:codex-1",
    messageId: "codex-1",
    type: "run.completed",
    title: "Completed",
    createdAt: "2026-05-20T06:00:02.000Z",
  });

  const reloaded = new RoundtableStore({ db });
  const snapshot = reloaded.runtimeWorklogSnapshot({ topicId: "topic-1" });

  assert.equal(reloaded.get().runtimeRuns[0].id, "runtime_turn:codex-1");
  assert.equal(snapshot.events.length, 2);
  assert.equal(snapshot.byMessageId["codex-1"].events[1].type, "run.completed");
  assert.match(snapshot.byMessageId["codex-1"].summary, /completed/);
});

test("runtime store closes pending turns when a server restarts", () => {
  const { db } = createDb();
  const first = new RoundtableStore({ db });
  first.replace({
    id: "topic-1",
    topic: "临时｜重启恢复",
    running: true,
    status: "codex thinking",
    messages: [{
      id: "codex-pending",
      speaker: "codex",
      text: "partial reply",
      pending: true,
      at: "2026-05-20T06:00:00.000Z",
    }],
    runtimeRuns: [{
      id: "runtime_turn:codex-pending",
      kind: "runtime_turn",
      speaker: "codex",
      status: "running",
      phase: "replying",
      messageId: "codex-pending",
      startedAt: "2026-05-20T06:00:00.000Z",
    }],
  });

  const recovered = new RoundtableStore({ db }).get();

  assert.equal(recovered.running, false);
  assert.equal(recovered.status, "paused");
  assert.equal(recovered.messages[0].pending, false);
  assert.equal(recovered.messages[0].text, "partial reply");
});

test("runtime status reports active work and supplement mode", () => {
  const status = buildRuntimeStatus({
    id: "topic-1",
    topic: "临时｜状态",
    running: true,
    status: "codex thinking",
    round: 0,
    maxRounds: 4,
    nextSpeaker: "codex",
    messages: [{
      id: "codex-pending",
      speaker: "codex",
      text: "",
      pending: true,
      at: "2026-05-20T06:00:00.000Z",
    }],
    pendingApprovals: [],
  });

  assert.equal(status.busy, true);
  assert.equal(status.userMessageMode, "supplement");
  assert.equal(status.speakers.find((item) => item.speaker === "codex").status, "running");
  assert.equal(status.activeRuns[0].speaker, "codex");
});

test("runtime status keeps server tracked runtime runs visible after completion", () => {
  const status = buildRuntimeStatus({
    id: "topic-1",
    topic: "临时｜状态账本",
    running: false,
    status: "ready",
    messages: [],
    runtimeRuns: [{
      id: "runtime_turn:codex-1",
      kind: "runtime_turn",
      speaker: "codex",
      status: "completed",
      title: "Working",
      phase: "completed",
      startedAt: "2026-05-20T06:00:00.000Z",
      endedAt: "2026-05-20T06:01:00.000Z",
    }],
  });

  assert.equal(status.busy, false);
  assert.equal(status.activeRuns.length, 0);
  assert.equal(status.recentRuns[0].speaker, "codex");
  assert.equal(status.recentRuns[0].status, "completed");
});

test("runtime status closes orphaned active runs when no work remains", () => {
  const status = buildRuntimeStatus({
    id: "topic-1",
    topic: "临时｜孤立状态",
    running: false,
    status: "ready",
    messages: [{ id: "codex-message", speaker: "codex", text: "done", pending: false }],
    runtimeRuns: [{
      id: "runtime_turn:codex-message",
      kind: "runtime_turn",
      speaker: "codex",
      status: "running",
      title: "Working",
      phase: "replying",
      messageId: "codex-message",
      startedAt: "2026-05-20T06:00:00.000Z",
      updatedAt: "2026-05-20T06:01:00.000Z",
    }],
  });

  assert.equal(status.busy, false);
  assert.equal(status.activeRuns.length, 0);
  assert.equal(status.recentRuns[0].status, "interrupted");
  assert.equal(status.recentRuns[0].phase, "orphaned");
});

test("runtime status keeps recently updated runtime turns visible while confirming", () => {
  const now = new Date().toISOString();
  const status = buildRuntimeStatus({
    id: "topic-1",
    topic: "temporary status",
    running: false,
    status: "ready",
    messages: [{ id: "codex-message", speaker: "codex", text: "", pending: false }],
    runtimeRuns: [{
      id: "runtime_turn:codex-message",
      kind: "runtime_turn",
      speaker: "codex",
      status: "running",
      title: "Working",
      phase: "replying",
      messageId: "codex-message",
      threadId: "thread-1",
      turnId: "turn-1",
      startedAt: now,
      updatedAt: now,
    }],
  });

  assert.equal(status.busy, true);
  assert.equal(status.activeRuns.length, 1);
  assert.equal(status.activeRuns[0].speaker, "codex");
  assert.equal(status.activeRuns[0].phase, "replying");
});

test("user messages do not interrupt active work by default", () => {
  const appLike = {
    autoRunToken: 7,
    store: makeMutableStore({
      id: "topic-1",
      topic: "临时｜补充",
      running: true,
      status: "codex thinking",
      messages: [{
        id: "codex-pending",
        speaker: "codex",
        text: "",
        pending: true,
      }],
    }),
  };

  RoundtableServer.prototype.addUserMessage.call(appLike, { text: "补充一点" });

  assert.equal(appLike.autoRunToken, 7);
  assert.equal(appLike.store.current.running, true);
  assert.equal(appLike.store.current.messages[0].pending, true);
  assert.equal(appLike.store.current.messages[1].speaker, "user");
  assert.equal(appLike.store.current.messages[1].supplemental, true);
});

test("user messages can explicitly interrupt active work", () => {
  const appLike = {
    autoRunToken: 7,
    store: makeMutableStore({
      id: "topic-1",
      topic: "临时｜中断",
      running: true,
      status: "codex thinking",
      messages: [{
        id: "codex-pending",
        speaker: "codex",
        text: "",
        pending: true,
      }],
    }),
  };

  RoundtableServer.prototype.addUserMessage.call(appLike, { text: "停一下", interrupt: true });

  assert.equal(appLike.autoRunToken, 8);
  assert.equal(appLike.store.current.running, false);
  assert.equal(appLike.store.current.status, "paused");
  assert.equal(appLike.store.current.messages[0].pending, false);
});

test("message search scopes results by room and project", () => {
  const { db } = createDb();
  const store = new RoundtableStore({ db });
  store.replace({
    id: "topic-main",
    topic: "Fixed main",
    container: { type: "fixed_room", id: "main", title: "Main" },
    messages: [{ id: "main-1", speaker: "user", text: "apple from main room" }],
    fixedRooms: {
      main: { title: "Main", topicTitle: "Fixed main", topicId: "topic-main" },
    },
    directChats: {
      codex: { title: "Codex", icon: "C", topicTitle: "Direct Codex", topicId: "topic-codex" },
      code: { title: "Claude Code", icon: "A", topicTitle: "Direct Claude", topicId: "topic-claude" },
    },
    sidebarProjects: [{
      id: "project-stack",
      title: "Stack-chan",
      topicId: "topic-stack",
      topicTitle: "Project Stack",
    }],
    topics: [
      {
        id: "topic-codex",
        topic: "Direct Codex",
        container: { type: "direct_chat", id: "codex", title: "Codex" },
        messages: [{ id: "codex-1", speaker: "user", text: "apple from codex chat" }],
      },
      {
        id: "topic-claude",
        topic: "Direct Claude",
        container: { type: "direct_chat", id: "code", title: "Claude Code" },
        messages: [{ id: "claude-1", speaker: "user", text: "apple from claude chat" }],
      },
      {
        id: "topic-temp",
        topic: "Temporary",
        container: { type: "temporary", id: "topic-temp", title: "Temporary" },
        messages: [{ id: "temp-1", speaker: "user", text: "apple from temporary topic" }],
      },
      {
        id: "topic-stack",
        topic: "Project Stack",
        container: { type: "project", id: "project-stack", title: "Stack-chan" },
        messages: [{ id: "stack-1", speaker: "user", text: "apple from stack project" }],
      },
    ],
  });

  assert.deepEqual(searchTopicIds(store, { scope: "main" }), ["topic-main"]);
  assert.deepEqual(searchTopicIds(store, { scope: "codex" }), ["topic-codex"]);
  assert.deepEqual(searchTopicIds(store, { scope: "claude" }), ["topic-claude"]);
  assert.deepEqual(searchTopicIds(store, { scope: "temporary" }), ["topic-temp"]);
  assert.deepEqual(searchTopicIds(store, { scope: "project", project: "Stack-chan" }), ["topic-stack"]);
  assert.deepEqual(new Set(searchTopicIds(store, { scope: "global" })), new Set([
    "topic-main",
    "topic-codex",
    "topic-claude",
    "topic-temp",
    "topic-stack",
  ]));
});

test("owner memory search combines summaries and messages across private scopes", async () => {
  const { db } = createDb();
  const appLike = makeMemorySearchAppLike(db);
  appLike.store.replace({
    id: "topic-codex",
    topic: "Direct Codex",
    container: { type: "direct_chat", id: "codex", title: "Codex" },
    messages: [{ id: "codex-1", speaker: "user", text: "apple raw codex", at: "2026-05-10T01:00:00.000Z" }],
    directChats: {
      codex: { title: "Codex", icon: "C", topicTitle: "Direct Codex", topicId: "topic-codex" },
      code: { title: "Claude Code", icon: "A", topicTitle: "Direct Claude", topicId: "topic-claude" },
    },
    topics: [{
      id: "topic-claude",
      topic: "Direct Claude",
      container: { type: "direct_chat", id: "code", title: "Claude Code" },
      messages: [{ id: "claude-1", speaker: "user", text: "apple raw claude", at: "2026-05-10T02:00:00.000Z" }],
    }],
  });

  const result = await RoundtableServer.prototype.searchMemoryForOwner.call(appLike, {
    query: "apple",
    scope: "global",
    limit: 10,
    context: 0,
  });

  assert.ok(result.searchedScopes.includes("codex"));
  assert.ok(result.searchedScopes.includes("claude"));
  assert.deepEqual(new Set(result.items.map((item) => item.source.topicId)), new Set([
    "topic-codex",
    "topic-claude",
  ]));
});

function createDb() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "roundtable-persistence-"));
  const dbPath = path.join(rootDir, "roundtable.db");
  return {
    db: runMigrations(dbPath, path.join(__dirname, "..", "migrations")),
  };
}

function newStorageStore(db) {
  return new StorageStore({ db });
}

function makeMemorySearchAppLike(db) {
  return {
    store: new RoundtableStore({ db }),
    summaryStore: {
      search() {
        return { items: [] };
      },
    },
  };
}

function makeMutableStore(initial) {
  return {
    current: structuredClone(initial),
    get() {
      return structuredClone(this.current);
    },
    update(mutator) {
      const draft = structuredClone(this.current);
      this.current = mutator(draft) || draft;
    },
  };
}

function makeTtsAppLike(store, config) {
  return {
    config: {
      stateDir: os.tmpdir(),
      ...config,
    },
    store,
    fallbackVoiceMessageToText(messageId, reason) {
      return RoundtableServer.prototype.fallbackVoiceMessageToText.call(this, messageId, reason);
    },
  };
}

function searchTopicIds(store, options) {
  return store.searchMessages({
    query: "apple",
    limit: 10,
    contextSize: 0,
    ...options,
  }).items.map((item) => item.topicId).sort();
}
