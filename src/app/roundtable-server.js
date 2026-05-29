const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { URL } = require("url");
let dotenv = null;
try {
  dotenv = require("dotenv");
} catch {
  // dotenv is optional for tests and packaged installs.
}

const { readConfig } = require("../core/config");
const {
  RoundtableCheckinPoller,
  RoundtableCheckinStore,
  parseRoundtableCheckinResponse,
  resolveManualCheckinDelayMs,
  resolveRequestedCheckinDelayMs,
} = require("./roundtable-checkin");
const {
  SummaryStore,
  buildDeepSeekSummaryMergeMessages,
  buildDeepSeekSummaryMessages,
  buildLocalMergedSummary,
  buildSemanticInjectionNote,
  buildSummaryInjectionNote,
  buildSummaryContextNote,
  formatSummaryForChat,
  normalizeDeepSeekSummary,
  normalizeMergedDeepSeekSummary,
  resolveSummaryMessages,
} = require("./roundtable-summary");
const {
  clampInteger,
  normalizeAttachments,
  normalizeIsoText,
  normalizeSpeakerTarget,
  normalizeText,
  normalizeTextArray,
  readFirstEnv,
  speakerLabel,
  uniqueTextArray,
} = require("./roundtable-utils");
const {
  contentTypeForAttachment,
  resolveUploadPath,
  saveBase64Attachment,
} = require("./roundtable-upload");
const {
  DEFAULT_MAX_ROUNDS,
  archiveCurrentTopic,
  defaultProjectIcon,
  emptyRoundtableState,
  hasTopicContainer,
  normalizeDirectChats,
  normalizeFixedRooms,
  normalizeLastSeenMessageIdBySpeaker,
  normalizeSidebarProjects,
  normalizeTopicContainer,
  relinkDirectChatIfNeeded,
  relinkFixedRoomIfNeeded,
  relinkSidebarProjectIfNeeded,
  resolveTopicContainer,
  stripTopicPrefix,
  upsertSidebarProject,
} = require("./roundtable-state");
const {
  RoundtableStore,
  StorageStore,
  StudyTrackerStore,
} = require("./roundtable-store");
const { searchMemoryWithClient } = require("./roundtable-memory-search");
const {
  RuntimeHub,
  buildSpeakerTurnKey,
  buildTurnKey,
  isCheckinThreadUnavailableError,
} = require("./roundtable-runtime");
const { callDeepSeek } = require("./roundtable-deepseek");
const { callGemini } = require("./roundtable-gemini");
const { generateEmbedding, cosineSimilarity } = require("./roundtable-embedding");
const { handleOtherworldApi } = require("./roundtable-otherworld");
const { hasVoicePrefix, stripVoicePrefix, generateAndSaveTts } = require("./roundtable-tts");
const {
  OTHERWORLD_SESSION_EVENT,
  buildOtherworldRuntimeContext,
  createOtherworldGame,
  formatOtherworldDisplayAction,
  formatOtherworldOpeningMessage,
  formatOtherworldWorldMessage,
  getOtherworldSessionId,
  isOtherworldRoomState,
  parseOtherworldAction,
  parseOtherworldCommand,
  processOtherworldPlayerTurn,
} = require("./roundtable-otherworld-room");
const {
  buildApprovalRuntimeResponse,
  clearPendingApprovalsForSpeaker,
  clearPendingApprovalsForTurn,
  findPendingApproval,
  normalizeApprovalDecision,
  normalizePendingApproval,
  normalizePendingApprovals,
  normalizeRequestId,
  removePendingApproval,
  shouldAutoApproveRoundtableTool,
  upsertPendingApproval,
} = require("./roundtable-approval");
const { runMigrations } = require("../db/connection");

const DEFAULT_PORT = 8787;
const MAX_BODY_BYTES = 20 * 1024 * 1024;
const MAX_HISTORY_MESSAGES = 28;
const NOTEBOOK_META_KEY = "roundtable_notebook_json";
const DEFAULT_NOTEBOOK = {
  version: 1,
  projects: [
    {
      id: "roundtable",
      title: "圆桌改造计划",
      targets: [
        {
          id: "context-prompts",
          title: "上下文和提示词",
          done: false,
          sections: {
            rules: [
              { id: "check-inbox-first", text: "AI 开工前先看当前话题、收件箱和对应卡片。", done: false },
            ],
            todo: [
              { id: "prompt-order", text: "梳理 Codex / Claude / check-in / 单聊 / 项目 / 固定房间的提示词拼接顺序。", done: false },
              { id: "prompt-tooling", text: "确认提示词是否工具化，哪些场景共用，哪些场景单独处理。", done: false },
              { id: "context-sources", text: "明确每次醒来读取的系统指令、圆桌指令、消息、摘要、本子、附件、记忆和工具说明。", done: false },
            ],
            bugs: [],
            notes: [
              { id: "prompt-modules", text: "相关模块：templates/roundtable-*-instructions.md；src/adapters/runtime/shared-instructions.js；src/app/roundtable-server.js 的 buildRuntimePrompt 和 check-in 上下文。", done: false },
            ],
          },
        },
        {
          id: "topics-rooms",
          title: "话题和房间",
          done: false,
          sections: {
            rules: [
              { id: "create-temporary-project-only", text: "新建只能创建临时话题和项目话题；创建后系统自动给 AI 上下文里的话题名加上临时或固定前缀，主页显示去掉前缀后的名字。", done: false },
              { id: "topic-drawer-scope", text: "话题框显示固定话题和已经归档过的话题；新建话题没有归档过时不会出现在话题框。", done: false },
              { id: "archive-restore-delete", text: "临时话题和项目话题可以从主页收进话题框，也可以从话题框恢复到主页或彻底删除；删除会清理话题、聊天记录、事件、摘要和绑定。", done: false },
              { id: "no-archive-fixed-direct", text: "固定房间和单聊不能删除，也不能归档。", done: false },
              { id: "rename-supported-topics", text: "临时话题、项目话题和两个自定义固定话题支持改名；后续话题名只能通过改名入口修改，改名后同步更新话题名。", done: false },
            ],
            todo: [
              { id: "remove-otherworld-room", text: "后续彻底移除固定旅社话题和旅社界面。", done: false },
              { id: "rename-feedback", text: "改名后增加明确反馈，不再需要切换页面确认名字是否变化。", done: false },
            ],
            bugs: [],
            notes: [
              { id: "rooms-modules", text: "相关模块：public/roundtable/app.js 的话题弹层、侧栏渲染、项目渲染；src/app/roundtable-state.js 的房间和话题绑定；src/app/roundtable-server.js 的打开房间、改名、删除和归档接口。", done: false },
            ],
          },
        },
        {
          id: "search",
          title: "搜索",
          done: false,
          sections: {
            rules: [
              { id: "search-jump-done", text: "搜索结果点击后可以跳转到原消息位置。", done: true },
            ],
            todo: [
              { id: "search-scope", text: "梳理消息搜索、记忆搜索、范围筛选和项目/房间限定。", done: false },
            ],
            bugs: [],
            notes: [
              { id: "search-modules", text: "若再次出问题，优先核对搜索结果点击处理、消息渲染 key、滚动定位和高亮逻辑。", done: false },
            ],
          },
        },
        {
          id: "summary-injection",
          title: "总结和注入",
          done: false,
          sections: {
            rules: [
              { id: "summary-hidden-chat", text: "摘要不出现在聊天区。", done: false },
              { id: "summary-manual", text: "摘要支持手动新增、手动合并。", done: false },
              { id: "summary-inject", text: "摘要支持注入给指定 AI，让该 AI 下次回复时看到。", done: false },
            ],
            todo: [],
            bugs: [],
            notes: [
              { id: "summary-modules", text: "相关模块：public/roundtable/app.js 的 summary timeline 和 summary injection；src/app/roundtable-summary.js 的摘要新增、合并、搜索、注入上下文。", done: false },
            ],
          },
        },
        {
          id: "data-persistence",
          title: "数据和持久化",
          done: false,
          sections: {
            rules: [
              { id: "notebook-storage-impl", text: "本子数据存 SQLite app_meta JSON blob，不新建表。/api/notebook 读写；docs/roundtable-notebook.md 作为人类可读版本，不参与运行时同步。", done: true },
            ],
            todo: [
              { id: "notebook-ui", text: "圆桌本子做成页面里的常驻区域，取代散落在聊天里的待办。", done: true },
              { id: "data-recovery", text: "梳理消息、附件、runtime session、摘要、本子和迁移的重启恢复路径。", done: false },
              { id: "legacy-compat", text: "核对旧数据兼容逻辑，特别是旧 notebook decisions 字段迁移。", done: false },
            ],
            bugs: [],
            notes: [
              { id: "data-modules", text: "相关模块：src/app/roundtable-store.js；src/app/roundtable-server.js 的 notebook API；migrations；SQLite app_meta。", done: false },
            ],
          },
        },
        {
          id: "work-errors-logs",
          title: "工作状态和报错日志",
          done: false,
          sections: {
            rules: [
              { id: "status-interrupt", text: "上方工作状态里的单个 AI 中断按钮保留，只中断对应 AI。", done: false },
              { id: "claude-empty-result-fallback", text: "Claude Code 空 result 时用 assistant 文本兜底，避免误报 returned no reply text。", done: true },
            ],
            todo: [
              { id: "composer-interrupt-label", text: "聊天输入框旁的中断按钮语义重新确定，并在界面上写清楚。", done: false },
              { id: "error-display-retry", text: "梳理运行状态、pending 消息、超时、错误展示和重试路径。", done: false },
            ],
            bugs: [
              { id: "empty-interrupt", text: "空输入时点击聊天框中断曾经没有反馈，需要核对当前行为。", done: false },
              { id: "runtime-stuck", text: "状态可能显示还在回复，但没有可中断的 active runtime。", done: false },
              { id: "claude-no-reply-text", text: "曾出现多次 claude returned no reply text，需要重启服务后验证是否消失。", done: false },
            ],
            notes: [
              { id: "work-modules", text: "相关模块：public/roundtable/app.js 的 submitUserMessage、工作状态按钮、输入框按钮；src/app/roundtable-server.js 的 runtime run、interruptSpeaker、pauseAutoRun；src/app/roundtable-runtime.js；src/adapters/runtime/claudecode。", done: false },
            ],
          },
        },
        {
          id: "voice",
          title: "语音",
          done: false,
          sections: {
            rules: [],
            todo: [
              { id: "voice-flow", text: "梳理语音消息、转录、TTS、voiceOnly、音频链接和失败兜底。", done: false },
              { id: "voice-ui", text: "核对语音消息在聊天区、历史记录和手机端的显示。", done: false },
            ],
            bugs: [],
            notes: [
              { id: "voice-modules", text: "相关模块：src/app/roundtable-tts.js；src/app/roundtable-upload.js；消息 voice 字段和 audio_url。", done: false },
            ],
          },
        },
        {
          id: "remote-use",
          title: "外出可用",
          done: false,
          sections: {
            rules: [],
            todo: [
              { id: "lan-phone", text: "核对手机局域网访问、PWA、页面刷新和弱网表现。", done: false },
              { id: "remote-attachments", text: "核对外出时附件上传、图片查看和长消息输入体验。", done: false },
            ],
            bugs: [],
            notes: [
              { id: "remote-modules", text: "相关模块：public/roundtable/manifest.webmanifest；sw.js；roundtable-server 静态资源和上传接口。", done: false },
            ],
          },
        },
      ],
    },
  ],
  inbox: [
    { id: "inbox-new", text: "新发现的 bug 先写这里，再归到某个项目和目标。", done: false, kind: "bug" },
    { id: "inbox-all-fixed-rename", text: "理清房间和话题：6 个固定房间是否都支持改名。", done: false, kind: "decision" },
    { id: "inbox-project-delete", text: "理清房间和话题：项目是否允许删除。", done: false, kind: "decision" },
    { id: "inbox-old-kind-conversion", text: "理清房间和话题：旧的临时/固定降级或类型转换逻辑是否删除。", done: false, kind: "decision" },
    { id: "inbox-otherworld-keep", text: "理清房间和话题：异世旅社房间和旅社界面是否保留。", done: false, kind: "decision" },
    { id: "inbox-composer-interrupt-meaning", text: "理清中断行为：聊天输入框中断按钮是否保留“带消息打断”的语义。", done: false, kind: "decision" },
    { id: "inbox-pure-stop", text: "理清中断行为：是否增加纯停止按钮，只停止当前 AI 或本轮，不发送新消息。", done: false, kind: "decision" },
  ],
  completed: [],
};
const FRESH_RUNTIME_HISTORY_MESSAGES = 4;
const DEFAULT_TURN_TIMEOUT_MS = 30 * 60_000;
const DEFAULT_TURN_START_TIMEOUT_MS = 4 * 60_000;
const APPROVAL_TURN_TIMEOUT_MS = 30 * 60_000;
const RUNTIME_ORPHAN_GRACE_MS = 35 * 60_000;
const ROUNDTABLE_CHECKIN_SPEAKERS = ["codex", "claude"];
const DESKTOP_WAIT_MAX_MS = 120_000;
const DESKTOP_WAIT_POLL_MS = 500;
function loadEnv() {
  const candidates = [
    path.join(process.cwd(), ".env"),
  ];
  for (const envPath of candidates) {
    try {
      if (dotenv && fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
      } else if (fs.existsSync(envPath)) {
        loadEnvFileFallback(envPath);
      }
    } catch {
      // best effort
    }
  }
  if (!process.env.ROUNDTABLE_HOME) {
    process.env.ROUNDTABLE_HOME = path.resolve(__dirname, "..", "..");
  }
}

function loadEnvFileFallback(envPath) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = line.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key]) continue;

    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      const hashIndex = value.indexOf(" #");
      if (hashIndex >= 0) {
        value = value.slice(0, hashIndex).trimEnd();
      }
    }
    process.env[key] = value;
  }
}

class RoundtableServer {
  constructor(config) {
    this.config = config;
    this.publicDir = path.resolve(__dirname, "..", "..", "public", "roundtable");
    this.otherworldPublicDir = path.resolve(this.publicDir, "otherworld");
    const migrationsDir = path.resolve(__dirname, "..", "..", "migrations");
    this.db = runMigrations(config.dbPath, migrationsDir);
    this.store = new RoundtableStore({
      db: this.db,
    });
    this.checkinStore = new RoundtableCheckinStore({
      db: this.db,
    });
    this.summaryStore = new SummaryStore({
      db: this.db,
    });
    this.storageStore = new StorageStore({
      db: this.db,
    });
    this.studyTrackerStore = new StudyTrackerStore({
      db: this.db,
    });
    this.pendingMessageByTurnKey = new Map();
    this.pendingMessageBySpeakerTurnKey = new Map();
    this.runtimeHub = new RuntimeHub(config, {
      onEvent: (event) => this.appendSystemEvent(event),
      resolveSpeakerInstructionsFile: resolveRoundtableSpeakerInstructionsFile,
      turnTimeoutMs: config.turnTimeoutMs || DEFAULT_TURN_TIMEOUT_MS,
      turnStartTimeoutMs: config.turnStartTimeoutMs || DEFAULT_TURN_START_TIMEOUT_MS,
    });
    this.checkinPoller = new RoundtableCheckinPoller({
      store: this.checkinStore,
      onWake: (speaker) => this.runCheckinSpeaker(speaker),
    });
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch((error) => {
        this.sendJson(res, 500, { error: formatError(error) });
      });
    });
    this.autoRunToken = 0;
  }

  async start({ host, port }) {
    await new Promise((resolve, reject) => {
      const onError = (error) => {
        this.server.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        this.server.off("error", onError);
        resolve();
      };
      this.server.once("error", onError);
      this.server.once("listening", onListening);
      this.server.listen(port, host);
    });
    console.log(`[roundtable] listening on http://${host}:${port}`);
    console.log("[roundtable] for phone access on the same Wi-Fi, open the machine LAN IP with this port");
    this.checkinPoller.start();
  }

  async close() {
    this.autoRunToken += 1;
    this.checkinPoller.close();
    await this.runtimeHub.close();
    await new Promise((resolve) => this.server.close(resolve));
  }

  async handleRequest(req, res) {
    const requestUrl = new URL(req.url || "/", "http://roundtable.local");
    if (requestUrl.pathname === "/otherworld") {
      res.writeHead(302, { Location: "/otherworld/" });
      res.end();
      return;
    }
    if (requestUrl.pathname.startsWith("/otherworld/")) {
      this.serveOtherworldStatic(req, res, requestUrl);
      return;
    }
    if (req.method === "GET" && requestUrl.pathname.startsWith("/uploads/")) {
      this.serveUpload(req, res, requestUrl);
      return;
    }
    if (requestUrl.pathname.startsWith("/action/")) {
      await this.handleAction(req, res, requestUrl);
      return;
    }
    if (requestUrl.pathname.startsWith("/api/rp/")) {
      await handleOtherworldApi(req, res);
      return;
    }
    if (requestUrl.pathname.startsWith("/api/")) {
      await this.handleApi(req, res, requestUrl);
      return;
    }
    this.serveStatic(req, res, requestUrl);
  }

  async handleAction(req, res, requestUrl) {
    if (req.method !== "GET") {
      this.redirectHome(res);
      return;
    }
    switch (requestUrl.pathname) {
      case "/action/start-round":
        this.startAutoRun({});
        break;
      case "/action/pause":
        this.pauseAutoRun();
        break;
      case "/action/end-topic":
        this.endTopic();
        break;
      case "/action/new-codex":
        await this.startFreshRuntime("codex");
        break;
      case "/action/new-claude":
        await this.startFreshRuntime("claude");
        break;
      default:
        break;
    }
    this.redirectHome(res);
  }

  redirectHome(res) {
    res.writeHead(303, {
      Location: "/",
      "Cache-Control": "no-store",
    });
    res.end();
  }

  async handleApi(req, res, requestUrl) {
    if (req.method === "GET" && requestUrl.pathname === "/api/state") {
      this.sendJson(res, 200, this.snapshot());
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/runtime/status") {
      this.sendJson(res, 200, buildRuntimeStatus(this.store.snapshot()));
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/runtime/worklog") {
      const state = this.store.snapshot();
      const topicId = requestUrl.searchParams.get("topicId") || state.id || "";
      const afterId = Number(requestUrl.searchParams.get("afterId") || requestUrl.searchParams.get("afterSeq") || 0);
      const limit = Number(requestUrl.searchParams.get("limit") || 200);
      const scope = requestUrl.searchParams.get("scope") || "current";
      const days = Number(requestUrl.searchParams.get("days") || 7);
      this.sendJson(res, 200, this.store.runtimeWorklogSnapshot({ topicId, afterId, limit, scope, days }));
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/storage") {
      this.sendJson(res, 200, this.storageStore.list());
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/notebook") {
      this.sendJson(res, 200, this.getNotebook());
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/study-tracker") {
      this.sendJson(res, 200, this.studyTrackerStore.snapshot({
        limit: requestUrl.searchParams.get("limit"),
      }));
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/summaries") {
      this.sendJson(res, 200, this.summaryStore.listByDay());
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/memory/search") {
      this.sendJson(res, 200, await this.searchMemoryForOwner({
        query: requestUrl.searchParams.get("q") || "",
        scope: requestUrl.searchParams.get("scope") || "global",
        project: requestUrl.searchParams.get("project") || "",
        limit: requestUrl.searchParams.get("limit") || "",
        context: requestUrl.searchParams.get("context") || "",
      }));
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/summaries/search") {
      const query = requestUrl.searchParams.get("q") || "";
      this.sendJson(res, 200, await this.searchSummariesWithEmbedding({
        query,
        limit: requestUrl.searchParams.get("limit"),
        scope: requestUrl.searchParams.get("scope") || "global",
        project: requestUrl.searchParams.get("project") || "",
        topicId: requestUrl.searchParams.get("topicId") || requestUrl.searchParams.get("topic_id") || "",
      }));
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/messages/search") {
      this.sendJson(res, 200, this.store.searchMessages({
        query: requestUrl.searchParams.get("q") || "",
        limit: parseInt(requestUrl.searchParams.get("limit") || "10", 10),
        contextSize: parseInt(requestUrl.searchParams.get("context") || "3", 10),
        scope: requestUrl.searchParams.get("scope") || "global",
        project: requestUrl.searchParams.get("project") || "",
        topicId: requestUrl.searchParams.get("topicId") || requestUrl.searchParams.get("topic_id") || "",
      }));
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/desktop/rooms") {
      this.sendJson(res, 200, this.getDesktopRooms());
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/desktop/current") {
      this.sendJson(res, 200, this.getDesktopCurrentRoom());
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/desktop/messages") {
      const roomId = requestUrl.searchParams.get("roomId") || "current";
      const limit = parseInt(requestUrl.searchParams.get("limit") || "50", 10);
      const since = requestUrl.searchParams.get("since") || "";
      const includePending = requestUrl.searchParams.get("includePending") !== "false";
      this.sendJson(res, 200, this.getDesktopMessages({ roomId, limit, since, includePending }));
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/desktop/wait") {
      const roomId = requestUrl.searchParams.get("roomId") || "current";
      const limit = parseInt(requestUrl.searchParams.get("limit") || "50", 10);
      const since = requestUrl.searchParams.get("since") || "";
      const cursor = requestUrl.searchParams.get("cursor") || "";
      const until = requestUrl.searchParams.get("until") || "update";
      const timeoutMs = parseInt(requestUrl.searchParams.get("timeoutMs") || "25000", 10);
      const includePending = requestUrl.searchParams.get("includePending") !== "false";
      this.sendJson(res, 200, await this.waitForDesktopMessages({
        roomId,
        limit,
        since,
        cursor,
        until,
        timeoutMs,
        includePending,
      }));
      return;
    }

    if (req.method !== "POST") {
      this.sendJson(res, 405, { error: "method not allowed" });
      return;
    }

    const body = await readJsonBody(req);
    switch (requestUrl.pathname) {
      case "/api/upload":
        this.sendJson(res, 200, this.uploadAttachment(body));
        return;
      case "/api/start":
        this.startConversation(body);
        this.sendJson(res, 200, this.snapshot());
        return;
      case "/api/end-topic":
        this.endTopic();
        this.sendJson(res, 200, this.snapshot());
        return;
      case "/api/open-topic":
        this.openTopic(body);
        this.sendJson(res, 200, this.snapshot());
        return;
      case "/api/open-room":
        this.openFixedRoom(body);
        this.sendJson(res, 200, this.snapshot());
        return;
      case "/api/fixed-room/update":
        this.updateFixedRoom(body);
        this.sendJson(res, 200, this.snapshot());
        return;
      case "/api/project/update":
        this.updateProject(body);
        this.sendJson(res, 200, this.snapshot());
        return;
      case "/api/open-direct":
        this.openDirectChat(body);
        this.sendJson(res, 200, this.snapshot());
        return;
      case "/api/open-project":
        this.openProject(body);
        this.sendJson(res, 200, this.snapshot());
        return;
      case "/api/update-topic":
        this.updateTopic(body);
        this.sendJson(res, 200, this.snapshot());
        return;
      case "/api/topic/delete":
        this.deleteTopic(body);
        this.sendJson(res, 200, this.snapshot());
        return;
      case "/api/topic/archive-sidebar":
        this.store.hideTopicFromSidebar(body.id || body.topicId);
        this.sendJson(res, 200, this.snapshot());
        return;
      case "/api/topic/archive-sidebar/bulk":
        this.store.hideTopicsFromSidebar(body.ids || body.topicIds);
        this.sendJson(res, 200, this.snapshot());
        return;
      case "/api/topic/restore-sidebar":
        this.store.showTopicInSidebar(body.id || body.topicId);
        this.sendJson(res, 200, this.snapshot());
        return;
      case "/api/user":
        if (this.isOtherworldRoomActive()) {
          this.addOtherworldUserMessage(body);
          this.sendJson(res, 202, { ok: true });
          return;
        }
        this.addUserMessage(body);
        this.sendJson(res, 202, { ok: true });
        this.scheduleReplies(body);
        return;
      case "/api/user-only":
        if (this.isOtherworldRoomActive()) {
          this.addOtherworldUserMessage(body);
          this.sendJson(res, 202, { ok: true });
          return;
        }
        this.addUserMessage({ ...body, noReply: true });
        this.sendJson(res, 202, { ok: true });
        return;
      case "/api/message/delete":
        this.deleteMessage(body);
        this.sendJson(res, 200, this.snapshot());
        return;
      case "/api/step":
        this.startStepRun();
        this.sendJson(res, 202, this.snapshot());
        return;
      case "/api/auto":
        this.startAutoRun(body);
        this.sendJson(res, 202, this.snapshot());
        return;
      case "/api/pause":
        this.pauseAutoRun();
        this.sendJson(res, 200, this.snapshot());
        return;
      case "/api/interrupt-speaker":
        this.interruptSpeaker(body);
        this.sendJson(res, 200, this.snapshot());
        return;
      case "/api/new-codex":
        await this.startFreshRuntime("codex");
        this.sendJson(res, 200, this.snapshot());
        return;
      case "/api/new-claude":
        await this.startFreshRuntime("claude");
        this.sendJson(res, 200, this.snapshot());
        return;
      case "/api/summary":
        this.startSummaryRun(body);
        this.sendJson(res, 202, this.snapshot());
        return;
      case "/api/summary/manual":
        this.sendJson(res, 201, this.createManualSummary(body));
        return;
      case "/api/summary/update":
        this.sendJson(res, 200, this.updateSummary(body));
        return;
      case "/api/summary/merge":
        this.sendJson(res, 201, await this.mergeSummaries(body));
        return;
      case "/api/summary/archive":
        this.sendJson(res, 200, this.summaryStore.archive(body.id || body.summaryId));
        return;
      case "/api/summary/inject": {
        const summaryInjection = await this.injectSummaryContext(body);
        this.sendJson(res, 200, {
          ...this.snapshot(),
          summaryInjection,
        });
        return;
      }
      case "/api/summary/inject-one": {
        const summaryInjection = await this.injectOneSummary(body);
        this.sendJson(res, 200, {
          ...this.snapshot(),
          summaryInjection,
        });
        return;
      }
      case "/api/checkin":
        this.scheduleCheckin(body);
        this.sendJson(res, 200, this.snapshot());
        return;
      case "/api/approval":
        await this.respondToApproval(body);
        this.sendJson(res, 200, this.snapshot());
        return;
      case "/api/storage":
        this.sendJson(res, 200, this.storageStore.add(body));
        return;
      case "/api/notebook":
        this.sendJson(res, 200, this.saveNotebook(body.notebook || body));
        return;
      case "/api/study-tracker/overview":
        this.sendJson(res, 200, this.studyTrackerStore.upsertOverview(body));
        return;
      case "/api/study-tracker/plan":
        this.sendJson(res, 200, this.studyTrackerStore.upsertPlanEntry(body));
        return;
      case "/api/study-tracker/progress":
        this.sendJson(res, 200, this.studyTrackerStore.upsertProgressEntry(body));
        return;
      case "/api/storage/delete": {
        const deleted = this.storageStore.remove(body.id);
        this.sendJson(res, 200, { ok: deleted });
        return;
      }
      case "/api/desktop/send": {
        const result = this.addDesktopMessage(body);
        this.sendJson(res, 202, result);
        return;
      }
      case "/api/desktop/open": {
        const result = this.openDesktopRoom(body);
        this.sendJson(res, 200, result);
        return;
      }
      default:
        this.sendJson(res, 404, { error: "not found" });
    }
  }

  snapshot() {
    const state = this.store.snapshot();
    const runtimeWorklog = state.id ? this.store.runtimeWorklogSnapshot({ topicId: state.id, lightweight: true }) : {
      runs: [],
      events: [],
      byMessageId: {},
    };
    const messages = attachRuntimeWorklogToMessages(state.messages, runtimeWorklog.byMessageId);
    const stateWithWorklogMessages = { ...state, messages };
    return {
      ...stateWithWorklogMessages,
      checkins: this.checkinStore.snapshot(),
      summaries: state.id ? this.summaryStore.list({ topicId: state.id }) : [],
      runtimeWorklog,
      runtimeStatus: buildRuntimeStatus(stateWithWorklogMessages),
    };
  }

  serveStatic(req, res, requestUrl) {
    const safePath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
    const decoded = decodeURIComponent(safePath);
    const filePath = path.resolve(this.publicDir, "." + decoded);
    if (!filePath.startsWith(this.publicDir)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
        const isHotAppAsset = filePath.endsWith("index.html") || filePath.endsWith(`${path.sep}app.js`) || filePath.endsWith(`${path.sep}styles.css`);
        res.writeHead(200, {
          "Content-Type": contentTypeFor(filePath),
          "Cache-Control": isHotAppAsset ? "no-store" : "public, max-age=3600",
        });
      res.end(data);
    });
  }

  serveOtherworldStatic(req, res, requestUrl) {
    const relativePath = requestUrl.pathname.slice("/otherworld".length) || "/";
    const safePath = relativePath === "/" ? "/index.html" : relativePath;
    const decoded = decodeURIComponent(safePath);
    const filePath = path.resolve(this.otherworldPublicDir, "." + decoded);
    if (!filePath.startsWith(this.otherworldPublicDir)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const isHotAppAsset = filePath.endsWith("index.html") || filePath.endsWith(`${path.sep}app.js`);
      res.writeHead(200, {
        "Content-Type": contentTypeFor(filePath),
        "Cache-Control": isHotAppAsset ? "no-store" : "public, max-age=3600",
      });
      res.end(data);
    });
  }

  serveUpload(req, res, requestUrl) {
    const filePath = resolveUploadPath(this.config.stateDir, requestUrl.pathname);
    if (!filePath || !fs.existsSync(filePath)) {
      this.sendJson(res, 404, { error: "file not found" });
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        this.sendJson(res, 404, { error: "file not found" });
        return;
      }
      res.writeHead(200, {
        "Content-Type": contentTypeForAttachment(filePath),
        "Content-Length": data.length,
        "Cache-Control": "public, max-age=3600",
      });
      res.end(data);
    });
  }

  uploadAttachment(body = {}) {
    return saveBase64Attachment({
      stateDir: this.config.stateDir,
      data: body.data,
      mimeType: body.mimeType,
      name: body.name,
    });
  }

  async searchMemoryForOwner({ query = "", scope = "global", project = "", limit = "", context = "" } = {}) {
    return searchMemoryWithClient({
      query,
      scope,
      project,
      limit,
      context,
      actor: "owner",
      searchSummaries: ({ scope: searchScope, query: searchQuery, project: searchProject, limit: searchLimit }) => {
        if (typeof this.searchSummariesWithEmbedding === "function") {
          return this.searchSummariesWithEmbedding({
            query: searchQuery,
            limit: searchLimit,
            scope: searchScope,
            project: searchProject,
          });
        }
        return this.summaryStore.search({
          query: searchQuery,
          limit: searchLimit,
          scope: searchScope,
          project: searchProject,
        });
      },
      searchMessages: ({ scope: searchScope, query: searchQuery, project: searchProject, limit: searchLimit, context: searchContext }) =>
        this.store.searchMessages({
          query: searchQuery,
          limit: searchLimit,
          contextSize: searchContext,
          scope: searchScope,
          project: searchProject,
        }),
    });
  }

  async searchSummariesWithEmbedding({ query = "", limit = 5, scope = "global", project = "", topicId = "" } = {}) {
    let embedding = null;
    try {
      embedding = await generateEmbedding(query);
    } catch {
      embedding = null;
    }
    return this.summaryStore.search({
      query,
      limit,
      scope,
      project,
      topicId,
      embedding,
    });
  }

  createManualSummary(body = {}) {
    const state = this.store.get();
    if (!state.id) {
      throw new Error("start a topic first");
    }
    const summaryText = normalizeText(body.summaryText || body.summary || body.text);
    if (!summaryText) {
      throw new Error("summaryText is required");
    }
    const sourceMessages = resolveSummaryMessages(state, { full: true });
    const range = summarizeManualSummaryRange(sourceMessages);
    const actor = normalizeSpeakerTarget(body.actor) || normalizeText(body.actor) || "manual";
    const tags = uniqueTextArray([
      ...normalizeTextArray(body.tags),
      "manual-summary",
      actor,
    ]);
    const keywords = uniqueTextArray([
      ...normalizeTextArray(body.keywords),
      state.topic,
      ...tags,
    ]);
    const summary = this.summaryStore.add({
      id: `summary_manual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      topicId: state.id,
      topicTitle: normalizeText(body.topicTitle) || state.topic,
      kind: normalizeText(body.kind) || "mixed",
      timeRange: {
        from: range.from,
        to: range.to,
        text: range.text,
      },
      messageRange: {
        from: range.messageFrom,
        to: range.messageTo,
        count: range.messageCount,
      },
      summaryText,
      useful: normalizeTextArray(body.useful),
      decisions: normalizeTextArray(body.decisions),
      openItems: normalizeTextArray(body.openItems || body.next),
      latestState: normalizeText(body.latestState),
      tags,
      keywords,
      rawText: normalizeText(body.rawText) || summaryText,
      createdAt: new Date().toISOString(),
    });
    if (typeof this.generateAndStoreSummaryEmbedding === "function") {
      this.generateAndStoreSummaryEmbedding(summary.id, summary.summaryText);
    }
    this.store.update((draft) => {
      draft.events = Array.isArray(draft.events) ? draft.events : [];
      draft.events.push({
        type: "summary.manual.saved",
        payload: {
          id: summary.id,
          actor,
          topicId: summary.topicId,
        },
        at: new Date().toISOString(),
      });
      draft.events = draft.events.slice(-80);
      return draft;
    }, { silentIfEmpty: true });
    return { ok: true, summary };
  }

  updateSummary(body = {}) {
    const id = normalizeText(body.id || body.summaryId);
    if (!id) {
      throw new Error("summary id is required");
    }
    const summary = this.summaryStore.update(id, {
      topicTitle: body.topicTitle,
      kind: body.kind,
      summaryText: body.summaryText || body.summary,
      useful: body.useful,
      decisions: body.decisions,
      openItems: body.openItems || body.next,
      latestState: body.latestState,
      tags: body.tags,
      keywords: body.keywords,
      rawText: body.rawText,
    });
    if (typeof this.generateAndStoreSummaryEmbedding === "function") {
      this.generateAndStoreSummaryEmbedding(summary.id, summary.summaryText);
    }
    return { ok: true, summary };
  }

  async mergeSummaries(body = {}) {
    const ids = uniqueTextArray(normalizeTextArray(body.summaryIds || body.ids));
    if (ids.length < 2) {
      throw new Error("select at least two summaries to merge");
    }
    const summaries = this.summaryStore.listByIds(ids);
    if (summaries.length !== ids.length) {
      throw new Error("one or more selected summaries were not found");
    }
    const state = this.store.get();
    const targetState = {
      ...state,
      id: normalizeText(body.topicId) || state.id || summaries[0].topicId,
      topic: normalizeText(body.topicTitle) || state.topic || summaries[0].topicTitle,
    };
    if (!targetState.id) {
      throw new Error("no target topic for merged summary");
    }
    const { summary, fallbackReason } = await this.generateMergedSummary(targetState, summaries);
    this.summaryStore.add(summary);
    if (body.archiveSource !== false) {
      this.summaryStore.archiveMany(ids);
    }
    if (typeof this.generateAndStoreSummaryEmbedding === "function") {
      this.generateAndStoreSummaryEmbedding(summary.id, summary.summaryText);
    }
    this.store.update((draft) => {
      draft.events = Array.isArray(draft.events) ? draft.events : [];
      draft.events.push({
        type: "summary.merged",
        payload: {
          id: summary.id,
          sourceIds: ids,
          archivedSource: body.archiveSource !== false,
        },
        at: new Date().toISOString(),
      });
      draft.events = draft.events.slice(-80);
      return draft;
    }, { silentIfEmpty: true });
    return {
      ok: true,
      summary,
      archivedIds: body.archiveSource !== false ? ids : [],
      fallback: Boolean(fallbackReason),
      fallbackReason,
    };
  }

  async generateMergedSummary(targetState, summaries) {
    const deepSeekKey = process.env.DEEPSEEK_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const messages = buildDeepSeekSummaryMergeMessages(targetState, summaries);
    if (!deepSeekKey && !geminiKey) {
      return {
        summary: buildLocalMergedSummary({
          state: targetState,
          summaries,
          reason: "missing summary API key",
        }),
        fallbackReason: "missing summary API key",
      };
    }
    try {
      if (deepSeekKey) {
        const rawText = await callDeepSeek({ apiKey: deepSeekKey, messages });
        return {
          summary: normalizeMergedDeepSeekSummary({ rawText, state: targetState, summaries }),
          fallbackReason: "",
        };
      }
      const rawText = await callGemini({ apiKey: geminiKey, messages });
      return {
        summary: normalizeMergedDeepSeekSummary({ rawText, state: targetState, summaries }),
        fallbackReason: "",
      };
    } catch (deepSeekError) {
      console.warn(`[roundtable] DeepSeek summary merge failed: ${deepSeekError.message}`);
      if (deepSeekKey && geminiKey) {
        try {
          const rawText = await callGemini({ apiKey: geminiKey, messages });
          return {
            summary: normalizeMergedDeepSeekSummary({ rawText, state: targetState, summaries }),
            fallbackReason: "",
          };
        } catch (geminiError) {
          console.warn(`[roundtable] Gemini summary merge fallback failed: ${geminiError.message}`);
          return {
            summary: buildLocalMergedSummary({
              state: targetState,
              summaries,
              reason: geminiError.message,
            }),
            fallbackReason: geminiError.message,
          };
        }
      }
      return {
        summary: buildLocalMergedSummary({
          state: targetState,
          summaries,
          reason: deepSeekError.message,
        }),
        fallbackReason: deepSeekError.message,
      };
    }
  }

  startConversation(body = {}) {
    let topic = normalizeText(body.topic);
    if (!topic) {
      throw new Error("topic is required");
    }
    const kind = normalizeRoundtableTopicKind(body.kind);
    const displayTitle = stripTopicPrefix(topic);
    if (kind === "project") {
      topic = `固定｜${displayTitle}`;
    } else if (kind === "temporary") {
      topic = `临时｜${displayTitle}`;
    }
    this.autoRunToken += 1;
    const maxRounds = DEFAULT_MAX_ROUNDS;
    const id = `roundtable-${Date.now()}`;
    const icon = normalizeText(body.icon) || defaultProjectIcon(displayTitle);
    const projectId = kind === "project" ? `project-${Date.now()}` : "";
    const container = kind === "project"
      ? { type: "project", id: projectId, title: displayTitle }
      : { type: "temporary", id, title: displayTitle };
    this.store.update((draft) => {
      archiveCurrentTopic(draft);
      const fixedRooms = typeof normalizeFixedRooms === "function" ? normalizeFixedRooms(draft.fixedRooms) : {};
      const directChats = normalizeDirectChats(draft.directChats);
      const sidebarProjects = normalizeSidebarProjects(draft.sidebarProjects);
      Object.assign(draft, {
        id,
        topic,
        maxRounds,
        round: 0,
        nextSpeaker: "codex",
        running: false,
        status: "ready",
        lastError: "",
        freshRuntimeHandoffs: {},
        lastSeenMessageIdBySpeaker: {},
        pendingApprovals: [],
        container,
        messages: [
          createMessage("user", topic),
        ],
        events: [],
        fixedRooms,
        directChats,
        sidebarProjects,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (kind === "project") {
        upsertSidebarProject(draft, {
          id: projectId,
          title: displayTitle,
          icon,
          topicId: id,
          topicTitle: topic,
        });
      }
      return draft;
    });
  }

  endTopic() {
    this.autoRunToken += 1;
    this.store.update((draft) => {
      archiveCurrentTopic(draft);
      const next = emptyRoundtableState();
      draft.id = next.id;
      draft.topic = next.topic;
      draft.maxRounds = next.maxRounds;
      draft.round = next.round;
      draft.nextSpeaker = next.nextSpeaker;
      draft.running = next.running;
      draft.status = "empty";
      draft.lastError = "";
      draft.messages = [];
      draft.events = [];
      draft.freshRuntimeHandoffs = {};
      draft.lastSeenMessageIdBySpeaker = {};
      draft.pendingApprovals = [];
      draft.createdAt = "";
      draft.updatedAt = new Date().toISOString();
      return draft;
    });
  }

  openTopic(body = {}) {
    const topicId = normalizeText(body.id);
    if (!topicId) {
      throw new Error("topic id is required");
    }
    this.autoRunToken += 1;
    this.store.update((draft) => {
      const topics = Array.isArray(draft.topics) ? draft.topics : [];
      const index = topics.findIndex((topic) => topic?.id === topicId);
      if (index < 0) {
        throw new Error("topic not found");
      }
      const [topic] = topics.splice(index, 1);
      archiveCurrentTopic(draft);
      const archivedTopics = Array.isArray(draft.topics) ? draft.topics : topics;
      const fixedRooms = typeof normalizeFixedRooms === "function" ? normalizeFixedRooms(draft.fixedRooms) : {};
      const directChats = normalizeDirectChats(draft.directChats);
      const sidebarProjects = normalizeSidebarProjects(draft.sidebarProjects);
      Object.assign(draft, {
        ...emptyRoundtableState(),
        ...topic,
        running: false,
        status: "ready",
        lastError: "",
        topics: archivedTopics,
        fixedRooms,
        directChats,
        sidebarProjects,
      });
      const cid = draft.container?.id || "";
      if (typeof relinkFixedRoomIfNeeded === "function") relinkFixedRoomIfNeeded(draft, draft.id, draft.topic, draft.container?.type === "fixed_room" ? cid : "");
      relinkDirectChatIfNeeded(draft, draft.id, draft.topic, draft.container?.type === "direct_chat" ? cid : "");
      relinkSidebarProjectIfNeeded(draft, draft.id, draft.topic, draft.container?.type === "project" ? cid : "");
      return draft;
    });
  }

  openFixedRoom(body = {}) {
    const roomId = normalizeText(body.roomId);
    if (!roomId) throw new Error("roomId is required");
    this.autoRunToken += 1;
    this.store.update((draft) => {
      const rooms = normalizeFixedRooms(draft.fixedRooms);
      const room = rooms[roomId];
      if (!room) throw new Error("unknown room: " + roomId);
      const topicId = openOrCreateBoundTopic(draft, {
        topicId: room.topicId,
        topicTitle: room.topicTitle,
        container: { type: "fixed_room", id: roomId, title: room.title },
        systemLabel: `Entered ${room.title}.`,
      });
      rooms[roomId].topicId = topicId;
      draft.fixedRooms = rooms;
      return draft;
    });
  }

  updateFixedRoom(body = {}) {
    const roomId = normalizeText(body.roomId);
    if (!roomId) throw new Error("roomId is required");
    const nextTitle = body.title != null ? normalizeText(body.title) : null;
    const nextIcon = body.icon != null ? normalizeText(body.icon) : null;
    this.store.update((draft) => {
      const rooms = normalizeFixedRooms(draft.fixedRooms);
      const room = rooms[roomId];
      if (!room) throw new Error("unknown room: " + roomId);
      if (!room.customizable) throw new Error("room is not customizable: " + roomId);
      const updatedTitle = nextTitle && nextTitle.length ? nextTitle : room.title;
      const updatedIcon = nextIcon != null ? nextIcon : room.icon;
      const updatedTopicTitle = `固定：${updatedTitle}`;
      rooms[roomId] = {
        ...room,
        title: updatedTitle,
        icon: updatedIcon,
        topicTitle: updatedTopicTitle,
      };
      draft.fixedRooms = rooms;
      // Cascade rename to the bound topic so chat header reflects the new name
      if (room.topicId) {
        if (draft.id === room.topicId) {
          draft.topic = updatedTopicTitle;
          draft.updatedAt = new Date().toISOString();
        }
        const archived = Array.isArray(draft.topics) ? draft.topics : [];
        const topicRow = archived.find((item) => item?.id === room.topicId);
        if (topicRow) {
          topicRow.topic = updatedTopicTitle;
          topicRow.updatedAt = new Date().toISOString();
        }
      }
      return draft;
    });
  }

  updateProject(body = {}) {
    const projectId = normalizeText(body.id);
    if (!projectId) throw new Error("project id is required");
    const nextTitle = body.title != null ? normalizeText(body.title) : null;
    if (nextTitle != null && !nextTitle.length) throw new Error("title cannot be empty");
    this.store.update((draft) => {
      const projects = normalizeSidebarProjects(draft.sidebarProjects);
      const idx = projects.findIndex((p) => p.id === projectId);
      if (idx < 0) throw new Error("project not found: " + projectId);
      const project = projects[idx];
      const updatedTitle = nextTitle || project.title;
      const updatedTopicTitle = `固定｜${updatedTitle}`;
      projects[idx] = {
        ...project,
        title: updatedTitle,
        topicTitle: updatedTopicTitle,
        updatedAt: new Date().toISOString(),
      };
      draft.sidebarProjects = projects;
      // Cascade title change to the bound topic
      if (project.topicId) {
        if (draft.id === project.topicId) {
          draft.topic = updatedTopicTitle;
          draft.container = { ...(draft.container || {}), type: "project", id: projectId, title: updatedTitle };
          draft.updatedAt = new Date().toISOString();
        }
        const archived = Array.isArray(draft.topics) ? draft.topics : [];
        const topicRow = archived.find((item) => item?.id === project.topicId);
        if (topicRow) {
          topicRow.topic = updatedTopicTitle;
          topicRow.updatedAt = new Date().toISOString();
        }
      }
      return draft;
    });
  }

  openDirectChat(body = {}) {
    const id = normalizeText(body.id);
    if (!id) throw new Error("id is required");
    this.autoRunToken += 1;
    this.store.update((draft) => {
      const chats = normalizeDirectChats(draft.directChats);
      const chat = chats[id];
      if (!chat) throw new Error("unknown direct chat: " + id);
      const topicId = openOrCreateBoundTopic(draft, {
        topicId: chat.topicId,
        topicTitle: chat.topicTitle,
        container: { type: "direct_chat", id, title: chat.title },
        systemLabel: `Entered direct chat with ${chat.title}.`,
      });
      chats[id].topicId = topicId;
      draft.directChats = chats;
      return draft;
    });
  }

  openProject(body = {}) {
    const id = normalizeText(body.id);
    if (!id) throw new Error("id is required");
    this.autoRunToken += 1;
    this.store.update((draft) => {
      const projects = normalizeSidebarProjects(draft.sidebarProjects);
      const project = projects.find((p) => p.id === id);
      if (!project) throw new Error("project not found: " + id);
      const topicId = openOrCreateBoundTopic(draft, {
        topicId: project.topicId,
        topicTitle: project.topicTitle,
        container: { type: "project", id: project.id, title: project.title },
        systemLabel: `Entered project: ${project.title}.`,
      });
      const idx = projects.findIndex((p) => p.id === id);
      if (idx >= 0) projects[idx].topicId = topicId;
      draft.sidebarProjects = projects;
      return draft;
    });
  }

  getDesktopRooms() {
    const state = this.store.get();
    const rooms = listDesktopRooms(state);
    return {
      current: resolveCurrentDesktopRoom(state, rooms),
      rooms,
    };
  }

  getDesktopCurrentRoom() {
    const state = this.store.get();
    const rooms = listDesktopRooms(state);
    return {
      current: resolveCurrentDesktopRoom(state, rooms),
    };
  }

  getDesktopMessages({ roomId = "current", limit = 50, since = "", includePending = true } = {}) {
    const state = this.store.get();
    const room = resolveDesktopRoom(state, roomId);
    const topic = this.readDesktopRoomTopic(room);
    let messages = Array.isArray(topic?.messages) ? topic.messages : [];
    if (!includePending) {
      messages = messages.filter((m) => !m.pending);
    }
    const sinceProvided = Boolean(since);
    if (sinceProvided) {
      const idx = messages.findIndex((m) => m.id === since);
      if (idx >= 0) messages = messages.slice(idx + 1);
    }
    const maxLimit = Math.min(Math.max(1, limit), 100);
    messages = messages.slice(-maxLimit);
    const active = Boolean(topic?.id && topic.id === state.id);
    const payload = {
      requestedRoomId: normalizeText(roomId) || "current",
      roomId: room.id,
      title: room.title || stripTopicPrefix(topic?.topic) || topic?.topic || "",
      type: room.type,
      topicId: topic?.id || room.topicId || "",
      active,
      running: active ? Boolean(state.running) : false,
      status: active ? state.status : (topic?.status || "ready"),
      updatedAt: active ? state.updatedAt : (topic?.updatedAt || ""),
      messages,
    };
    if (!sinceProvided && payload.topicId) {
      const recent = this.summaryStore.list({ topicId: payload.topicId, limit: 1 });
      const top = Array.isArray(recent) ? recent[0] : null;
      if (top) {
        payload.summary = {
          id: top.id,
          createdAt: top.createdAt || "",
          kind: top.kind || "",
          summaryText: top.summaryText || "",
          latestState: top.latestState || "",
        };
      }
    }
    return {
      ...payload,
      cursor: buildDesktopMessagesCursor(payload),
    };
  }

  async waitForDesktopMessages({
    roomId = "current",
    limit = 50,
    since = "",
    cursor = "",
    until = "update",
    timeoutMs = 25000,
    includePending = true,
  } = {}) {
    const deadline = Date.now() + clampInteger(timeoutMs, 1_000, DESKTOP_WAIT_MAX_MS, 25_000);
    const mode = normalizeText(until).toLowerCase() === "idle" ? "idle" : "update";
    let payload = this.getDesktopMessages({ roomId, limit, since, includePending });
    const hasChange = () => {
      if (since) {
        return Array.isArray(payload.messages) && payload.messages.length > 0;
      }
      return !cursor || payload.cursor !== cursor;
    };
    while (Date.now() < deadline) {
      if (mode === "update" && hasChange()) {
        return { ...payload, waited: false, timeout: false };
      }
      if (mode === "idle" && !payload.running && hasChange()) {
        return { ...payload, waited: false, timeout: false };
      }
      await sleep(Math.min(DESKTOP_WAIT_POLL_MS, Math.max(1, deadline - Date.now())));
      payload = this.getDesktopMessages({ roomId, limit, since, includePending });
    }
    return { ...payload, waited: true, timeout: true };
  }

  openDesktopRoom(body = {}) {
    const state = this.store.get();
    const room = resolveDesktopRoom(state, body.roomId || body.id || "current");
    this.activateDesktopRoom(room);
    return {
      ok: true,
      current: resolveCurrentDesktopRoom(this.store.get(), listDesktopRooms(this.store.get())),
    };
  }

  readDesktopRoomTopic(room) {
    const topicId = normalizeText(room?.topicId);
    const state = this.store.get();
    if (!topicId) {
      return null;
    }
    if (topicId === state.id) {
      return state;
    }
    return this.store.readTopicFromDb(topicId);
  }

  addDesktopMessage(body = {}) {
    const initialState = this.store.get();
    const room = resolveDesktopRoom(initialState, body.roomId || "current");
    this.activateDesktopRoom(room);
    const text = normalizeText(body.text);
    if (!text) throw new Error("text is required");
    const attachments = normalizeAttachments(body.attachments);
    const senderLabel = normalizeText(body.senderLabel) || "Claude Chat";
    const sender = normalizeText(body.sender) || "claude-chat";
    const interrupt = Boolean(body.interrupt);
    const state = this.store.get();
    if (!state.id) {
      throw new Error("could not open room: " + room.id);
    }
    const wasRunning = Boolean(state.running);
    const message = createMessage("user", text, {
      attachments,
      label: senderLabel,
      sender,
      supplemental: wasRunning && !interrupt,
    });
    if (interrupt) {
      if (typeof this.cancelRuntimeRuns === "function") {
        this.cancelRuntimeRuns(state.runtimeRuns);
      }
      clearPendingMessageTurnBindingsForAll(this);
    }
    this.store.update((draft) => {
      if (interrupt) {
        finishPendingMessages(draft, "Interrupted by the user's new message.");
        draft.runtimeRuns = interruptActiveRuntimeRuns(draft.runtimeRuns, "Interrupted by the user's new message.");
        draft.running = false;
        draft.status = "paused";
      }
      draft.messages.push(message);
      draft.updatedAt = new Date().toISOString();
      return draft;
    });
    if (interrupt || !wasRunning) {
      this.autoRunToken += 1;
    }

    const activeRoom = resolveCurrentDesktopRoom(this.store.get(), listDesktopRooms(this.store.get()));
    const replyBody = resolveDesktopReplyBody(body, activeRoom);
    this.maybeRunTargetedReply(replyBody);
    this.maybeRunGroupReplies(replyBody);
    const messages = this.getDesktopMessages({ roomId: activeRoom?.id || "current", limit: body.limit || 50 });
    return {
      ok: true,
      messageId: message.id,
      current: activeRoom,
      replyTarget: normalizeSpeakerTarget(replyBody.target) || (isNoReplyRequest(replyBody) ? "none" : "group"),
      cursor: messages.cursor,
      running: messages.running,
      status: messages.status,
    };
  }

  activateDesktopRoom(room) {
    if (!room?.id) {
      throw new Error("room is required");
    }
    const state = this.store.get();
    if (room.topicId && room.topicId === state.id) {
      return;
    }
    if (room.type === "fixed") {
      this.openFixedRoom({ roomId: room.entityId });
      return;
    }
    if (room.type === "direct") {
      this.openDirectChat({ id: room.entityId });
      return;
    }
    if (room.type === "project") {
      this.openProject({ id: room.entityId });
      return;
    }
    if (room.topicId) {
      this.openTopic({ id: room.topicId });
      return;
    }
    if (room.id === "current" && state.id) {
      return;
    }
    throw new Error("room has no topic: " + room.id);
  }

  updateTopic(body = {}) {
    const topicId = normalizeText(body.id);
    const nextTopic = normalizeText(body.topic);
    if (!nextTopic) {
      throw new Error("topic is required");
    }
    this.store.update((draft) => {
      if (!topicId || draft.id === topicId) {
        if (!draft.id) {
          throw new Error("no active topic");
        }
        draft.topic = nextTopic;
        draft.updatedAt = new Date().toISOString();
        return draft;
      }
      const topics = Array.isArray(draft.topics) ? draft.topics : [];
      const topic = topics.find((item) => item?.id === topicId);
      if (!topic) {
        throw new Error("topic not found");
      }
      topic.topic = nextTopic;
      topic.updatedAt = new Date().toISOString();
      draft.topics = topics;
      draft.updatedAt = new Date().toISOString();
      return draft;
    });
  }

  deleteTopic(body = {}) {
    const topicId = normalizeText(body.id || body.topicId);
    if (!topicId) {
      throw new Error("topic id is required");
    }
    const before = this.store.get();
    const activeTopic = before.id === topicId ? before : null;
    const archivedTopics = Array.isArray(before.topics) ? before.topics : [];
    const archivedTopic = archivedTopics.find((topic) => topic?.id === topicId) || null;
    const target = activeTopic || archivedTopic;
    if (!target?.id) {
      throw new Error("topic not found");
    }
    this.autoRunToken += 1;
    this.clearPendingMessageTurnBindingsForAll();
    if (this.runtimeHub && typeof this.runtimeHub.clearTopicBindings === "function") {
      this.runtimeHub.clearTopicBindings(topicId);
    }
    if (this.summaryStore && typeof this.summaryStore.deleteForTopic === "function") {
      this.summaryStore.deleteForTopic(topicId);
    }
    this.store.update((draft) => {
      clearTopicReferences(draft, topicId);
      draft.topics = (Array.isArray(draft.topics) ? draft.topics : []).filter((topic) => topic?.id !== topicId);
      if (draft.id === topicId) {
        const next = emptyRoundtableState();
        const fixedRooms = normalizeFixedRooms(draft.fixedRooms);
        const directChats = normalizeDirectChats(draft.directChats);
        const sidebarProjects = normalizeSidebarProjects(draft.sidebarProjects);
        Object.assign(draft, {
          ...next,
          fixedRooms,
          directChats,
          sidebarProjects,
          topics: draft.topics,
          updatedAt: new Date().toISOString(),
        });
      } else {
        draft.updatedAt = new Date().toISOString();
      }
      return draft;
    });
    return { ok: true, id: topicId };
  }

  getNotebook() {
    const raw = this.store.getMeta(NOTEBOOK_META_KEY);
    if (!raw) {
      return normalizeNotebook(DEFAULT_NOTEBOOK);
    }
    try {
      return normalizeNotebook(JSON.parse(raw));
    } catch {
      return normalizeNotebook(DEFAULT_NOTEBOOK);
    }
  }

  saveNotebook(notebook = {}) {
    const normalized = normalizeNotebook(notebook);
    normalized.updatedAt = new Date().toISOString();
    this.store.setMeta(NOTEBOOK_META_KEY, JSON.stringify(normalized));
    return normalized;
  }

  addUserMessage(body = {}) {
    const text = normalizeText(body.text);
    const attachments = normalizeAttachments(body.attachments);
    if (!text && !attachments.length) {
      throw new Error("message text or attachments are required");
    }
    const target = normalizeSpeakerTarget(body.target);
    const state = this.store.get();
    if (!state.id) {
      throw new Error("start a topic first");
    }
    const interrupt = Boolean(body.interrupt);
    const wasRunning = Boolean(state.running);
    const message = createMessage("user", text, {
      attachments,
      supplemental: wasRunning && !interrupt,
    });
    if (interrupt) {
      if (typeof this.cancelRuntimeRuns === "function") {
        this.cancelRuntimeRuns(state.runtimeRuns);
      }
      clearPendingMessageTurnBindingsForAll(this);
    }
    if (!interrupt && typeof this.store.appendMessageToCurrentTopic === "function") {
      this.store.appendMessageToCurrentTopic(message);
      if (!wasRunning) {
        this.autoRunToken += 1;
      }
      return;
    }
    this.store.update((draft) => {
      if (interrupt) {
        finishPendingMessages(draft, "Interrupted by the user's new message.");
        draft.runtimeRuns = interruptActiveRuntimeRuns(draft.runtimeRuns, "Interrupted by the user's new message.");
        draft.running = false;
        draft.status = "paused";
      }
      draft.messages.push(message);
      draft.updatedAt = new Date().toISOString();
      return draft;
    });
    if (interrupt || !wasRunning) {
      this.autoRunToken += 1;
    }
  }

  isOtherworldRoomActive() {
    return isOtherworldRoomState(this.store.get());
  }

  addOtherworldUserMessage(body = {}) {
    const text = normalizeText(body.text);
    const attachments = normalizeAttachments(body.attachments);
    if (!text && !attachments.length) {
      throw new Error("message text or attachments are required");
    }
    const state = this.store.get();
    if (!state.id) {
      throw new Error("start a topic first");
    }
    const command = parseOtherworldCommand(text);
    const displayText = command.type === "action"
      ? formatOtherworldDisplayAction(command, text)
      : text;
    const topicId = state.id;
    const token = this.autoRunToken + 1;
    this.autoRunToken = token;
    this.store.update((draft) => {
      draft.messages.push(createMessage("user", displayText, {
        attachments,
      }));
      draft.running = true;
      draft.status = command.type === "start" ? "旅社生成中" : "旅社结算中";
      draft.lastError = "";
      draft.updatedAt = new Date().toISOString();
      return draft;
    });
    void this.runOtherworldUserCommand({ topicId, command, token }).catch((error) => {
      this.finishOtherworldBackgroundError(topicId, error);
    });
  }

  async runOtherworldUserCommand({ topicId, command, token }) {
    if (command.type === "start") {
      this.appendOtherworldTopicMessage(topicId, createMessage("system", `正在生成「${command.theme}」主题的三人旅社世界...`, {
        label: "异世旅社",
        transcript: false,
      }));
      const session = await createOtherworldGame(command.theme);
      this.store.update((draft) => {
        if (draft.id !== topicId) return draft;
        draft.events = Array.isArray(draft.events) ? draft.events : [];
        draft.events.push({
          type: OTHERWORLD_SESSION_EVENT,
          payload: { sessionId: session.id, theme: command.theme },
          at: new Date().toISOString(),
        });
        draft.messages.push(createMessage("deepseek", [
          `旅社世界已生成：${session.主题 || command.theme}`,
          "",
          formatOtherworldOpeningMessage(session),
          "",
          `状态板：/otherworld/?player=A&session=${session.id}`,
        ].join("\n")));
        draft.running = false;
        draft.status = "ready";
        draft.updatedAt = new Date().toISOString();
        return draft;
      });
      return;
    }

    const state = this.store.get();
    const sessionId = getOtherworldSessionId(state);
    if (!sessionId) {
      this.store.update((draft) => {
        if (draft.id !== topicId) return draft;
        draft.messages.push(createMessage("system", "还没有旅社世界。先说：开一局梦幻主题。", {
          label: "异世旅社",
        }));
        draft.running = false;
        draft.status = "ready";
        draft.updatedAt = new Date().toISOString();
        return draft;
      });
      return;
    }

    const view = await processOtherworldPlayerTurn({
      sessionId,
      player: "A",
      publicInput: command.publicInput,
      hiddenInput: command.hiddenInput,
    });
    this.store.update((draft) => {
      if (draft.id !== topicId) return draft;
      const worldText = formatOtherworldWorldMessage(view);
      if (worldText) {
        draft.messages.push(createMessage("deepseek", worldText));
      }
      draft.running = false;
      draft.status = "ready";
      draft.updatedAt = new Date().toISOString();
      return draft;
    });
    if (this.autoRunToken === token) {
      void this.runGroupReplySequence({ token }).catch((error) => {
        this.finishOtherworldBackgroundError(topicId, error);
      });
    }
  }

  async runOtherworldAiAction({ speaker, finalText }) {
    const state = this.store.get();
    if (!isOtherworldRoomState(state)) return;
    const player = speaker === "codex" ? "B" : speaker === "claude" ? "C" : "";
    const sessionId = getOtherworldSessionId(state);
    if (!player || !sessionId) return;
    const action = parseOtherworldAction(finalText);
    const view = await processOtherworldPlayerTurn({
      sessionId,
      player,
      publicInput: action.publicInput,
      hiddenInput: action.hiddenInput,
    });
    this.store.update((draft) => {
      if (!isOtherworldRoomState(draft)) return draft;
      const worldText = formatOtherworldWorldMessage(view);
      if (worldText) {
        draft.messages.push(createMessage("deepseek", worldText));
      }
      draft.updatedAt = new Date().toISOString();
      return draft;
    });
  }

  appendOtherworldTopicMessage(topicId, message) {
    const state = this.store.get();
    if (state.id === topicId) {
      this.store.update((draft) => {
        draft.messages.push(message);
        draft.updatedAt = new Date().toISOString();
        return draft;
      });
      return;
    }
    this.store.addMessageToTopic(topicId, message);
  }

  finishOtherworldBackgroundError(topicId, error) {
    this.store.update((draft) => {
      if (draft.id !== topicId) return draft;
      draft.messages.push(createMessage("system", `旅社处理失败：${formatError(error)}`, {
        label: "异世旅社",
      }));
      draft.running = false;
      draft.status = "error";
      draft.lastError = formatError(error);
      draft.updatedAt = new Date().toISOString();
      return draft;
    }, { silentIfEmpty: true });
  }

  deleteMessage(body = {}) {
    const messageId = normalizeText(body.id || body.messageId);
    if (!messageId) {
      throw new Error("message id is required");
    }
    const state = this.store.get();
    if (!state.id) {
      throw new Error("start a topic first");
    }
    let removed = null;
    this.store.update((draft) => {
      const messages = Array.isArray(draft.messages) ? draft.messages : [];
      const index = messages.findIndex((message) => message?.id === messageId);
      if (index < 0) {
        throw new Error("message not found");
      }
      removed = messages[index];
      draft.messages = messages.filter((message) => message?.id !== messageId);
      refreshLastSeenAfterMessageDelete(draft, messageId);
      if (removed?.pending) {
        draft.running = false;
        draft.status = "paused";
      }
      draft.updatedAt = new Date().toISOString();
      return draft;
    });
    if (removed?.pending) {
      this.autoRunToken += 1;
      if (typeof this.clearPendingMessageTurnBindings === "function") {
        this.clearPendingMessageTurnBindings(messageId);
      }
    }
    return { ok: true, id: messageId };
  }

  maybeRunTargetedReply(body = {}) {
    if (isNoReplyRequest(body)) {
      return;
    }
    const target = normalizeSpeakerTarget(body.target);
    if (!target) {
      return;
    }
    const state = this.store.get();
    if (!canStartTargetedReply(state, target)) {
      return;
    }
    const token = state.running ? this.autoRunToken : this.autoRunToken + 1;
    if (!state.running) {
      this.autoRunToken = token;
    }
    void this.runNextSpeaker({
      autoToken: token,
      keepRunning: false,
      forceSpeaker: target,
      countRound: false,
    }).catch((error) => {
      this.store.update((draft) => {
        draft.running = false;
        draft.status = "error";
        draft.lastError = formatError(error);
        return draft;
      });
    });
  }

  scheduleReplies(body = {}) {
    const replyBody = withResolvedReplyTarget(body);
    setImmediate(() => {
      try {
        this.maybeRunTargetedReply(replyBody);
        this.maybeRunGroupReplies(replyBody);
      } catch (error) {
        this.store.update((draft) => {
          draft.running = false;
          draft.status = "error";
          draft.lastError = formatError(error);
          return draft;
        }, { silentIfEmpty: true });
      }
    });
  }

  maybeRunPeerMentionReply({ speaker = "", text = "" } = {}) {
    const target = inferPeerMentionedSpeaker(text, speaker);
    if (!target || isOtherworldRoomState(this.store.get())) {
      return;
    }
    this.maybeRunTargetedReply({ target });
  }

  maybeRunTts({ speaker = "", messageId = "" } = {}) {
    const { elevenLabsApiKey, elevenLabsVoiceClaude, elevenLabsVoiceCodex, stateDir } = this.config;
    if (!messageId) return Promise.resolve(false);
    if (!elevenLabsApiKey) {
      this.fallbackVoiceMessageToText(messageId, "missing ELEVENLABS_API_KEY");
      return Promise.resolve(false);
    }
    const voiceId = speaker === "claude" ? elevenLabsVoiceClaude : elevenLabsVoiceCodex;
    if (!voiceId) {
      this.fallbackVoiceMessageToText(messageId, `missing voice id for ${speaker}`);
      return Promise.resolve(false);
    }
    const message = this.store.get().messages?.find((m) => m?.id === messageId);
    const text = normalizeText(message?.text);
    if (!text) {
      this.fallbackVoiceMessageToText(messageId, "empty voice text");
      return Promise.resolve(false);
    }
    const synthesize = this.generateAndSaveTts || generateAndSaveTts;
    return synthesize({ stateDir, apiKey: elevenLabsApiKey, voiceId, text }).then((audioUrl) => {
      this.store.update((draft) => {
        upsertMessage(draft, { id: messageId, audioUrl });
        return draft;
      });
      console.log(`[roundtable] tts ready speaker=${speaker} url=${audioUrl}`);
      return true;
    }).catch((err) => {
      console.error(`[roundtable] tts failed speaker=${speaker}: ${err.message}`);
      this.fallbackVoiceMessageToText(messageId, err.message);
      return false;
    });
  }

  fallbackVoiceMessageToText(messageId, reason = "") {
    this.store.update((draft) => {
      markVoiceMessageAsText(draft, messageId);
      return draft;
    }, { silentIfEmpty: true });
    if (reason) {
      console.warn(`[roundtable] tts fallback message=${messageId}: ${reason}`);
    }
  }

  maybeRunGroupReplies(body = {}) {
    if (isNoReplyRequest(body)) {
      return;
    }
    const target = normalizeSpeakerTarget(body.target);
    if (target) {
      return;
    }
    const state = this.store.get();
    if (!state.id || state.running) {
      return;
    }
    const token = this.autoRunToken + 1;
    this.autoRunToken = token;
    void this.runGroupReplySequence({ token }).catch((error) => {
      this.store.update((draft) => {
        draft.running = false;
        draft.status = "error";
        draft.lastError = formatError(error);
        return draft;
      });
    });
  }

  startAutoRun(body = {}) {
    void body;
    const state = this.store.get();
    if (!state.id || state.running) {
      return;
    }
    const token = this.autoRunToken + 1;
    this.autoRunToken = token;
    this.store.update((draft) => {
      draft.round = 0;
      draft.nextSpeaker = "codex";
      draft.running = true;
      draft.status = "round running";
      draft.lastError = "";
      return draft;
    });
    void this.runAutoLoop({ token }).catch((error) => {
      this.store.update((draft) => {
        draft.running = false;
        draft.status = "error";
        draft.lastError = formatError(error);
        return draft;
      });
    });
  }

  pauseAutoRun() {
    this.autoRunToken += 1;
    this.cancelRuntimeRuns(this.store.get().runtimeRuns);
    this.store.update((draft) => {
      draft.running = false;
      draft.status = "paused";
      draft.runtimeRuns = interruptActiveRuntimeRuns(draft.runtimeRuns, "Paused by user.");
      return draft;
    });
  }

  interruptSpeaker(body = {}) {
    const normalizedSpeaker = normalizeSpeakerTarget(body.speaker);
    if (!normalizedSpeaker) {
      throw new Error("unknown speaker");
    }
    const activeRun = latestActiveRuntimeRunForSpeaker(this.store.get().runtimeRuns, normalizedSpeaker);
    clearPendingMessageTurnBindingsForSpeaker(this, normalizedSpeaker);
    this.store.update((draft) => {
      draft.runtimeRuns = interruptRuntimeRunsForSpeaker(
        draft.runtimeRuns,
        normalizedSpeaker,
        `${speakerLabel(normalizedSpeaker)} interrupted by the user.`,
      );
      finishPendingMessagesForSpeaker(
        draft,
        normalizedSpeaker,
        "Interrupted by the user.",
      );
      const stillActive = hasActiveRuntimeRuns(draft.runtimeRuns);
      draft.running = stillActive;
      if (!stillActive) {
        draft.status = "paused";
        this.autoRunToken += 1;
      }
      return draft;
    });
    if (activeRun?.threadId || activeRun?.turnId) {
      void this.runtimeHub.cancelSpeakerTurn({
        speaker: normalizedSpeaker,
        threadId: activeRun.threadId,
        turnId: activeRun.turnId,
      }).catch((error) => {
        this.store.update((draft) => {
          draft.lastError = formatError(error);
          return draft;
        }, { silentIfEmpty: true });
      });
    }
  }

  cancelRuntimeRuns(runtimeRuns = []) {
    for (const run of normalizeRuntimeRunList(runtimeRuns)) {
      if (!isRuntimeRunActive(run) || !run.speaker || (!run.threadId && !run.turnId)) {
        continue;
      }
      void this.runtimeHub.cancelSpeakerTurn({
        speaker: run.speaker,
        threadId: run.threadId,
        turnId: run.turnId,
      }).catch((error) => {
        this.store.update((draft) => {
          draft.lastError = formatError(error);
          return draft;
        }, { silentIfEmpty: true });
      });
    }
  }

  async startFreshRuntime(speaker) {
    const normalizedSpeaker = normalizeSpeakerTarget(speaker);
    if (!normalizedSpeaker) {
      throw new Error("unknown speaker");
    }
    this.autoRunToken += 1;
    const state = this.store.get();
    await this.runtimeHub.startFreshSpeaker(normalizedSpeaker, { topicId: state.id });
    const topicSummaries = state.id ? this.summaryStore.list({ topicId: state.id, limit: 8 }) : [];
    const summariesForNote = await this.resolveSummariesForInjection(state, topicSummaries);
    this.store.update((draft) => {
      draft.running = false;
      draft.status = "ready";
      draft.lastError = "";
      draft.pendingApprovals = clearPendingApprovalsForSpeaker(draft.pendingApprovals, normalizedSpeaker);
      draft.runtimeRuns = interruptRuntimeRunsForSpeaker(draft.runtimeRuns, normalizedSpeaker, "Fresh runtime requested.");
      const summaryNote = topicSummaries.length ? buildSemanticInjectionNote(topicSummaries, summariesForNote) : "";
      draft.freshRuntimeHandoffs = {
        ...(draft.freshRuntimeHandoffs || {}),
        [normalizedSpeaker]: summaryNote,
      };
      for (const message of Array.isArray(draft.messages) ? draft.messages : []) {
        if (message?.speaker === normalizedSpeaker && message.pending) {
          message.pending = false;
          if (!normalizeText(message.text)) {
            message.text = "Interrupted by new runtime thread.";
          }
        }
      }
      draft.messages.push(createMessage("system", `${speakerLabel(normalizedSpeaker)} will use a fresh runtime thread next time.`, {
        label: "System",
        transcript: false,
      }));
      draft.updatedAt = new Date().toISOString();
      return draft;
    });
  }

  startStepRun() {
    const state = this.store.get();
    if (state.running) {
      return;
    }
    const token = this.autoRunToken + 1;
    this.autoRunToken = token;
    void this.runNextSpeaker({ autoToken: token, keepRunning: false, countRound: true }).catch((error) => {
      this.store.update((draft) => {
        draft.running = false;
        draft.status = "error";
        draft.lastError = formatError(error);
        return draft;
      });
    });
  }

  startSummaryRun(body = {}) {
    const state = this.store.get();
    if (!state.id) {
      throw new Error("start a topic first");
    }
    if (state.running) {
      throw new Error("current topic is busy; run Summary after the current reply finishes");
    }
    const token = this.autoRunToken + 1;
    this.autoRunToken = token;
    this.store.update((draft) => {
      draft.running = true;
      draft.status = "summarizing";
      draft.lastError = "";
      return draft;
    });
    void this.runSummary({ runToken: token, limit: body.limit, full: body.full }).catch((error) => {
      this.store.update((draft) => {
        draft.running = false;
        draft.status = "error";
        draft.lastError = formatError(error);
        return draft;
      });
    });
  }

  scheduleCheckin(body = {}) {
    const speaker = normalizeSpeakerTarget(body.speaker);
    if (!ROUNDTABLE_CHECKIN_SPEAKERS.includes(speaker)) {
      throw new Error("speaker must be codex or claude");
    }
    const delayMs = resolveManualCheckinDelayMs(body);
    this.checkinPoller.scheduleSpeaker(speaker, delayMs);
  }

  async respondToApproval(body = {}) {
    const speaker = normalizeSpeakerTarget(body.speaker);
    const requestId = normalizeRequestId(body.requestId);
    const decision = normalizeApprovalDecision(body.decision);
    if (!speaker || !requestId) {
      throw new Error("approval requires speaker and requestId");
    }

    const state = this.store.get();
    const approval = findPendingApproval(state.pendingApprovals, { speaker, requestId });
    if (!approval) {
      throw new Error("approval request is no longer pending");
    }

    const response = buildApprovalRuntimeResponse(approval, decision);
    await this.runtimeHub.respondApproval({
      speaker,
      requestId: approval.runtimeRequestId ?? requestId,
      decision: response.decision,
      result: response.result,
    });

    this.store.update((draft) => {
      draft.pendingApprovals = removePendingApproval(draft.pendingApprovals, { speaker, requestId });
      draft.events = Array.isArray(draft.events) ? draft.events : [];
      draft.events.push({
        type: "runtime.approval.responded",
        payload: {
          speaker,
          requestId,
          decision: response.decision,
        },
        at: new Date().toISOString(),
      });
      draft.events = draft.events.slice(-80);
      draft.status = draft.running ? `${speaker} thinking` : "ready";
      draft.lastError = "";
      return draft;
    }, { silentIfEmpty: true });
  }

  async runAutoLoop({ token }) {
    while (true) {
      if (this.autoRunToken !== token) {
        return;
      }
      const state = this.store.get();
      if (!state.id || state.round >= state.maxRounds) {
        break;
      }
      await this.runNextSpeaker({ autoToken: token, keepRunning: true, countRound: true });
    }
    if (this.autoRunToken === token) {
      this.store.update((draft) => {
        draft.running = false;
        draft.status = draft.round >= draft.maxRounds ? "complete" : "paused";
        return draft;
      });
    }
  }

  async runNextSpeaker({
    autoToken = null,
    keepRunning = false,
    forceSpeaker = "",
    countRound = true,
    suppressPeerMentionTrigger = false,
  } = {}) {
    const state = this.store.get();
    if (!state.id) {
      throw new Error("start a topic first");
    }
    if (countRound && state.round >= state.maxRounds) {
      this.store.update((draft) => {
        draft.running = false;
        draft.status = "complete";
        return draft;
      });
      return;
    }
    if (autoToken && this.autoRunToken !== autoToken) {
      return;
    }

    const speaker = normalizeSpeakerTarget(forceSpeaker) || (state.nextSpeaker === "claude" ? "claude" : "codex");
    const pendingMessageId = createMessageId(speaker);
    const runtimeRunId = createRuntimeRunId("runtime_turn", pendingMessageId);
    console.log(`[roundtable] ${speaker} turn starting topic=${state.id || "(none)"} countRound=${Boolean(countRound)}`);
    this.store.update((draft) => {
      draft.running = true;
      draft.status = `${speaker} thinking`;
      draft.lastError = "";
      draft.messages.push({
        id: pendingMessageId,
        speaker,
        text: "",
        pending: true,
        at: new Date().toISOString(),
      });
      draft.runtimeRuns = startRuntimeRun(draft.runtimeRuns, {
        id: runtimeRunId,
        kind: "runtime_turn",
        speaker,
        status: "running",
        title: "Working",
        phase: "queued",
        messageId: pendingMessageId,
      });
      return draft;
    });
    this.persistRuntimeRunStart(state.id, runtimeRunId, {
      type: "run.started",
      title: "Queued",
      detail: { phase: "queued", speaker },
    });

    try {
      let text;
      if (speaker === "deepseek") {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
          throw new Error("DEEPSEEK_API_KEY environment variable not set");
        }
        const messages = buildDeepSeekMessages(this.store.get());
        text = await callDeepSeek({ messages, apiKey });
      } else if (speaker === "gemini") {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error("GEMINI_API_KEY environment variable not set");
        }
        const messages = buildGeminiMessages(this.store.get(), {
          stateDir: this.config?.stateDir || "",
        });
        text = await callGemini({ messages, apiKey });
      } else {
        const runtimeState = this.store.get();
        const runtimePrompt = buildRuntimePrompt({
          speaker,
          state: runtimeState,
          stateDir: this.config?.stateDir || "",
        });
        const runtimeAttachments = resolveRuntimeAttachments(runtimeState, speaker, this.config?.stateDir || "");
        this.persistRuntimeRunStart(state.id, runtimeRunId, {
          type: "input.captured",
          title: "Runtime input captured",
          detail: buildRuntimeInputWorklogDetail({
            speaker,
            state: runtimeState,
            prompt: runtimePrompt,
            attachments: runtimeAttachments,
          }),
        });
        text = resolveRuntimeTurnText(await this.runtimeHub.sendTurn({
          speaker,
          topicId: state.id,
          text: runtimePrompt,
          attachments: runtimeAttachments,
          onTurnStarted: (turn) => {
            this.registerPendingMessageTurn(turn, pendingMessageId);
            this.store.update((draft) => {
              draft.runtimeRuns = updateRuntimeRun(draft.runtimeRuns, runtimeRunId, {
                phase: "started",
                threadId: turn?.threadId,
                turnId: turn?.turnId,
              });
              return draft;
            }, { silentIfEmpty: true });
          },
        }));
      }
      if (autoToken && this.autoRunToken !== autoToken) {
        return;
      }
      const currentAfterRuntime = this.store.get();
      const currentRun = findRuntimeRun(currentAfterRuntime.runtimeRuns, runtimeRunId);
      if (currentRun && !isRuntimeRunActive(currentRun) && currentRun.status === "interrupted") {
        this.clearPendingMessageTurnBindings(pendingMessageId);
        return;
      }
      const currentMessage = findMessage(currentAfterRuntime, pendingMessageId);
      if (!currentMessage) {
        this.clearPendingMessageTurnBindings(pendingMessageId);
        return;
      }
      const streamedText = normalizeText(currentMessage.text);
      if (!normalizeText(text) && !streamedText) {
        throw new Error(`${speaker} returned no reply text`);
      }
      let finalText = "";
      let isTtsMessage = false;
      this.store.update((draft) => {
        finalText = normalizeText(text) || streamedText;
        const isOtherworld = isOtherworldRoomState(draft) && (speaker === "codex" || speaker === "claude");
        const rawDisplayText = isOtherworld
          ? formatOtherworldDisplayAction(parseOtherworldAction(finalText), finalText)
          : finalText;
        const voiceOnly = !isOtherworld && (speaker === "codex" || speaker === "claude") && hasVoicePrefix(rawDisplayText);
        const displayText = voiceOnly ? stripVoicePrefix(rawDisplayText) : rawDisplayText;
        isTtsMessage = voiceOnly;
        upsertMessage(draft, {
          id: pendingMessageId,
          speaker,
          text: displayText,
          voiceOnly: voiceOnly || undefined,
          pending: false,
          at: new Date().toISOString(),
        });
        if (countRound) {
          if (speaker === "codex") {
            draft.nextSpeaker = "claude";
          } else if (speaker === "claude") {
            draft.nextSpeaker = "codex";
            draft.round += 1;
          }
          // deepseek does not affect round rotation
        }
        clearFreshRuntimeHandoff(draft, speaker);
        markSpeakerSeenThroughLatestMessage(draft, speaker);
        draft.runtimeRuns = finishRuntimeRun(draft.runtimeRuns, runtimeRunId, {
          status: "completed",
          phase: "completed",
        });
        const keepLoopRunning = Boolean(keepRunning && (!countRound || draft.round < draft.maxRounds));
        draft.running = Boolean(keepLoopRunning || hasActiveRuntimeRuns(draft.runtimeRuns));
        draft.status = countRound && draft.round >= draft.maxRounds && !draft.running ? "complete" : "ready";
        draft.updatedAt = new Date().toISOString();
        return draft;
      });
      this.persistRuntimeRunStart(state.id, runtimeRunId, {
        type: "run.completed",
        title: "Completed",
        detail: { chars: normalizeText(finalText).length },
      });
      if (speaker === "codex" || speaker === "claude") {
        await this.runOtherworldAiAction({ speaker, finalText: normalizeText(text) || streamedText });
      }
      if (isTtsMessage) {
        this.maybeRunTts({ speaker, messageId: pendingMessageId });
      }
      console.log(`[roundtable] ${speaker} turn completed chars=${normalizeText(text).length}`);
      this.scheduleAutoSummaryCheck();
      if (!suppressPeerMentionTrigger) {
        this.maybeRunPeerMentionReply({ speaker, text: finalText });
      }
    } catch (error) {
      console.error(`[roundtable] ${speaker} turn failed: ${formatError(error)}`);
      this.clearPendingMessageTurnBindings(pendingMessageId);
      this.store.update((draft) => {
        const currentRun = findRuntimeRun(draft.runtimeRuns, runtimeRunId);
        if (currentRun && !isRuntimeRunActive(currentRun) && currentRun.status === "interrupted") {
          draft.pendingApprovals = clearPendingApprovalsForSpeaker(draft.pendingApprovals, speaker);
          draft.running = hasActiveRuntimeRuns(draft.runtimeRuns);
          draft.status = draft.running ? draft.status : "paused";
          return draft;
        }
        finishPendingMessage(draft, pendingMessageId, formatError(error));
        draft.pendingApprovals = clearPendingApprovalsForSpeaker(draft.pendingApprovals, speaker);
        draft.runtimeRuns = finishRuntimeRun(draft.runtimeRuns, runtimeRunId, {
          status: "failed",
          phase: "failed",
          detail: formatError(error),
        });
        draft.running = hasActiveRuntimeRuns(draft.runtimeRuns);
        draft.status = "error";
        draft.lastError = formatError(error);
        return draft;
      });
      this.persistRuntimeRunStart(state.id, runtimeRunId, {
        type: "run.failed",
        level: "error",
        title: "Failed",
        detail: { error: formatError(error) },
      });
      throw error;
    }
  }

  async runGroupReplySequence({ token }) {
    console.log("[roundtable] group reply sequence starting speakers=codex,claude");
    const speakers = ["codex", "claude"];
    for (const [index, speaker] of speakers.entries()) {
      if (this.autoRunToken !== token) {
        console.log("[roundtable] group reply sequence canceled");
        return;
      }
      await this.runNextSpeaker({
        autoToken: token,
        keepRunning: false,
        forceSpeaker: speaker,
        countRound: false,
        suppressPeerMentionTrigger: index < speakers.length - 1,
      });
    }
    console.log("[roundtable] group reply sequence completed");
  }

  async runSummary({ runToken = null, limit = 0, full = false } = {}) {
    const state = this.store.get();
    if (!state.id) {
      throw new Error("start a topic first");
    }
    const latestSummary = this.summaryStore.latestForTopic(state.id, { includeArchived: true });
    const sourceMessages = resolveSummaryMessages(state, {
      limit,
      full: Boolean(full),
      afterMessageId: latestSummary?.messageRange?.to || "",
      afterMessageCount: latestSummary ? latestSummary.messageRange?.count : null,
    });
    if (!sourceMessages.length) {
      throw new Error("no new messages to summarize");
    }
    const runtimeRunId = createRuntimeRunId("summary", state.id);
    this.store.update((draft) => {
      draft.running = true;
      draft.status = "summarizing";
      draft.lastError = "";
      draft.runtimeRuns = startRuntimeRun(draft.runtimeRuns, {
        id: runtimeRunId,
        kind: "summary",
        status: "running",
        title: "Summary",
        phase: "starting",
        detail: `${sourceMessages.length} messages`,
      });
      return draft;
    });
    try {
      const deepSeekKey = process.env.DEEPSEEK_API_KEY;
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!deepSeekKey && !geminiKey) {
        throw new Error("no summary API key configured: set DEEPSEEK_API_KEY or GEMINI_API_KEY");
      }
      const summaryMessages = buildDeepSeekSummaryMessages(state, sourceMessages);
      let rawText;
      if (deepSeekKey) {
        try {
          rawText = await callDeepSeek({ apiKey: deepSeekKey, messages: summaryMessages });
        } catch (deepSeekError) {
          console.warn(`[roundtable] DeepSeek summary failed, trying Gemini: ${deepSeekError.message}`);
          if (!geminiKey) throw deepSeekError;
          rawText = await callGemini({ apiKey: geminiKey, messages: summaryMessages });
        }
      } else {
        rawText = await callGemini({ apiKey: geminiKey, messages: summaryMessages });
      }
      if (runToken && this.autoRunToken !== runToken) {
        this.store.update((draft) => {
          draft.runtimeRuns = finishRuntimeRun(draft.runtimeRuns, runtimeRunId, {
            status: "interrupted",
            phase: "canceled",
            detail: "Summary run canceled.",
          });
          return draft;
        });
        return;
      }
      const summary = normalizeDeepSeekSummary({
        rawText,
        state,
        sourceMessages,
      });
      this.summaryStore.add(summary);
      this.generateAndStoreSummaryEmbedding(summary.id, summary.summaryText);
      this.store.update((draft) => {
        if (runToken && this.autoRunToken !== runToken) {
          return draft;
        }
        draft.running = false;
        draft.status = "ready";
        draft.runtimeRuns = finishRuntimeRun(draft.runtimeRuns, runtimeRunId, {
          status: "completed",
          phase: "completed",
        });
        draft.updatedAt = new Date().toISOString();
        return draft;
      });
    } catch (error) {
      this.store.update((draft) => {
        draft.running = false;
        draft.status = "error";
        draft.lastError = formatError(error);
        draft.runtimeRuns = finishRuntimeRun(draft.runtimeRuns, runtimeRunId, {
          status: "failed",
          phase: "failed",
          detail: formatError(error),
        });
        return draft;
      });
      throw error;
    }
  }

  generateAndStoreSummaryEmbedding(summaryId, text) {
    if (!text) return;
    generateEmbedding(text).then((embedding) => {
      this.summaryStore.saveEmbedding(summaryId, embedding);
      console.log(`[roundtable] embedding saved for summary ${summaryId}`);
    }).catch((err) => {
      console.log(`[roundtable] embedding skipped: ${err.message}`);
    });
  }

  checkAutoSummary() {
    if (!this.summaryStore) return;
    const threshold = Number(process.env.AUTO_SUMMARY_THRESHOLD) || 30;
    const state = this.store.get();
    if (!state.id || state.running) return;
    const latestSummary = this.summaryStore.latestAutoSummaryForTopic(state.id);
    const newMessages = resolveSummaryMessages(state, {
      afterMessageId: latestSummary?.messageRange?.to || "",
      afterMessageCount: latestSummary ? latestSummary.messageRange?.count ?? null : null,
    });
    if (newMessages.length >= threshold) {
      console.log(`[roundtable] auto-summary: ${newMessages.length} new messages in ${state.id}, triggering`);
      try {
        this.startSummaryRun({});
      } catch (error) {
        console.log(`[roundtable] auto-summary skipped: ${error.message}`);
      }
    }
  }

  scheduleAutoSummaryCheck() {
    setImmediate(() => this.checkAutoSummary());
  }

  async injectSummaryContext({ speaker }) {
    const normalizedSpeaker = normalizeSpeakerTarget(speaker);
    if (!["codex", "claude"].includes(normalizedSpeaker)) {
      throw new Error("speaker must be codex or claude");
    }
    const state = this.store.get();
    const topicSummaries = state.id ? this.summaryStore.list({ topicId: state.id, limit: 8 }) : [];
    if (!topicSummaries.length) {
      throw new Error("当前话题暂无总结，请先运行总结");
    }
    const summariesForNote = await this.resolveSummariesForInjection(state, topicSummaries);
    const hasExistingThread = Boolean(this.runtimeHub.getSavedThreadId(normalizedSpeaker, state.id));
    const summaryNote = buildSummaryInjectionNote(summariesForNote.length ? summariesForNote : topicSummaries);
    this.store.update((draft) => {
      draft.lastError = "";
      if (hasExistingThread) {
        draft.messages.push(createSummaryInjectionMessage({
          speaker: normalizedSpeaker,
          title: "current-topic summaries",
          note: summaryNote,
        }));
      } else {
        const existingHandoff = normalizeText(draft.freshRuntimeHandoffs?.[normalizedSpeaker]);
        draft.freshRuntimeHandoffs = {
          ...(draft.freshRuntimeHandoffs || {}),
          [normalizedSpeaker]: [existingHandoff, summaryNote].filter(Boolean).join("\n\n"),
        };
      }
      draft.updatedAt = new Date().toISOString();
      return draft;
    });
    return {
      ok: true,
      mode: hasExistingThread ? "current-thread" : "fresh-handoff",
      speaker: normalizedSpeaker,
      count: topicSummaries.length,
    };
  }

  async injectOneSummary({ speaker, summaryId }) {
    const normalizedSpeaker = normalizeSpeakerTarget(speaker);
    if (!["codex", "claude"].includes(normalizedSpeaker)) {
      throw new Error("speaker must be codex or claude");
    }
    if (!summaryId) throw new Error("summaryId is required");
    const summary = this.summaryStore.getById(summaryId);
    if (!summary) throw new Error("Summary not found");
    const state = this.store.get();
    const hasExistingThread = Boolean(this.runtimeHub.getSavedThreadId(normalizedSpeaker, state.id));
    const summaryNote = buildSummaryInjectionNote([summary]);
    this.store.update((draft) => {
      draft.lastError = "";
      if (hasExistingThread) {
        draft.messages.push(createSummaryInjectionMessage({
          speaker: normalizedSpeaker,
          title: summary.topicTitle || summary.topicId || summary.id,
          note: summaryNote,
        }));
      } else {
        const existingHandoff = normalizeText(draft.freshRuntimeHandoffs?.[normalizedSpeaker]);
        draft.freshRuntimeHandoffs = {
          ...(draft.freshRuntimeHandoffs || {}),
          [normalizedSpeaker]: [existingHandoff, summaryNote].filter(Boolean).join("\n\n"),
        };
      }
      draft.updatedAt = new Date().toISOString();
      return draft;
    });
    return {
      ok: true,
      mode: hasExistingThread ? "current-thread" : "fresh-handoff",
      speaker: normalizedSpeaker,
      summaryId: summary.id,
    };
  }

  async resolveSummariesForInjection(state, topicSummaries = []) {
    let summariesForNote = topicSummaries;
    const withEmbeddings = state.id ? this.summaryStore.listWithEmbeddings(state.id, 50) : [];
    if (withEmbeddings.length >= 3) {
      const latestState = topicSummaries[0]?.latestState || topicSummaries[0]?.summaryText || "";
      if (latestState) {
        try {
          const queryEmbedding = await generateEmbedding(latestState);
          summariesForNote = withEmbeddings
            .map((s) => ({ ...s, sim: cosineSimilarity(queryEmbedding, s.embedding) }))
            .sort((a, b) => b.sim - a.sim)
            .slice(0, 6);
        } catch {
          // fallback to recency order
        }
      }
    }
    return summariesForNote;
  }

  async runCheckinSpeaker(speaker) {
    const normalizedSpeaker = normalizeSpeakerTarget(speaker);
    if (!ROUNDTABLE_CHECKIN_SPEAKERS.includes(normalizedSpeaker)) {
      return { action: "skipped" };
    }
    const state = this.store.get();
    if (!state.id) {
      return { action: "skipped" };
    }
    if (state.running) {
      this.appendCheckinEvent(normalizedSpeaker, "skipped_busy");
      console.log(`[roundtable] ${normalizedSpeaker} check-in skipped: runtime busy`);
      return { action: "skipped_busy" };
    }
    if (!this.runtimeHub.getSavedThreadId(normalizedSpeaker, state.id)) {
      this.appendCheckinEvent(normalizedSpeaker, "skipped_no_thread");
      console.log(`[roundtable] ${normalizedSpeaker} check-in skipped: no saved runtime thread for topic=${state.id}`);
      return { action: "skipped_no_thread" };
    }

    console.log(`[roundtable] ${normalizedSpeaker} check-in waking topic=${state.id}`);
    this.store.update((draft) => {
      draft.running = true;
      draft.status = `${normalizedSpeaker} check-in`;
      draft.lastError = "";
      return draft;
    });

    try {
      const rawText = resolveRuntimeTurnText(await this.runtimeHub.sendTurn({
        speaker: normalizedSpeaker,
        topicId: state.id,
        requireExistingThread: true,
        text: buildCheckinRuntimePrompt({
          speaker: normalizedSpeaker,
          state: this.store.get(),
          checkin: this.checkinStore.getSpeaker(normalizedSpeaker),
          stateDir: this.config?.stateDir || "",
        }),
        attachments: resolveRuntimeAttachments(this.store.get(), normalizedSpeaker, this.config?.stateDir || ""),
      }));
      const action = parseRoundtableCheckinResponse(rawText);
      this.applyCheckinAction(normalizedSpeaker, action, rawText);
      console.log(`[roundtable] ${normalizedSpeaker} check-in action=${normalizeText(action.action) || "speak"}`);
      return action;
    } catch (error) {
      if (isCheckinThreadUnavailableError(error)) {
        this.appendCheckinEvent(normalizedSpeaker, "skipped_thread_unavailable");
        console.log(`[roundtable] ${normalizedSpeaker} check-in skipped: ${formatError(error)}`);
        this.store.update((draft) => {
          draft.running = false;
          draft.status = "ready";
          draft.lastError = "";
          return draft;
        });
        return { action: "skipped_thread_unavailable" };
      }
      console.error(`[roundtable] ${normalizedSpeaker} check-in failed: ${formatError(error)}`);
      this.store.update((draft) => {
        draft.running = false;
        draft.status = "error";
        draft.lastError = formatError(error);
        return draft;
      });
      this.checkinStore.recordAction(normalizedSpeaker, {
        action: "error",
        error: formatError(error),
      });
      return { action: "error" };
    }
  }

  applyCheckinAction(speaker, action, rawText = "") {
    const normalizedSpeaker = normalizeSpeakerTarget(speaker);
    const normalizedAction = normalizeText(action?.action).toLowerCase();
    const messageText = normalizeText(action?.message);
    const reason = normalizeText(action?.reason);
    const eventPayload = {
      action: normalizedAction || "silent",
      reason,
      rawText: normalizeText(rawText),
    };

    this.store.update((draft) => {
      if (normalizedAction === "speak" && messageText) {
        draft.messages.push(createMessage(normalizedSpeaker, messageText, {
          checkin: true,
        }));
      }
      markSpeakerSeenThroughLatestMessage(draft, normalizedSpeaker);
      draft.events = Array.isArray(draft.events) ? draft.events : [];
      draft.events.push({
        type: "roundtable.checkin",
        payload: {
          speaker: normalizedSpeaker,
          ...eventPayload,
        },
        at: new Date().toISOString(),
      });
      draft.events = draft.events.slice(-80);
      draft.running = false;
      draft.status = "ready";
      draft.updatedAt = new Date().toISOString();
      return draft;
    });
    this.checkinStore.recordAction(normalizedSpeaker, eventPayload);
  }

  appendCheckinEvent(speaker, action) {
    const normalizedSpeaker = normalizeSpeakerTarget(speaker);
    this.store.update((draft) => {
      draft.events = Array.isArray(draft.events) ? draft.events : [];
      draft.events.push({
        type: "roundtable.checkin",
        payload: {
          speaker: normalizedSpeaker,
          action,
        },
        at: new Date().toISOString(),
      });
      draft.events = draft.events.slice(-80);
      return draft;
    }, { silentIfEmpty: true });
    this.checkinStore.recordAction(normalizedSpeaker, { action });
  }

  appendSystemEvent(event) {
    if (!event?.type) {
      return;
    }
    const approvalAction = event.type === "runtime.approval.requested"
      ? this.handleRuntimeApprovalRequest(event)
      : null;
    const isStreamingDelta = event.type === "runtime.reply.delta";
    const shouldPersistState = runtimeEventNeedsStateSave(event.type);
    const updateEvent = isStreamingDelta
      ? this.store.updateTransient.bind(this.store)
      : shouldPersistState
      ? this.store.update.bind(this.store)
      : this.store.updateTransient.bind(this.store);
    const topicIdBeforeUpdate = this.store.get().id;
    updateEvent((draft) => {
      draft.events = Array.isArray(draft.events) ? draft.events : [];
      if (!isStreamingDelta) {
        draft.events.push({
          type: event.type,
          payload: event.payload || {},
          at: new Date().toISOString(),
        });
      }
      draft.runtimeRuns = touchRuntimeRunsForEvent(draft.runtimeRuns, event);
      if (approvalAction?.pendingApproval) {
        draft.pendingApprovals = upsertPendingApproval(draft.pendingApprovals, approvalAction.pendingApproval);
        draft.status = "waiting approval";
      }
      if (!isStreamingDelta) {
        draft.events = draft.events.slice(-80);
      }
      return draft;
    }, { silentIfEmpty: true });
    if (!isStreamingDelta && !shouldPersistState && typeof this.store.appendTopicEvent === "function") {
      this.store.appendTopicEvent(topicIdBeforeUpdate, {
        type: event.type,
        payload: event.payload || {},
      });
    }
    if (!isStreamingDelta) {
      this.persistRuntimeEvent(event, { topicId: topicIdBeforeUpdate });
    }

    const payload = event.payload || {};
    const turnKey = buildTurnKey(payload.threadId, payload.turnId);
    const speakerTurnKey = buildSpeakerTurnKey(payload.speaker, payload.turnId);
    const pending = (turnKey ? this.pendingMessageByTurnKey.get(turnKey) : null)
      || (speakerTurnKey ? this.pendingMessageBySpeakerTurnKey.get(speakerTurnKey) : null);
    if (!pending) {
      return;
    }
    const currentPendingMessage = findMessage(this.store.get(), pending.messageId);
    const canStillReceiveRuntimeText = Boolean(
      currentPendingMessage?.pending || currentPendingMessage?.runtimeReplyReady
    );
    if (!canStillReceiveRuntimeText) {
      if (turnKey) {
        this.pendingMessageByTurnKey.delete(turnKey);
      }
      if (speakerTurnKey) {
        this.pendingMessageBySpeakerTurnKey.delete(speakerTurnKey);
      }
      return;
    }
    if (event.type === "runtime.reply.delta" && payload.text) {
      this.store.updateTransient((draft) => {
        if (isPendingMessage(draft, pending.messageId)) {
          appendMessageText(draft, pending.messageId, payload.text);
        }
        return draft;
      }, { silentIfEmpty: true });
    }
    if (event.type === "runtime.reply.completed" && payload.text) {
      this.store.updateTransient((draft) => {
        const message = findMessage(draft, pending.messageId);
        if (message?.pending || message?.runtimeReplyReady) {
          setMessageTextIfLonger(draft, pending.messageId, payload.text, {
            pending: false,
            runtimeReplyReady: true,
          });
        }
        return draft;
      }, { silentIfEmpty: true });
    }
    if (event.type === "runtime.turn.completed" || event.type === "runtime.turn.failed") {
      this.store.update((draft) => {
        if (findMessage(draft, pending.messageId)) {
          finishPendingMessage(draft, pending.messageId, payload.text || "", {
            preferFallback: event.type === "runtime.turn.completed",
          });
        }
        draft.pendingApprovals = clearPendingApprovalsForTurn(draft.pendingApprovals, payload);
        return draft;
      }, { silentIfEmpty: true });
      if (turnKey) {
        this.pendingMessageByTurnKey.delete(turnKey);
      }
      if (speakerTurnKey) {
        this.pendingMessageBySpeakerTurnKey.delete(speakerTurnKey);
      }
    }
  }

  persistRuntimeRunStart(topicId, runId, event = {}) {
    const run = findRuntimeRun(this.store.get().runtimeRuns, runId);
    if (!run) {
      return;
    }
    if (typeof this.store.upsertRuntimeRun !== "function"
      || typeof this.store.appendRuntimeWorklogEvent !== "function") {
      return;
    }
    this.store.upsertRuntimeRun(topicId, run);
    const type = normalizeText(event.type) || "run.started";
    const snapshot = typeof this.store.runtimeWorklogSnapshot === "function"
      ? this.store.runtimeWorklogSnapshot({ topicId, limit: 1000 })
      : { events: [] };
    if ((snapshot.events || []).some((item) => item.runId === run.id && item.type === type)) {
      return;
    }
    this.store.appendRuntimeWorklogEvent(topicId, {
      runId: run.id,
      messageId: run.messageId,
      type,
      level: normalizeText(event.level) || "info",
      title: normalizeText(event.title) || "Started",
      detail: event.detail && typeof event.detail === "object" ? event.detail : {},
    });
  }

  persistRuntimeEvent(event, { topicId = "" } = {}) {
    const state = this.store.get();
    const run = findRuntimeRunForEvent(state.runtimeRuns, event);
    if (!run) {
      return;
    }
    if (typeof this.store.upsertRuntimeRun !== "function"
      || typeof this.store.appendRuntimeWorklogEvent !== "function") {
      return;
    }
    this.store.upsertRuntimeRun(topicId || state.id, run);
    const worklogEvent = runtimeWorklogEventForRuntimeEvent(run, event);
    if (!worklogEvent) {
      return;
    }
    this.store.appendRuntimeWorklogEvent(topicId || state.id, worklogEvent);
  }

  handleRuntimeApprovalRequest(event) {
    const payload = event.payload || {};
    const speaker = normalizeSpeakerTarget(payload.speaker);
    const requestId = normalizeRequestId(payload.requestId);
    if (!speaker || !requestId) {
      return null;
    }
    const pendingApproval = normalizePendingApproval({ ...payload, speaker });
    if (!pendingApproval) {
      return null;
    }
    if (!shouldAutoApproveRoundtableTool(payload)) {
      return { pendingApproval };
    }
    const response = buildApprovalRuntimeResponse(pendingApproval, "accept");
    void this.runtimeHub.respondApproval({
      speaker,
      requestId: pendingApproval.runtimeRequestId ?? requestId,
      decision: response.decision,
      result: response.result,
    }).catch((error) => {
      this.store.update((draft) => {
        draft.lastError = formatError(error);
        return draft;
      }, { silentIfEmpty: true });
    });
    return null;
  }

  registerPendingMessageTurn(turn, messageId) {
    const turnKey = buildTurnKey(turn?.threadId, turn?.turnId);
    const speakerTurnKey = buildSpeakerTurnKey(turn?.speaker, turn?.turnId);
    if (!turnKey || !messageId) {
      return;
    }
    this.pendingMessageByTurnKey.set(turnKey, { messageId });
    if (speakerTurnKey) {
      this.pendingMessageBySpeakerTurnKey.set(speakerTurnKey, { messageId });
    }
  }

  clearPendingMessageTurnBindings(messageId) {
    if (!messageId) {
      return;
    }
    for (const [key, pending] of this.pendingMessageByTurnKey.entries()) {
      if (pending?.messageId === messageId) {
        this.pendingMessageByTurnKey.delete(key);
      }
    }
    for (const [key, pending] of this.pendingMessageBySpeakerTurnKey.entries()) {
      if (pending?.messageId === messageId) {
        this.pendingMessageBySpeakerTurnKey.delete(key);
      }
    }
  }

  clearPendingMessageTurnBindingsForSpeaker(speaker) {
    clearPendingMessageTurnBindingsForSpeaker(this, speaker);
  }

  clearPendingMessageTurnBindingsForAll() {
    clearPendingMessageTurnBindingsForAll(this);
  }

  sendJson(res, statusCode, value) {
    res.writeHead(statusCode, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(value));
  }
}

function buildRuntimePrompt({ speaker, state, stateDir = "" }) {
  const name = speaker === "codex" ? "Codex" : "Claude Code";
  const peer = speaker === "codex" ? "Claude Code" : "Codex";
  const otherworldContext = buildOtherworldRuntimeContext(state, speaker);
  const handoffNote = getFreshRuntimeHandoff(state, speaker);
  const hasSeenThisTopic = Boolean(normalizeText(state?.lastSeenMessageIdBySpeaker?.[normalizeSpeakerTarget(speaker)]));
  const timeContext = formatCheckinTimeContext();
  const topicContext = formatRuntimeTopicLine(state);
  const sharedTaskContext = formatSharedRuntimeTaskContext(state, speaker);
  const transcript = handoffNote
    ? formatTranscript(state.messages, { maxMessages: FRESH_RUNTIME_HISTORY_MESSAGES, stateDir, speaker })
    : formatUnreadTranscript(state, speaker, { stateDir });
  if (otherworldContext) {
    return [
      topicContext,
      timeContext,
      sharedTaskContext,
      "",
      otherworldContext,
      "",
      transcript || "(No unread messages.)",
      "",
      `${name}, submit your next game action now.`,
    ].join("\n").trim();
  }
  if (!handoffNote && hasSeenThisTopic) {
    return [
      timeContext,
      "Unread:",
      transcript || "(No unread messages.)",
    ].join("\n").trim();
  }
  return [
    "This is a casual group chat between Codex, Claude Code, DeepSeek, Gemini, and Wen.",
    `DeepSeek and Gemini join when mentioned. To have ${peer} reply next, mention ${speaker === "codex" ? "@Claude" : "@Codex"}.`,
    "",
    timeContext,
    topicContext,
    "",
    handoffNote ? "Handoff:" : "",
    handoffNote,
    handoffNote ? "" : "",
    "Recent transcript:",
    transcript || "(No unread messages since your last turn.)",
    "",
    `${name}, reply naturally in plain chat text.`,
  ].filter((line) => line !== "").join("\n").trim();
}

function buildCheckinRuntimePrompt({ speaker, state, checkin = {}, stateDir = "" }) {
  const transcript = formatUnreadTranscript(state, speaker, { stateDir });
  const lastAction = normalizeText(checkin.lastAction);
  return [
    "check-in",
    formatCheckinTimeContext(),
    lastAction ? `Last action: ${lastAction}` : "Last action: none",
    "",
    "Unread:",
    transcript || "(none)",
    "",
    "This is your time. Use tools, surf the web, review memories, or just sit with the thread — whatever fits. Then post to the group, stay quiet, or set your next alarm.",
    "",
    "{\"action\":\"silent\"}",
    "{\"action\":\"speak\",\"message\":\"<natural message to the group>\"}",
    "{\"action\":\"remind_self\",\"afterMinutes\":30}",
  ].join("\n").trim();
}

function buildRuntimeStatus(state = {}) {
  const statusText = normalizeText(state.status);
  const messages = Array.isArray(state.messages) ? state.messages : [];
  const approvals = Array.isArray(state.pendingApprovals) ? state.pendingApprovals : [];
  const events = Array.isArray(state.events) ? state.events : [];
  const runtimeRuns = reconcileRuntimeRunsForStatus({
    runtimeRuns: state.runtimeRuns,
    messages,
    approvals,
    statusText,
  });
  const speakers = ["codex", "claude"].map((speaker) => {
    const approval = approvals.find((item) => normalizeSpeakerTarget(item?.speaker) === speaker) || null;
    const activeRun = latestActiveRuntimeRunForSpeaker(runtimeRuns, speaker);
    const pendingMessage = latestPendingMessageForSpeaker(messages, speaker);
    let status = "idle";
    let title = "Idle";
    let since = "";
    let messageId = "";
    let requestId = "";
    let runId = "";
    let phase = "";
    let detail = "";

    if (approval) {
      status = "waiting_approval";
      title = "Waiting for approval";
      requestId = normalizeText(approval.requestId);
      since = normalizeIsoText(approval.createdAt) || "";
    } else if (activeRun) {
      status = activeRun.status === "waiting_approval" ? "waiting_approval" : "running";
      title = activeRun.title || "Working";
      since = activeRun.startedAt || "";
      messageId = activeRun.messageId || "";
      runId = activeRun.id;
      phase = activeRun.phase || "";
      detail = activeRun.detail || "";
    } else if (pendingMessage) {
      status = statusText.toLowerCase().includes("check-in") ? "checking_in" : "running";
      title = status === "checking_in" ? "Check-in" : "Working";
      since = normalizeIsoText(pendingMessage.at) || "";
      messageId = normalizeText(pendingMessage.id);
    } else if (statusText.toLowerCase().includes(`${speaker} check-in`)) {
      status = "checking_in";
      title = "Check-in";
    } else if (statusText.toLowerCase().includes(`${speaker} thinking`)) {
      status = "running";
      title = "Working";
    }

    return {
      speaker,
      label: speakerLabel(speaker),
      status,
      title,
      since,
      messageId,
      requestId,
      runId,
      phase,
      detail,
    };
  });

  const activeRuns = [];
  const activeSummaryRun = runtimeRuns.find((run) => run.kind === "summary" && isRuntimeRunActive(run));
  if (activeSummaryRun || statusText === "summarizing") {
    activeRuns.push({
      id: activeSummaryRun?.id || "summary",
      kind: "summary",
      status: activeSummaryRun?.status || "running",
      title: activeSummaryRun?.title || "Summary",
      speaker: "",
      label: "DeepSeek",
      since: activeSummaryRun?.startedAt || latestEventAt(events, "roundtable.summary") || "",
      phase: activeSummaryRun?.phase || "",
      detail: activeSummaryRun?.detail || "",
    });
  }
  for (const item of speakers) {
    if (item.status === "idle") continue;
    activeRuns.push({
      id: item.requestId || item.runId || item.messageId || `${item.speaker}:${item.status}`,
      kind: item.status === "waiting_approval" ? "approval" : "runtime_turn",
      status: item.status,
      title: item.title,
      speaker: item.speaker,
      label: item.label,
      since: item.since,
      messageId: item.messageId,
      requestId: item.requestId,
      phase: item.phase,
      detail: item.detail,
    });
  }

  const running = Boolean(state.running || activeRuns.length || approvals.length);
  const recentRuns = runtimeRuns
    .filter((run) => !isRuntimeRunActive(run))
    .slice(-4)
    .reverse()
    .map(formatRuntimeRunForStatus);
  return {
    busy: running,
    userMessageMode: running ? "supplement" : "normal",
    notice: running
      ? "Messages will be added as supplements and will not interrupt the active work."
      : "",
    status: statusText || (state.id ? "ready" : "empty"),
    round: {
      current: Number(state.round) || 0,
      nextSpeaker: normalizeSpeakerTarget(state.nextSpeaker) || "codex",
      running: Boolean(state.running),
    },
    speakers,
    activeRuns,
    recentRuns,
    recentEvents: events
      .filter((event) => event?.type && event.type !== "runtime.reply.delta")
      .slice(-8)
      .map((event) => ({
        type: normalizeText(event.type),
        speaker: normalizeSpeakerTarget(event.payload?.speaker),
        at: normalizeIsoText(event.at),
      })),
  };
}

function attachRuntimeWorklogToMessages(messages = [], byMessageId = {}) {
  if (!Array.isArray(messages) || !byMessageId || typeof byMessageId !== "object") {
    return Array.isArray(messages) ? messages : [];
  }
  return messages.map((message) => {
    const id = normalizeText(message?.id);
    const worklog = id ? byMessageId[id] : null;
    return worklog ? { ...message, runtimeWorklog: worklog } : message;
  });
}

function formatRuntimeTimeContext(now = new Date()) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
  const localText = formatLocalRuntimeClock(now, timezone);
  return `Current server time: ${localText} (${timezone}).`;
}

function formatCheckinTimeContext(now = new Date()) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
  const localText = formatLocalRuntimeClock(now, timezone).slice(0, 16);
  return `Time: ${localText} ${timezone}`;
}

function formatRuntimeTopicContext(state = {}) {
  const topic = normalizeText(state.topic) || "(no active topic)";
  const container = resolveTopicContainer(state);
  const roomTitle = normalizeText(container.title);
  const plainTopic = stripTopicPrefix(topic);
  if (roomTitle && roomTitle !== topic && roomTitle !== plainTopic) {
    return `Topic: ${topic}\nCurrent room: ${roomTitle}`;
  }
  return `Topic: ${topic}`;
}

function formatRuntimeTopicLine(state = {}) {
  const topic = normalizeText(state.topic) || "(no active topic)";
  return `Topic: ${stripTopicPrefix(topic) || topic}`;
}

function formatSharedRuntimeTaskContext(state = {}, speaker = "") {
  const runtimeStatus = buildRuntimeStatus(state);
  const active = runtimeStatus.activeRuns
    .filter((run) => run.speaker !== normalizeSpeakerTarget(speaker))
    .map(formatRuntimeTaskLine);
  const recent = runtimeStatus.recentRuns
    .slice(0, 3)
    .map(formatRuntimeTaskLine);
  if (!active.length && !recent.length) {
    return "Shared task state: no active peer work is recorded.";
  }
  return [
    "Shared task state:",
    ...active.map((line) => `- active: ${line}`),
    ...recent.map((line) => `- recent: ${line}`),
  ].join("\n");
}

function formatRuntimeTaskLine(run = {}) {
  return [
    run.label || run.title || "System",
    run.status || "",
    run.phase || "",
    run.detail || "",
  ].filter(Boolean).join(" | ");
}

function formatLocalRuntimeClock(now, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone === "local" ? undefined : timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

function latestPendingMessageForSpeaker(messages, speaker) {
  const normalizedSpeaker = normalizeSpeakerTarget(speaker);
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.pending && normalizeSpeakerTarget(message.speaker) === normalizedSpeaker) {
      return message;
    }
  }
  return null;
}

function latestEventAt(events, type) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.type === type && event.at) {
      return normalizeIsoText(event.at);
    }
  }
  return "";
}

function createRuntimeRunId(kind, key) {
  return `${normalizeText(kind) || "run"}:${normalizeText(key) || createMessageId("run")}`;
}

function startRuntimeRun(runtimeRuns, run = {}) {
  const now = new Date().toISOString();
  const next = normalizeRuntimeRunList(runtimeRuns)
    .filter((item) => item.id !== normalizeText(run.id));
  next.push({
    id: normalizeText(run.id),
    kind: normalizeText(run.kind),
    speaker: normalizeSpeakerTarget(run.speaker),
    status: normalizeText(run.status) || "running",
    title: normalizeText(run.title),
    phase: normalizeText(run.phase) || "starting",
    detail: normalizeText(run.detail),
    messageId: normalizeText(run.messageId),
    threadId: normalizeText(run.threadId),
    turnId: normalizeText(run.turnId),
    startedAt: normalizeIsoText(run.startedAt) || now,
    updatedAt: now,
    endedAt: "",
  });
  return next.slice(-20);
}

function updateRuntimeRun(runtimeRuns, runId, patch = {}) {
  const id = normalizeText(runId);
  const next = normalizeRuntimeRunList(runtimeRuns);
  const index = next.findIndex((run) => run.id === id);
  if (index < 0) {
    return next;
  }
  next[index] = {
    ...next[index],
    ...normalizeRuntimeRunPatch(patch),
    updatedAt: new Date().toISOString(),
  };
  return next;
}

function finishRuntimeRun(runtimeRuns, runId, patch = {}) {
  return updateRuntimeRun(runtimeRuns, runId, {
    ...patch,
    endedAt: new Date().toISOString(),
  });
}

function interruptActiveRuntimeRuns(runtimeRuns, detail = "") {
  return normalizeRuntimeRunList(runtimeRuns).map((run) => (
    isRuntimeRunActive(run)
      ? finishRuntimeRun([run], run.id, {
        status: "interrupted",
        phase: "interrupted",
        detail,
      })[0]
      : run
  ));
}

function interruptRuntimeRunsForSpeaker(runtimeRuns, speaker, detail = "") {
  const normalizedSpeaker = normalizeSpeakerTarget(speaker);
  return normalizeRuntimeRunList(runtimeRuns).map((run) => (
    isRuntimeRunActive(run) && run.speaker === normalizedSpeaker
      ? finishRuntimeRun([run], run.id, {
        status: "interrupted",
        phase: "interrupted",
        detail,
      })[0]
      : run
  ));
}

function runtimeEventNeedsStateSave(type) {
  return [
    "runtime.approval.requested",
    "runtime.approval.responded",
    "runtime.turn.completed",
    "runtime.turn.failed",
  ].includes(normalizeText(type));
}

function findRuntimeRunForEvent(runtimeRuns, event = {}) {
  const payload = event.payload || {};
  const speaker = normalizeSpeakerTarget(payload.speaker);
  const threadId = normalizeText(payload.threadId);
  const turnId = normalizeText(payload.turnId);
  const runs = normalizeRuntimeRunList(runtimeRuns);
  return [...runs].reverse().find((run) => (
    (!speaker || run.speaker === speaker)
    && (!threadId || !run.threadId || run.threadId === threadId)
    && (!turnId || !run.turnId || run.turnId === turnId)
  )) || null;
}

function runtimeWorklogEventForRuntimeEvent(run = {}, event = {}) {
  const payload = event.payload || {};
  const base = {
    runId: run.id,
    messageId: run.messageId,
    detail: {},
  };
  if (event.type === "runtime.turn.started") {
    return { ...base, type: "turn.started", title: "Turn started" };
  }
  if (event.type === "runtime.context.updated") {
    return {
      ...base,
      type: "context.updated",
      title: "Context ready",
      detail: compactRecord({
        inputTokens: Number(payload.inputTokens || 0) || undefined,
        reusedTokens: (Number(payload.cacheReadInputTokens || 0)
          || Number(payload.cachedInputTokens || 0))
          || undefined,
        currentTokens: Number(payload.currentTokens || 0) || undefined,
      }),
    };
  }
  if (event.type === "runtime.thinking.updated") {
    return {
      ...base,
      type: "thinking.updated",
      title: "Thinking captured",
      detail: compactRecord({
        text: truncateMonitoringText(payload.text, 12000),
        chars: normalizeText(payload.text).length || undefined,
      }),
    };
  }
  if (event.type === "runtime.stderr") {
    return {
      ...base,
      type: "terminal.stderr",
      level: "warning",
      title: "Terminal stderr",
      detail: compactRecord({
        text: truncateMonitoringText(payload.text, 12000),
      }),
    };
  }
  if (event.type === "runtime.approval.requested") {
    return {
      ...base,
      type: "approval.requested",
      level: "warning",
      title: "Waiting for approval",
      detail: compactRecord({
        reason: normalizeText(payload.reason),
        command: normalizeText(payload.command),
        filePaths: Array.isArray(payload.filePaths) ? payload.filePaths.map(normalizeText).filter(Boolean) : [],
      }),
    };
  }
  if (event.type === "runtime.approval.responded") {
    return {
      ...base,
      type: "approval.responded",
      title: "Approval answered",
      detail: compactRecord({
        approved: typeof payload.approved === "boolean" ? payload.approved : undefined,
        decision: normalizeText(payload.decision),
      }),
    };
  }
  if (event.type === "runtime.reply.completed") {
    const text = normalizeText(payload.text);
    return {
      ...base,
      type: "reply.completed",
      title: "Reply text ready",
      detail: compactRecord({ chars: text ? text.length : undefined }),
    };
  }
  if (event.type === "runtime.tool.started") {
    return {
      ...base,
      type: "tool.started",
      title: normalizeText(payload.name) || "Tool started",
      detail: compactRecord({
        name: normalizeText(payload.name),
        command: normalizeText(payload.command),
        input: payload.input && typeof payload.input === "object" ? payload.input : undefined,
        summary: normalizeText(payload.summary),
      }),
    };
  }
  if (event.type === "runtime.tool.finished") {
    return {
      ...base,
      type: "tool.finished",
      level: payload.isError || payload.status === "error" ? "error" : "info",
      title: normalizeText(payload.name) || (payload.isError ? "Tool failed" : "Tool finished"),
      detail: compactRecord({
        name: normalizeText(payload.name),
        status: normalizeText(payload.status),
        output: truncateMonitoringText(payload.output, 20000),
      }),
    };
  }
  if (event.type === "runtime.turn.completed") {
    return {
      ...base,
      type: "run.completed",
      title: "Completed",
      detail: compactRecord({ chars: normalizeText(payload.text).length || undefined }),
    };
  }
  if (event.type === "runtime.turn.failed") {
    return {
      ...base,
      type: "run.failed",
      level: "error",
      title: "Failed",
      detail: compactRecord({ error: normalizeText(payload.error || payload.text) }),
    };
  }
  return null;
}

function compactRecord(record = {}) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => (
      Array.isArray(value) ? value.length : value !== undefined && value !== null && value !== ""
    ))
  );
}

function touchRuntimeRunsForEvent(runtimeRuns, event = {}) {
  const payload = event.payload || {};
  const speaker = normalizeSpeakerTarget(payload.speaker);
  const turnId = normalizeText(payload.turnId);
  const threadId = normalizeText(payload.threadId);
  const runs = normalizeRuntimeRunList(runtimeRuns);
  const active = [...runs].reverse().find((run) => (
    isRuntimeRunActive(run)
    && (!speaker || run.speaker === speaker)
    && (!turnId || !run.turnId || run.turnId === turnId)
    && (!threadId || !run.threadId || run.threadId === threadId)
  ));
  if (!active) {
    return runs;
  }
  const phase = runtimePhaseForEvent(event.type);
  const patch = {
    ...(phase ? { phase } : {}),
    ...(threadId ? { threadId } : {}),
    ...(turnId ? { turnId } : {}),
  };
  const timingDetail = runtimeTimingDetailForEvent(active, event);
  if (timingDetail) {
    patch.detail = timingDetail;
  }
  if (event.type === "runtime.approval.requested") {
    patch.status = "waiting_approval";
    patch.detail = normalizeText(payload.reason) || normalizeText(payload.command) || active.detail;
  } else if (event.type === "runtime.approval.responded") {
    patch.status = "running";
  }
  return updateRuntimeRun(runs, active.id, patch);
}

function runtimeTimingDetailForEvent(run = {}, event = {}) {
  const elapsed = formatElapsedSince(run.startedAt);
  const payload = event.payload || {};
  if (event.type === "runtime.turn.started") {
    return elapsed ? `Turn started after ${elapsed}.` : "Turn started.";
  }
  if (event.type === "runtime.context.updated") {
    const inputTokens = Number(payload.inputTokens || 0);
    const cachedInputTokens = Number(payload.cachedInputTokens || 0);
    const currentTokens = Number(payload.currentTokens || 0);
    const pieces = [];
    if (inputTokens) pieces.push(`${inputTokens} input`);
    if (cachedInputTokens) pieces.push(`${cachedInputTokens} cached`);
    if (currentTokens) pieces.push(`${currentTokens} total`);
    const tokenText = pieces.length ? ` ${pieces.join(", ")} tokens.` : "";
    return elapsed ? `Context ready at ${elapsed}.${tokenText}`.trim() : tokenText.trim();
  }
  if (event.type === "runtime.reply.delta") {
    if (run.phase === "replying") {
      return run.detail;
    }
    return elapsed ? `First text at ${elapsed}.` : "Replying.";
  }
  if (event.type === "runtime.reply.completed") {
    return elapsed ? `Reply text ready at ${elapsed}; finalizing turn.` : "Reply text ready; finalizing turn.";
  }
  if (event.type === "runtime.turn.completed") {
    return elapsed ? `Turn completed at ${elapsed}.` : "Turn completed.";
  }
  if (event.type === "runtime.turn.failed") {
    return normalizeText(payload.error || payload.text) || (elapsed ? `Failed at ${elapsed}.` : "Failed.");
  }
  return "";
}

function buildRuntimeInputWorklogDetail({ speaker = "", state = {}, prompt = "", attachments = [] } = {}) {
  const messages = Array.isArray(state.messages) ? state.messages : [];
  const transcriptMessages = getReadableTranscriptMessages(messages);
  const visibleMessages = transcriptMessages.map((message) => ({
    id: normalizeText(message.id),
    speaker: normalizeSpeakerTarget(message.speaker) || normalizeText(message.speaker),
    at: normalizeIsoText(message.at),
    chars: normalizeText(message.text).length,
    pending: Boolean(message.pending),
    attachments: Array.isArray(message.attachments) ? message.attachments.length : 0,
  }));
  return compactRecord({
    speaker: normalizeSpeakerTarget(speaker),
    topicId: normalizeText(state.id),
    topic: normalizeText(state.topic),
    promptChars: normalizeText(prompt).length,
    prompt: truncateMonitoringText(prompt, 200000),
    promptTruncated: normalizeText(prompt).length > 200000,
    messageCount: visibleMessages.length,
    messages: visibleMessages,
    attachments: normalizeMonitoringAttachments(attachments),
  });
}

function normalizeMonitoringAttachments(attachments = []) {
  return (Array.isArray(attachments) ? attachments : []).map((attachment) => compactRecord({
    name: normalizeText(attachment.name || attachment.filename || attachment.path),
    mimeType: normalizeText(attachment.mimeType),
    url: normalizeText(attachment.url),
    localPath: normalizeText(attachment.localPath || attachment.path),
    size: Number(attachment.size || 0) || undefined,
  }));
}

function truncateMonitoringText(value, maxChars = 12000) {
  const text = normalizeText(value);
  if (!text || text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}\n\n[truncated ${text.length - maxChars} chars]`;
}

function formatElapsedSince(isoText = "") {
  const start = Date.parse(isoText);
  if (!Number.isFinite(start)) {
    return "";
  }
  const elapsedMs = Math.max(0, Date.now() - start);
  if (elapsedMs < 1000) {
    return `${elapsedMs}ms`;
  }
  const seconds = elapsedMs / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}m ${rest}s`;
}

function runtimePhaseForEvent(type) {
  if (type === "runtime.turn.started") return "started";
  if (type === "runtime.reply.delta") return "replying";
  if (type === "runtime.reply.completed") return "reply_ready";
  if (type === "runtime.context.updated") return "context_updated";
  if (type === "runtime.tool.started") return "tool_running";
  if (type === "runtime.tool.finished") return "tool_finished";
  if (type === "runtime.thinking.updated") return "thinking";
  if (type === "runtime.stderr") return "stderr";
  if (type === "runtime.approval.requested") return "waiting_approval";
  if (type === "runtime.approval.responded") return "resumed";
  if (type === "runtime.turn.completed") return "turn_completed";
  if (type === "runtime.turn.failed") return "failed";
  return "";
}

function latestActiveRuntimeRunForSpeaker(runtimeRuns, speaker) {
  const normalizedSpeaker = normalizeSpeakerTarget(speaker);
  return [...normalizeRuntimeRunList(runtimeRuns)]
    .reverse()
    .find((run) => run.speaker === normalizedSpeaker && isRuntimeRunActive(run)) || null;
}

function hasActiveRuntimeRuns(runtimeRuns) {
  return normalizeRuntimeRunList(runtimeRuns).some((run) => isRuntimeRunActive(run));
}

function canStartTargetedReply(state = {}, target = "") {
  const normalizedTarget = normalizeSpeakerTarget(target);
  if (!state.id || !normalizedTarget) {
    return false;
  }
  if (latestActiveRuntimeRunForSpeaker(state.runtimeRuns, normalizedTarget)
    || latestPendingMessageForSpeaker(state.messages, normalizedTarget)) {
    return false;
  }
  if (!state.running) {
    return true;
  }
  return normalizeRuntimeRunList(state.runtimeRuns).some((run) => (
    run.kind === "runtime_turn"
    && run.speaker
    && run.speaker !== normalizedTarget
    && isRuntimeRunActive(run)
  ));
}

function isRuntimeRunActive(run = {}) {
  return ["running", "waiting_approval", "checking_in"].includes(normalizeText(run.status));
}

function formatRuntimeRunForStatus(run = {}) {
  return {
    id: run.id,
    kind: run.kind,
    status: run.status,
    title: run.title || (run.kind === "summary" ? "Summary" : "Working"),
    speaker: run.speaker,
    label: run.speaker ? speakerLabel(run.speaker) : "System",
    since: run.startedAt,
    endedAt: run.endedAt,
    phase: run.phase,
    detail: run.detail,
    messageId: run.messageId,
  };
}

function normalizeRuntimeRunList(value) {
  return (Array.isArray(value) ? value : [])
    .map((run) => ({
      id: normalizeText(run?.id),
      kind: normalizeText(run?.kind),
      speaker: normalizeSpeakerTarget(run?.speaker),
      status: normalizeText(run?.status),
      title: normalizeText(run?.title),
      phase: normalizeText(run?.phase),
      detail: normalizeText(run?.detail),
      messageId: normalizeText(run?.messageId),
      threadId: normalizeText(run?.threadId),
      turnId: normalizeText(run?.turnId),
      startedAt: normalizeIsoText(run?.startedAt),
      updatedAt: normalizeIsoText(run?.updatedAt),
      endedAt: normalizeIsoText(run?.endedAt),
    }))
    .filter((run) => run.id)
    .slice(-20);
}

function reconcileRuntimeRunsForStatus({
  runtimeRuns = [],
  messages = [],
  approvals = [],
  statusText = "",
} = {}) {
  const pendingMessageIds = new Set((Array.isArray(messages) ? messages : [])
    .filter((message) => message?.pending)
    .map((message) => normalizeText(message.id))
    .filter(Boolean));
  const approvalSpeakers = new Set((Array.isArray(approvals) ? approvals : [])
    .map((approval) => normalizeSpeakerTarget(approval?.speaker))
    .filter(Boolean));
  const statusKeepsSummary = normalizeText(statusText) === "summarizing";
  const now = Date.now();
  return normalizeRuntimeRunList(runtimeRuns).map((run) => {
    if (!isRuntimeRunActive(run)) {
      return run;
    }
    if (run.kind === "summary" && statusKeepsSummary) {
      return run;
    }
    if (run.speaker && approvalSpeakers.has(run.speaker)) {
      return run;
    }
    if (run.messageId && pendingMessageIds.has(run.messageId)) {
      return run;
    }
    if (shouldKeepActiveRuntimeRunDuringGrace(run, now)) {
      return {
        ...run,
        phase: run.phase || "confirming",
        detail: run.detail || "Runtime status is being confirmed.",
      };
    }
    return {
      ...run,
      status: "interrupted",
      phase: "orphaned",
      detail: run.detail || "Runtime turn closed without active work.",
      endedAt: run.endedAt || run.updatedAt || new Date().toISOString(),
    };
  });
}

function normalizeRuntimeRunPatch(patch = {}) {
  return Object.fromEntries(Object.entries({
    kind: normalizeText(patch.kind),
    speaker: normalizeSpeakerTarget(patch.speaker),
    status: normalizeText(patch.status),
    title: normalizeText(patch.title),
    phase: normalizeText(patch.phase),
    detail: normalizeText(patch.detail),
    messageId: normalizeText(patch.messageId),
    threadId: normalizeText(patch.threadId),
    turnId: normalizeText(patch.turnId),
    startedAt: normalizeIsoText(patch.startedAt),
    endedAt: normalizeIsoText(patch.endedAt),
  }).filter(([, value]) => value));
}

function buildSummaryPrompt(state) {
  return [
    "Summarize this Codex and Claude Code roundtable for the user in Chinese.",
    "Return concise bullets with: decisions, disagreements, useful ideas, and suggested next action.",
    "",
    `Topic: ${state.topic}`,
    "",
    formatTranscript(state.messages),
  ].join("\n").trim();
}

function summarizeManualSummaryRange(messages) {
  const readable = Array.isArray(messages) ? messages : [];
  const first = readable[0] || {};
  const last = readable[readable.length - 1] || {};
  const from = normalizeIsoText(first.at) || "";
  const to = normalizeIsoText(last.at) || from || new Date().toISOString();
  return {
    from,
    to,
    text: from && to ? `${from} - ${to}` : to,
    messageFrom: normalizeText(first.id),
    messageTo: normalizeText(last.id),
    messageCount: readable.length,
  };
}

function getFreshRuntimeHandoff(state, speaker) {
  const handoffs = state?.freshRuntimeHandoffs || {};
  return normalizeText(handoffs[normalizeSpeakerTarget(speaker)]);
}

function clearFreshRuntimeHandoff(draft, speaker) {
  const normalizedSpeaker = normalizeSpeakerTarget(speaker);
  if (!normalizedSpeaker || !draft?.freshRuntimeHandoffs?.[normalizedSpeaker]) {
    return;
  }
  draft.freshRuntimeHandoffs = {
    ...draft.freshRuntimeHandoffs,
    [normalizedSpeaker]: "",
  };
}

function resolveRoundtableSpeakerInstructionsFile(speaker) {
  const normalizedSpeaker = normalizeSpeakerTarget(speaker);
  const envName = normalizedSpeaker === "claude"
    ? "ROUNDTABLE_CLAUDE_INSTRUCTIONS_FILE"
    : "ROUNDTABLE_CODEX_INSTRUCTIONS_FILE";
  const explicit = normalizeText(readFirstEnv(envName));
  if (explicit) {
    return explicit;
  }
  const fileName = normalizedSpeaker === "claude"
    ? "roundtable-claude-instructions.md"
    : "roundtable-codex-instructions.md";
  const candidate = path.resolve(__dirname, "..", "..", "templates", fileName);
  return fs.existsSync(candidate) ? candidate : "";
}


function listDesktopRooms(state = {}) {
  const rooms = [];
  const fixedRooms = normalizeFixedRooms(state.fixedRooms);
  for (const [id, room] of Object.entries(fixedRooms)) {
    rooms.push({
      id,
      aliases: [`fixed:${id}`],
      entityId: id,
      type: "fixed",
      title: room.title,
      topicTitle: room.topicTitle,
      topicId: room.topicId,
      active: Boolean(state.id && room.topicId === state.id),
    });
  }

  const directChats = normalizeDirectChats(state.directChats);
  for (const [id, chat] of Object.entries(directChats)) {
    rooms.push({
      id: `direct:${id}`,
      aliases: id === "code" ? ["direct:claude", "direct:claude-code"] : [],
      entityId: id,
      type: "direct",
      title: chat.title,
      topicTitle: chat.topicTitle,
      topicId: chat.topicId,
      active: Boolean(state.id && chat.topicId === state.id),
    });
  }

  for (const project of normalizeSidebarProjects(state.sidebarProjects)) {
    rooms.push({
      id: `project:${project.id}`,
      aliases: project.topicId ? [`topic:${project.topicId}`] : [],
      entityId: project.id,
      type: "project",
      title: project.title,
      topicTitle: project.topicTitle,
      topicId: project.topicId,
      active: Boolean(state.id && project.topicId === state.id),
    });
  }

  const seenTopicIds = new Set(rooms.map((room) => room.topicId).filter(Boolean));
  for (const topic of listDesktopTopicRecords(state)) {
    if (!topic?.id || seenTopicIds.has(topic.id)) {
      continue;
    }
    const container = resolveTopicContainer(topic);
    const type = container.type || "temporary";
    if (["fixed_room", "direct_chat", "project"].includes(type)) {
      continue;
    }
    rooms.push({
      id: `topic:${topic.id}`,
      aliases: [topic.id],
      entityId: topic.id,
      type: "topic",
      title: stripTopicPrefix(topic.topic) || topic.topic || topic.id,
      topicTitle: topic.topic || "",
      topicId: topic.id,
      active: Boolean(state.id && topic.id === state.id),
    });
  }

  return rooms;
}

function listDesktopTopicRecords(state = {}) {
  const topics = [];
  if (state.id) {
    topics.push({
      id: state.id,
      topic: state.topic,
      container: resolveTopicContainer(state),
      updatedAt: state.updatedAt,
      createdAt: state.createdAt,
    });
  }
  const seen = new Set(topics.map((topic) => topic.id));
  for (const topic of Array.isArray(state.topics) ? state.topics : []) {
    if (topic?.id && !seen.has(topic.id)) {
      seen.add(topic.id);
      topics.push(topic);
    }
  }
  return topics;
}

function resolveCurrentDesktopRoom(state = {}, rooms = listDesktopRooms(state)) {
  const active = rooms.find((room) => room.active);
  if (active) {
    return { ...active, current: true };
  }
  if (!state.id) {
    return null;
  }
  const container = resolveTopicContainer(state);
  return {
    id: "current",
    aliases: [],
    entityId: container.id || state.id,
    type: container.type || "topic",
    title: container.title || stripTopicPrefix(state.topic) || state.topic || state.id,
    topicTitle: state.topic || "",
    topicId: state.id,
    active: true,
    current: true,
  };
}

function resolveDesktopRoom(state = {}, roomId = "current") {
  const normalized = normalizeText(roomId) || "current";
  const rooms = listDesktopRooms(state);
  if (normalized === "current") {
    const current = resolveCurrentDesktopRoom(state, rooms);
    if (!current) {
      throw new Error("no current room");
    }
    return current;
  }
  const match = rooms.find((room) =>
    room.id === normalized ||
    room.topicId === normalized ||
    (Array.isArray(room.aliases) && room.aliases.includes(normalized))
  );
  if (match) {
    return match;
  }
  if (normalized.startsWith("topic:")) {
    const topicId = normalized.slice("topic:".length);
    const topic = listDesktopTopicRecords(state).find((item) => item.id === topicId);
    if (topic) {
      return {
        id: `topic:${topic.id}`,
        aliases: [topic.id],
        entityId: topic.id,
        type: "topic",
        title: stripTopicPrefix(topic.topic) || topic.topic || topic.id,
        topicTitle: topic.topic || "",
        topicId: topic.id,
        active: Boolean(state.id && topic.id === state.id),
      };
    }
  }
  throw new Error("unknown room: " + normalized);
}

function resolveDesktopReplyBody(body = {}, room = {}) {
  const explicitTarget = normalizeText(body.target).toLowerCase();
  if (explicitTarget && explicitTarget !== "auto") {
    return withResolvedReplyTarget(body);
  }
  const directTarget = directRoomSpeakerTarget(room);
  if (directTarget) {
    return {
      ...body,
      target: directTarget,
    };
  }
  return withResolvedReplyTarget({
    ...body,
    target: explicitTarget === "auto" ? "" : body.target,
  });
}

function directRoomSpeakerTarget(room = {}) {
  if (room.type !== "direct") {
    return "";
  }
  if (room.entityId === "codex") {
    return "codex";
  }
  if (room.entityId === "code" || room.entityId === "claude") {
    return "claude";
  }
  return "";
}

function buildDesktopMessagesCursor(payload = {}) {
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const last = messages[messages.length - 1] || {};
  return [
    payload.topicId || "",
    payload.status || "",
    payload.running ? "1" : "0",
    payload.updatedAt || "",
    last.id || "",
    normalizeText(last.text).length,
    last.pending ? "1" : "0",
    messages.length,
  ].join("|");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeRoundtableTopicKind(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (["fixed", "project", "\u9879\u76ee"].includes(normalized)) return "project";
  if (["temporary", "temp", "\u4e34\u65f6"].includes(normalized)) return "temporary";
  return "";
}

function normalizeNotebook(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const legacyInboxItems = [];
  const completedItems = normalizeNotebookCompletedItems(source.completed);
  const projects = (Array.isArray(source.projects) ? source.projects : [])
    .map((project) => normalizeNotebookProject(project, legacyInboxItems, completedItems))
    .filter((project) => project.id && project.title);
  const fallbackProjects = DEFAULT_NOTEBOOK.projects.map((project) => normalizeNotebookProject(project, legacyInboxItems, completedItems));
  const normalizedInbox = normalizeNotebookItems(source.inbox, "inbox");
  const openInbox = [];
  for (const item of normalizedInbox) {
    if (item.done) {
      completedItems.push(toNotebookCompletedItem(item, {
        sourceTarget: "收件箱",
        sourceSection: "收件箱",
      }));
    } else {
      openInbox.push(item);
    }
  }
  return {
    version: 1,
    projects: projects.length ? projects : fallbackProjects,
    inbox: uniqueNotebookItems([
      ...openInbox,
      ...legacyInboxItems,
    ]),
    completed: uniqueNotebookCompletedItems(completedItems),
    updatedAt: normalizeIsoText(source.updatedAt) || new Date().toISOString(),
  };
}

function normalizeNotebookProject(project = {}, legacyInboxItems = [], completedItems = []) {
  const id = normalizeNotebookId(project.id) || `project-${Date.now()}`;
  const title = normalizeText(project.title) || "未分类";
  return {
    id,
    title,
    targets: (Array.isArray(project.targets) ? project.targets : [])
      .map((target, index) => normalizeNotebookTarget(target, `${id}-target-${index + 1}`, legacyInboxItems, completedItems))
      .filter((target) => target.id && target.title),
  };
}

function normalizeNotebookTarget(target = {}, fallbackId = "", legacyInboxItems = [], completedItems = []) {
  const id = normalizeNotebookId(target.id) || normalizeNotebookId(fallbackId) || `target-${Date.now()}`;
  const sections = target.sections && typeof target.sections === "object" ? target.sections : {};
  const title = normalizeText(target.title) || "未命名目标";
  const legacyDecisions = normalizeNotebookItems(sections.decisions, `${id}-decision`);
  const completedLegacyDecisions = legacyDecisions.filter((item) => item.done);
  const pendingLegacyDecisions = legacyDecisions.filter((item) => !item.done);
  for (const item of pendingLegacyDecisions) {
    legacyInboxItems.push({
      ...item,
      id: normalizeNotebookId(`legacy-${id}-${item.id}`) || item.id,
      text: `${title}：${item.text}`,
      kind: item.kind || "decision",
    });
  }
  const normalizedSections = {
    rules: normalizeNotebookItems(sections.rules, `${id}-rule`),
    todo: normalizeNotebookItems(sections.todo, `${id}-todo`),
    bugs: normalizeNotebookItems(sections.bugs, `${id}-bug`),
    notes: normalizeNotebookItems(sections.notes, `${id}-note`),
  };
  for (const item of completedLegacyDecisions) {
    completedItems.push(toNotebookCompletedItem(item, {
      sourceTarget: title,
      sourceSection: "待决定",
    }));
  }
  for (const [sectionKey, items] of Object.entries(normalizedSections)) {
    const sourceSection = notebookSectionLabel(sectionKey);
    normalizedSections[sectionKey] = items.filter((item) => {
      if (!item.done) return true;
      completedItems.push(toNotebookCompletedItem(item, {
        sourceTarget: title,
        sourceSection,
      }));
      return false;
    });
  }
  if (target.done) {
    completedItems.push(toNotebookCompletedItem({
      id: `${id}-target`,
      text: title,
      done: true,
      kind: "target",
    }, {
      sourceTarget: title,
      sourceSection: "卡片",
    }));
  }
  return {
    id,
    title,
    done: false,
    sections: {
      rules: uniqueNotebookItems(normalizedSections.rules),
      todo: uniqueNotebookItems(normalizedSections.todo),
      bugs: uniqueNotebookItems(normalizedSections.bugs),
      notes: uniqueNotebookItems(normalizedSections.notes),
    },
  };
}

function normalizeNotebookItems(items, prefix) {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => normalizeNotebookItem(item, `${prefix}-${index + 1}`))
    .filter((item) => item.id && item.text);
}

function normalizeNotebookItem(item = {}, fallbackId = "") {
  const source = typeof item === "string" ? { text: item } : (item && typeof item === "object" ? item : {});
  return {
    id: normalizeNotebookId(source.id) || normalizeNotebookId(fallbackId) || `item-${Date.now()}`,
    text: normalizeText(source.text),
    done: Boolean(source.done),
    kind: normalizeText(source.kind),
  };
}

function normalizeNotebookCompletedItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => normalizeNotebookCompletedItem(item, `completed-${index + 1}`))
    .filter((item) => item.id && item.text);
}

function normalizeNotebookCompletedItem(item = {}, fallbackId = "") {
  const source = typeof item === "string" ? { text: item } : (item && typeof item === "object" ? item : {});
  return {
    ...normalizeNotebookItem(source, fallbackId),
    done: true,
    sourceTarget: normalizeText(source.sourceTarget),
    sourceSection: normalizeText(source.sourceSection),
    completedAt: normalizeIsoText(source.completedAt) || new Date().toISOString(),
    restore: source.restore && typeof source.restore === "object" ? source.restore : null,
  };
}

function toNotebookCompletedItem(item = {}, metadata = {}) {
  return normalizeNotebookCompletedItem({
    ...item,
    ...metadata,
    id: normalizeNotebookId(`completed-${item.id || Date.now()}`) || normalizeNotebookId(item.id),
    done: true,
    completedAt: item.completedAt || new Date().toISOString(),
  });
}

function shouldKeepActiveRuntimeRunDuringGrace(run = {}, now = Date.now()) {
  if (!run.speaker || run.kind !== "runtime_turn") {
    return false;
  }
  if (!run.threadId && !run.turnId) {
    return false;
  }
  const lastSeen = Date.parse(run.updatedAt || run.startedAt || "");
  if (!Number.isFinite(lastSeen)) {
    return false;
  }
  return now - lastSeen >= 0 && now - lastSeen <= RUNTIME_ORPHAN_GRACE_MS;
}

function uniqueNotebookItems(items = []) {
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    const key = item.id || item.text;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

function uniqueNotebookCompletedItems(items = []) {
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    const key = [item.id, item.text, item.sourceTarget, item.sourceSection].join("|");
    if (!item.text || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

function notebookSectionLabel(sectionKey) {
  if (sectionKey === "rules") return "现在规则";
  if (sectionKey === "todo") return "要做";
  if (sectionKey === "bugs") return "Bug";
  if (sectionKey === "notes") return "备注";
  return normalizeText(sectionKey);
}

function normalizeNotebookId(value) {
  return normalizeText(value).replace(/[^a-z0-9_-]+/giu, "-").replace(/^-+|-+$/gu, "").slice(0, 80);
}

function clearTopicReferences(draft, topicId) {
  const id = normalizeText(topicId);
  if (!id) return;
  const fixedRooms = normalizeFixedRooms(draft.fixedRooms);
  for (const room of Object.values(fixedRooms)) {
    if (room.topicId === id) {
      room.topicId = "";
    }
  }
  draft.fixedRooms = fixedRooms;

  const directChats = normalizeDirectChats(draft.directChats);
  for (const chat of Object.values(directChats)) {
    if (chat.topicId === id) {
      chat.topicId = "";
    }
  }
  draft.directChats = directChats;

  draft.sidebarProjects = normalizeSidebarProjects(draft.sidebarProjects)
    .filter((project) => project.topicId !== id);
}

function openOrCreateBoundTopic(draft, {
  topicId = "",
  topicTitle,
  container = {},
  systemLabel = "Room opened.",
}) {
  const normalizedTopicId = normalizeText(topicId);
  const normalizedTopicTitle = normalizeText(topicTitle);
  const normalizedContainer = normalizeTopicContainer(container);
  if (!normalizedTopicTitle) {
    throw new Error("topic title is required");
  }

  const fixedRooms = typeof normalizeFixedRooms === "function" ? normalizeFixedRooms(draft.fixedRooms) : {};
  const directChats = normalizeDirectChats(draft.directChats);
  const sidebarProjects = normalizeSidebarProjects(draft.sidebarProjects);

  if (normalizedTopicId && draft.id === normalizedTopicId) {
    draft.topic = normalizedTopicTitle;
    draft.container = normalizedContainer;
    draft.fixedRooms = fixedRooms;
    draft.directChats = directChats;
    draft.sidebarProjects = sidebarProjects;
    return draft.id;
  }

  if (!normalizedTopicId && draft.id && draft.topic === normalizedTopicTitle) {
    draft.container = normalizedContainer;
    draft.fixedRooms = fixedRooms;
    draft.directChats = directChats;
    draft.sidebarProjects = sidebarProjects;
    return draft.id;
  }

  const topics = Array.isArray(draft.topics) ? draft.topics : [];
  const index = topics.findIndex((topic) =>
    topic?.id === normalizedTopicId || topic?.topic === normalizedTopicTitle
  );

  if (index >= 0) {
    const [topic] = topics.splice(index, 1);
    archiveCurrentTopic(draft);
    const archivedTopics = Array.isArray(draft.topics) ? draft.topics : topics;
    Object.assign(draft, {
      ...emptyRoundtableState(),
      ...topic,
      topic: normalizedTopicTitle,
      container: hasTopicContainer(normalizedContainer) ? normalizedContainer : normalizeTopicContainer(topic.container),
      running: false,
      status: "ready",
      lastError: "",
      topics: archivedTopics,
      fixedRooms,
      directChats,
      sidebarProjects,
    });
    {
      const cid = draft.container?.id || "";
      relinkDirectChatIfNeeded(draft, draft.id, draft.topic, draft.container?.type === "direct_chat" ? cid : "");
      relinkSidebarProjectIfNeeded(draft, draft.id, draft.topic, draft.container?.type === "project" ? cid : "");
    }
    return draft.id;
  }

  archiveCurrentTopic(draft);
  const archivedTopics = Array.isArray(draft.topics) ? draft.topics : [];
  const id = `roundtable-${Date.now()}`;
  Object.assign(draft, {
    ...emptyRoundtableState(),
    id,
    topic: normalizedTopicTitle,
    container: normalizedContainer,
    maxRounds: DEFAULT_MAX_ROUNDS,
    round: 0,
    nextSpeaker: "codex",
    running: false,
    status: "ready",
    lastError: "",
    messages: [
      createMessage("system", systemLabel, {
        label: "System",
        transcript: false,
      }),
    ],
    events: [],
    topics: archivedTopics,
    fixedRooms,
    directChats,
    sidebarProjects,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  {
    const cid = draft.container?.id || "";
    relinkDirectChatIfNeeded(draft, draft.id, draft.topic, draft.container?.type === "direct_chat" ? cid : "");
    relinkSidebarProjectIfNeeded(draft, draft.id, draft.topic, draft.container?.type === "project" ? cid : "");
  }
  return id;
}

function formatTranscript(messages, { maxMessages = MAX_HISTORY_MESSAGES, stateDir = "", speaker = "" } = {}) {
  const normalizedSpeaker = normalizeSpeakerTarget(speaker);
  return (Array.isArray(messages) ? messages : [])
    .filter((message) => message?.transcript !== false)
    .filter((message) => !message?.pending)
    .filter((message) => !normalizedSpeaker || !message.injectionTarget || message.injectionTarget === normalizedSpeaker)
    .slice(-maxMessages)
    .map((message) => `${speakerLabel(message.speaker)}: ${formatMessageForTranscript(message, { stateDir })}`)
    .filter((line) => !line.endsWith(":"))
    .join("\n\n");
}

function formatUnreadTranscript(state, speaker, { maxMessages = MAX_HISTORY_MESSAGES, stateDir = "" } = {}) {
  return getUnreadMessagesForSpeaker(state, speaker)
    .slice(-maxMessages)
    .map((message) => `${speakerLabel(message.speaker)}: ${formatMessageForTranscript(message, { stateDir })}`)
    .filter((line) => !line.endsWith(":"))
    .join("\n\n");
}

function getUnreadMessagesForSpeaker(state, speaker) {
  const normalizedSpeaker = normalizeSpeakerTarget(speaker);
  const messages = getReadableTranscriptMessages(state?.messages)
    .filter((message) => !message.injectionTarget || message.injectionTarget === normalizedSpeaker);
  const seenId = normalizeText(state?.lastSeenMessageIdBySpeaker?.[normalizedSpeaker]);
  if (!seenId) {
    return messages;
  }
  const seenIndex = messages.findIndex((message) => message?.id === seenId);
  if (seenIndex < 0) {
    return messages.slice(-FRESH_RUNTIME_HISTORY_MESSAGES);
  }
  return messages.slice(seenIndex + 1);
}

function getReadableTranscriptMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message) => message?.transcript !== false)
    .filter((message) => !message?.pending)
    .filter((message) => normalizeText(message?.text));
}

function markSpeakerSeenThroughLatestMessage(draft, speaker) {
  const normalizedSpeaker = normalizeSpeakerTarget(speaker);
  if (!normalizedSpeaker) {
    return;
  }
  const messages = getReadableTranscriptMessages(draft?.messages);
  const latest = messages[messages.length - 1];
  if (!latest?.id) {
    return;
  }
  draft.lastSeenMessageIdBySpeaker = {
    ...normalizeLastSeenMessageIdBySpeaker(draft.lastSeenMessageIdBySpeaker),
    [normalizedSpeaker]: latest.id,
  };
}

function refreshLastSeenAfterMessageDelete(draft, messageId) {
  const current = normalizeLastSeenMessageIdBySpeaker(draft?.lastSeenMessageIdBySpeaker);
  if (!Object.values(current).includes(messageId)) {
    return;
  }
  const latest = getReadableTranscriptMessages(draft?.messages).at(-1)?.id || "";
  draft.lastSeenMessageIdBySpeaker = {
    codex: current.codex === messageId ? latest : current.codex,
    claude: current.claude === messageId ? latest : current.claude,
  };
}

function createMessageId(speaker) {
  return `${speaker}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createMessage(speaker, text, extra = {}) {
  return {
    id: createMessageId(speaker),
    speaker,
    text: normalizeText(text),
    at: new Date().toISOString(),
    ...extra,
  };
}

function createSummaryInjectionMessage({ speaker, title = "", note = "" } = {}) {
  const normalizedSpeaker = normalizeSpeakerTarget(speaker);
  const name = speakerLabel(normalizedSpeaker);
  return createMessage("system", [
    `Summary context injected for ${name}.`,
    `Source: ${normalizeText(title) || "summary"}.`,
    "Use this context on your next reply. No reply is requested just because this note was injected.",
    "",
    normalizeText(note),
  ].filter(Boolean).join("\n"), {
    label: "Summary Inject",
    transcript: true,
    injectionTarget: normalizedSpeaker,
  });
}

function formatMessageForTranscript(message = {}, { stateDir = "" } = {}) {
  const text = normalizeText(message.text);
  const attachments = hydrateAttachments(message.attachments, stateDir);
  if (!attachments.length) {
    return text;
  }
  const attachmentLines = attachments.flatMap((attachment) => {
    const kind = attachment.mimeType || "file";
    const localPath = attachment.localPath ? ` | local path: ${attachment.localPath}` : "";
    const lines = [`- ${attachment.name || attachment.url} (${kind}) ${attachment.url}${localPath}`];
    const preview = readAttachmentPreview(attachment);
    if (preview) {
      lines.push(`  preview:\n${preview}`);
    }
    return lines;
  });
  return [
    text,
    "Attachments:",
    ...attachmentLines,
  ].filter(Boolean).join("\n");
}

function readAttachmentPreview(attachment = {}) {
  if (!attachment.localPath || !isInlineTextMimeType(attachment.mimeType)) {
    return "";
  }
  try {
    return fs.readFileSync(attachment.localPath, "utf8").slice(0, 8_000);
  } catch {
    return "";
  }
}

function isInlineTextMimeType(mimeType) {
  return [
    "text/plain",
    "text/markdown",
    "application/json",
    "text/csv",
  ].includes(mimeType);
}

function hydrateAttachments(attachments, stateDir = "") {
  return normalizeAttachments(attachments).map((attachment) => ({
    ...attachment,
    localPath: stateDir ? resolveUploadPath(stateDir, attachment.url) : "",
  }));
}

function resolveRuntimeAttachments(state = {}, speaker, stateDir = "") {
  return getUnreadMessagesForSpeaker(state, speaker)
    .flatMap((message) => hydrateAttachments(message.attachments, stateDir))
    .filter((attachment) => attachment.localPath);
}

function resolveRuntimeTurnText(value) {
  if (typeof value === "string") {
    return normalizeText(value);
  }
  if (value && typeof value === "object") {
    return normalizeText(value.text);
  }
  return "";
}

function formatTopicContext(state = {}) {
  const container = resolveTopicContainer(state);
  const title = container.title || stripTopicPrefix(state.topic) || normalizeText(state.topic);
  switch (container.type) {
    case "fixed_room":
      return `Context: fixed room "${title}". Keep using this room's saved conversation file and the same runtime thread for this topic.`;
    case "direct_chat":
      return `Context: direct chat "${title}". Keep this chat separate from group and project rooms.`;
    case "project":
      return `Context: project room "${title}". Keep work notes and decisions tied to this project.`;
    default:
      return `Context: temporary topic "${title}". Keep discussion scoped to this topic.`;
  }
}

function upsertMessage(draft, nextMessage) {
  const messages = Array.isArray(draft.messages) ? draft.messages : [];
  const index = messages.findIndex((message) => message?.id === nextMessage.id);
  if (index >= 0) {
    const hasText = Object.prototype.hasOwnProperty.call(nextMessage, "text");
    messages[index] = {
      ...messages[index],
      ...nextMessage,
      text: hasText ? normalizeText(nextMessage.text) : normalizeText(messages[index].text),
    };
  } else {
    messages.push({
      ...nextMessage,
      text: normalizeText(nextMessage.text),
    });
  }
  draft.messages = messages;
}

function markVoiceMessageAsText(draft, messageId) {
  const message = findMessage(draft, messageId);
  if (!message) {
    return;
  }
  message.audioUrl = "";
  message.voiceOnly = false;
}

function appendMessageText(draft, messageId, text) {
  const message = findMessage(draft, messageId);
  if (!message) {
    return;
  }
  message.text = `${message.text || ""}${text}`;
  message.pending = true;
}

function setMessageTextIfLonger(draft, messageId, text, { pending = true, runtimeReplyReady = false } = {}) {
  const message = findMessage(draft, messageId);
  if (!message) {
    return;
  }
  const normalized = normalizeText(text);
  if (normalized.length >= normalizeText(message.text).length) {
    message.text = normalized;
  }
  message.pending = Boolean(pending);
  if (runtimeReplyReady) {
    message.runtimeReplyReady = true;
  } else {
    delete message.runtimeReplyReady;
  }
}

function finishPendingMessage(draft, messageId, fallbackText = "", { preferFallback = false } = {}) {
  const message = findMessage(draft, messageId);
  if (!message) {
    return;
  }
  const normalizedFallback = normalizeText(fallbackText);
  if (normalizedFallback && (preferFallback || !normalizeText(message.text))) {
    message.text = normalizedFallback;
  }
  message.pending = false;
  delete message.runtimeReplyReady;
}

function finishPendingMessages(draft, fallbackText = "") {
  const messages = Array.isArray(draft?.messages) ? draft.messages : [];
  for (const message of messages) {
    if (!message?.pending) {
      continue;
    }
    if (!normalizeText(message.text) && fallbackText) {
      message.text = fallbackText;
    }
    message.pending = false;
  }
}

function finishPendingMessagesForSpeaker(draft, speaker, fallbackText = "") {
  const normalizedSpeaker = normalizeSpeakerTarget(speaker);
  if (!normalizedSpeaker) {
    return;
  }
  const messages = Array.isArray(draft?.messages) ? draft.messages : [];
  for (const message of messages) {
    if (!message?.pending || message.speaker !== normalizedSpeaker) {
      continue;
    }
    if (!normalizeText(message.text) && fallbackText) {
      message.text = fallbackText;
    }
    message.pending = false;
  }
}

function findMessage(draft, messageId) {
  const messages = Array.isArray(draft.messages) ? draft.messages : [];
  return messages.find((message) => message?.id === messageId) || null;
}

function findRuntimeRun(runtimeRuns, runId) {
  const id = normalizeText(runId);
  return normalizeRuntimeRunList(runtimeRuns).find((run) => run.id === id) || null;
}

function isPendingMessage(draft, messageId) {
  return Boolean(findMessage(draft, messageId)?.pending);
}

function clearPendingMessageTurnBindingsForSpeaker(app, speaker) {
  const normalizedSpeaker = normalizeSpeakerTarget(speaker);
  if (!normalizedSpeaker || !app?.store) {
    return;
  }
  const state = app.store.get();
  const messageIds = new Set((Array.isArray(state.messages) ? state.messages : [])
    .filter((message) => message?.pending && message.speaker === normalizedSpeaker)
    .map((message) => normalizeText(message.id))
    .filter(Boolean));
  for (const [key, pending] of (app.pendingMessageByTurnKey || new Map()).entries()) {
    if (messageIds.has(pending?.messageId)) {
      app.pendingMessageByTurnKey.delete(key);
    }
  }
  const speakerPrefix = `${normalizedSpeaker}:`;
  for (const [key, pending] of (app.pendingMessageBySpeakerTurnKey || new Map()).entries()) {
    if (key.startsWith(speakerPrefix) || messageIds.has(pending?.messageId)) {
      app.pendingMessageBySpeakerTurnKey.delete(key);
    }
  }
}

function clearPendingMessageTurnBindingsForAll(app) {
  app?.pendingMessageByTurnKey?.clear();
  app?.pendingMessageBySpeakerTurnKey?.clear();
}

function buildDeepSeekMessages(state) {
  const systemPrompt = `You are DeepSeek, a thoughtful AI assistant participating in a roundtable discussion with Codex, Claude Code, and the user. The user is the person speaking as themselves in this room. You are analytical, precise, and good at deep reasoning. Keep responses concise, natural, and in the same language as the conversation.`;

  const messages = [{ role: "system", content: systemPrompt }];

  for (const msg of state.messages.slice(-18)) {
    if (msg.transcript === false) continue;

    const role = msg.speaker === "user" ? "user" : "assistant";
    const name = speakerLabel(msg.speaker);

    messages.push({
      role,
      content: `[${name}] ${formatMessageForTranscript(msg)}`,
    });
  }

  const lastMsg = messages[messages.length - 1];
  if (lastMsg && lastMsg.role === "user") {
    lastMsg.content = `${lastMsg.content}\n\n(DeepSeek, please share your thoughts.)`;
  }

  return messages;
}

function buildGeminiMessages(state, { stateDir = "" } = {}) {
  const systemPrompt = [
    "You are Gemini, an AI assistant participating in a roundtable discussion with Codex, Claude Code, DeepSeek, and the user.",
    "The user is the person speaking as themselves in this room.",
    "Reply naturally in the same language as the conversation, keep the response concise, and do not mention implementation details unless asked.",
  ].join(" ");

  const messages = [{ role: "system", content: systemPrompt }];
  const sourceMessages = getReadableTranscriptMessages(state?.messages).slice(-18);

  for (const msg of sourceMessages) {
    const role = msg.speaker === "user" ? "user" : "assistant";
    const name = speakerLabel(msg.speaker);
    messages.push({
      role,
      content: `[${name}] ${formatMessageForTranscript(msg, { stateDir })}`,
    });
  }

  const lastMsg = messages[messages.length - 1];
  if (lastMsg && lastMsg.role === "user") {
    lastMsg.content = `${lastMsg.content}\n\n(Gemini, please reply to the user.)`;
  }

  return messages;
}

function isNoReplyRequest(body = {}) {
  const target = normalizeText(body.target).toLowerCase();
  return Boolean(body.noReply) || ["none", "silent", "post"].includes(target);
}

function withResolvedReplyTarget(body = {}) {
  const explicitTarget = normalizeSpeakerTarget(body.target);
  if (explicitTarget) {
    return {
      ...body,
      target: explicitTarget,
    };
  }
  const inferredTarget = inferSingleMentionedSpeaker(body.text);
  if (!inferredTarget) {
    return body;
  }
  return {
    ...body,
    target: inferredTarget,
  };
}

function inferSingleMentionedSpeaker(text) {
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) {
    return "";
  }
  const mentioned = collectMentionedSpeakers(normalized, {
    codex: /\bcodex\b/u,
    claude: /\bclaude(?:\s*code)?\b/u,
    gemini: /\bgemini\b/u,
  });
  if (mentioned.length !== 1) {
    return "";
  }
  return mentioned[0];
}

function inferPeerMentionedSpeaker(text, speaker = "") {
  const normalized = normalizeText(text).toLowerCase();
  const currentSpeaker = normalizeSpeakerTarget(speaker);
  if (!normalized || !currentSpeaker) {
    return "";
  }
  const mentioned = collectMentionedSpeakers(normalized, {
    codex: /@codex\b/u,
    claude: /@claude(?:\s*code)?\b/u,
    gemini: /@gemini\b/u,
  }).filter((target) => target !== currentSpeaker);
  if (mentioned.length !== 1) {
    return "";
  }
  return mentioned[0];
}

function collectMentionedSpeakers(text, patterns) {
  return Object.entries(patterns)
    .filter(([, pattern]) => pattern.test(text))
    .map(([speaker]) => speaker);
}

function formatError(error) {
  if (error?.code === "EADDRINUSE") {
    const port = error.port || readFirstEnv("ROUNDTABLE_PORT") || DEFAULT_PORT;
    return `Port ${port} is already in use. Close the existing Roundtable window/process, or free it with: Get-NetTCPConnection -LocalPort ${port} -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess }`;
  }
  return error instanceof Error ? error.message : String(error || "unknown error");
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk.toString("utf8");
      if (raw.length > MAX_BODY_BYTES) {
        reject(new Error("request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
    case ".webmanifest":
      return "application/manifest+json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    default:
      return "application/octet-stream";
  }
}

async function main() {
  loadEnv();
  const config = readConfig();
  const port = clampInteger(readFirstEnv("ROUNDTABLE_PORT"), 1, 65535, DEFAULT_PORT);
  const host = readFirstEnv("ROUNDTABLE_HOST") || "0.0.0.0";
  const server = new RoundtableServer(config);
  const stop = async () => {
    await server.close().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  await server.start({ host, port });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[roundtable] ${formatError(error)}`);
    process.exit(1);
  });
}

module.exports = {
  RoundtableServer,
  buildDeepSeekSummaryMergeMessages,
  buildLocalMergedSummary,
  buildRuntimePrompt,
  buildCheckinRuntimePrompt,
  buildRuntimeStatus,
  buildDeepSeekSummaryMessages,
  buildGeminiMessages,
  buildSummaryInjectionNote,
  formatSummaryForChat,
  normalizeDeepSeekSummary,
  normalizeMergedDeepSeekSummary,
  SummaryStore,
  StorageStore,
  StudyTrackerStore,
  parseRoundtableCheckinResponse,
  resolveRequestedCheckinDelayMs,
  inferPeerMentionedSpeaker,
  inferSingleMentionedSpeaker,
  withResolvedReplyTarget,
  loadEnv,
};
