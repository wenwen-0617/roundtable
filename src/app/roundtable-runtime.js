const { createCodexRuntimeAdapter } = require("../adapters/runtime/codex");
const { createClaudeCodeRuntimeAdapter } = require("../adapters/runtime/claudecode");
const {
  normalizeSpeakerTarget,
  normalizeText,
} = require("./roundtable-utils");

class RuntimeHub {
  constructor(config, {
    onEvent,
    resolveSpeakerInstructionsFile,
    turnTimeoutMs,
    turnStartTimeoutMs,
  }) {
    const baseRuntimeConfig = {
      ...config,
      codexAccessMode: config.codexAccessMode || "full-access",
    };
    const codexRuntimeConfig = {
      ...baseRuntimeConfig,
      weixinInstructionsFile: resolveSpeakerInstructionsFile("codex"),
      weixinOperationsFile: "",
      sessionInstructionsLabel: "ROUNDTABLE",
      sessionInstructionsContext: "Roundtable Codex discussion",
    };
    const claudeRuntimeConfig = {
      ...baseRuntimeConfig,
      weixinInstructionsFile: resolveSpeakerInstructionsFile("claude"),
      weixinOperationsFile: "",
      sessionInstructionsLabel: "ROUNDTABLE",
      sessionInstructionsContext: "Roundtable Claude Code discussion",
    };
    this.config = baseRuntimeConfig;
    this.workspaceRoot = config.workspaceRoot || process.cwd();
    this.turnTimeoutMs = turnTimeoutMs;
    this.turnStartTimeoutMs = turnStartTimeoutMs;
    this.adapters = {
      codex: createCodexRuntimeAdapter({ ...codexRuntimeConfig, runtime: "codex" }),
      claude: createClaudeCodeRuntimeAdapter({ ...claudeRuntimeConfig, runtime: "claudecode" }),
    };
    this.listeners = [];
    this.waitersBySpeaker = new Map();
    this.onEvent = onEvent;
    this.initializedSpeakers = new Set();
    this.initializingBySpeaker = new Map();
    this.listenerSpeakers = new Set();
  }

  async initializeSpeaker(speaker) {
    if (this.initializedSpeakers.has(speaker)) {
      return;
    }
    if (this.initializingBySpeaker.has(speaker)) {
      return await this.initializingBySpeaker.get(speaker);
    }
    const promise = this.initializeSpeakerNow(speaker);
    this.initializingBySpeaker.set(speaker, promise);
    try {
      await promise;
      this.initializedSpeakers.add(speaker);
    } finally {
      this.initializingBySpeaker.delete(speaker);
    }
  }

  async initializeSpeakerNow(speaker) {
    const adapter = this.adapters[speaker];
    if (!adapter) {
      throw new Error(`unknown speaker: ${speaker}`);
    }
    if (!this.listenerSpeakers.has(speaker)) {
      this.listeners.push(adapter.onEvent((event) => {
        this.dispatchToWaiters(speaker, event);
        this.onEvent?.({
          ...event,
          payload: {
            ...(event.payload || {}),
            speaker,
          },
        });
      }));
      this.listenerSpeakers.add(speaker);
    }
    await adapter.initialize();
  }

  async close() {
    for (const unsubscribe of this.listeners) {
      try {
        unsubscribe();
      } catch {
        // ignore
      }
    }
    await Promise.all(Object.values(this.adapters).map((adapter) => adapter.close().catch(() => {})));
  }

  getSavedThreadId(speaker, topicId = "") {
    const normalizedSpeaker = normalizeSpeakerTarget(speaker);
    const adapter = this.adapters[normalizedSpeaker];
    if (!adapter || typeof adapter.getSessionStore !== "function") {
      return "";
    }
    const bindingKey = buildRuntimeBindingKey(normalizedSpeaker, topicId);
    return normalizeText(adapter.getSessionStore().getThreadIdForWorkspace(bindingKey, this.workspaceRoot));
  }

  async sendTurn({ speaker, topicId = "", text, attachments = [], onTurnStarted = null, requireExistingThread = false }) {
    await this.initializeSpeaker(speaker);
    const adapter = this.adapters[speaker];
    if (!adapter) {
      throw new Error(`unknown speaker: ${speaker}`);
    }
    const bindingKey = buildRuntimeBindingKey(speaker, topicId);
    if (requireExistingThread && !this.getSavedThreadId(speaker, topicId)) {
      throw new Error(`no saved runtime thread for binding: ${bindingKey}`);
    }
    const completion = this.waitForCompletion(speaker, { timeoutMs: this.turnTimeoutMs });
    let completionPromise = null;
    const bindTurn = (turn) => {
      const speakerTurn = { ...turn, speaker };
      if (!completionPromise) {
        completionPromise = completion.expect(speakerTurn);
      }
      if (typeof onTurnStarted === "function") {
        onTurnStarted(speakerTurn);
      }
      return speakerTurn;
    };
    let turn = null;
    try {
      turn = await adapter.sendTextTurn({
        bindingKey,
        workspaceRoot: this.workspaceRoot,
        text,
        attachments,
        metadata: {
          workspaceId: "roundtable",
          accountId: "pwa",
          senderId: speaker,
        },
        model: speaker === "codex" ? this.config.codexModel : this.config.claudeModel,
        effort: speaker === "codex" ? this.config.codexReasoningEffort : "",
        accessMode: this.config.codexAccessMode,
        allowCreateThread: !requireExistingThread,
        onTurnStarted: bindTurn,
      });
    } catch (error) {
      completion.cancel(error);
      throw error;
    }
    if (!completionPromise) {
      bindTurn(turn);
    }
    return await completionPromise;
  }

  async startFreshSpeaker(speaker, { topicId = "" } = {}) {
    const normalizedSpeaker = normalizeSpeakerTarget(speaker);
    const adapter = this.adapters[normalizedSpeaker];
    if (!adapter) {
      throw new Error(`unknown speaker: ${speaker}`);
    }
    const bindingKey = buildRuntimeBindingKey(normalizedSpeaker, topicId);
    const sessionStore = adapter.getSessionStore();
    sessionStore.clearThreadIdForWorkspace(bindingKey, this.workspaceRoot);
    sessionStore.clearPendingThreadIdForWorkspace(bindingKey, this.workspaceRoot);
    const legacyBindingKey = `roundtable:${normalizedSpeaker}`;
    sessionStore.clearThreadIdForWorkspace(legacyBindingKey, this.workspaceRoot);
    sessionStore.clearPendingThreadIdForWorkspace(legacyBindingKey, this.workspaceRoot);
    if (typeof adapter.startFreshThreadDraft === "function") {
      await adapter.startFreshThreadDraft({ workspaceRoot: this.workspaceRoot }).catch(() => {});
    }
    if (normalizedSpeaker === "claude") {
      this.initializedSpeakers.delete(normalizedSpeaker);
    }
  }

  clearTopicBindings(topicId = "") {
    const normalizedTopicId = normalizeText(topicId);
    if (!normalizedTopicId) return;
    for (const speaker of Object.keys(this.adapters)) {
      const adapter = this.adapters[speaker];
      if (!adapter || typeof adapter.getSessionStore !== "function") {
        continue;
      }
      const bindingKey = buildRuntimeBindingKey(speaker, normalizedTopicId);
      const sessionStore = adapter.getSessionStore();
      sessionStore.clearThreadIdForWorkspace(bindingKey, this.workspaceRoot);
      sessionStore.clearPendingThreadIdForWorkspace(bindingKey, this.workspaceRoot);
    }
  }

  async respondApproval({ speaker, requestId, decision, result = null }) {
    const normalizedSpeaker = normalizeSpeakerTarget(speaker);
    const adapter = this.adapters[normalizedSpeaker];
    if (!adapter || typeof adapter.respondApproval !== "function") {
      throw new Error(`runtime does not support approvals: ${speaker}`);
    }
    return await adapter.respondApproval({ requestId, decision, result });
  }

  async cancelSpeakerTurn({ speaker, threadId = "", turnId = "" } = {}) {
    const normalizedSpeaker = normalizeSpeakerTarget(speaker);
    const adapter = this.adapters[normalizedSpeaker];
    if (!adapter || typeof adapter.cancelTurn !== "function") {
      throw new Error(`runtime does not support cancel: ${speaker}`);
    }
    this.cancelWaitersForSpeaker(normalizedSpeaker, new Error("runtime turn interrupted"));
    return await adapter.cancelTurn({
      threadId,
      turnId,
      workspaceRoot: this.workspaceRoot,
    });
  }

  waitForCompletion(speaker, { timeoutMs }) {
    const entry = createRuntimeWaiter({
      timeoutMs,
      startTimeoutMs: this.turnStartTimeoutMs,
      onDone: () => {
        const waiters = this.waitersBySpeaker.get(speaker) || new Set();
        waiters.delete(entry);
      },
    });
    const waiters = this.waitersBySpeaker.get(speaker) || new Set();
    waiters.add(entry);
    this.waitersBySpeaker.set(speaker, waiters);
    return entry;
  }

  cancelWaitersForSpeaker(speaker, error) {
    const waiters = this.waitersBySpeaker.get(speaker);
    if (!waiters?.size) {
      return;
    }
    for (const waiter of [...waiters]) {
      waiter.cancel(error);
    }
    waiters.clear();
  }

  dispatchToWaiters(speaker, event) {
    const waiters = this.waitersBySpeaker.get(speaker);
    if (!waiters?.size) {
      return;
    }
    for (const waiter of [...waiters]) {
      waiter.handle(event);
    }
  }
}

function createRuntimeWaiter({ timeoutMs, startTimeoutMs, onDone }) {
  const baseTimeoutMs = normalizeTimeoutMs(timeoutMs, 30 * 60_000);
  const initialTimeoutMs = normalizeTimeoutMs(startTimeoutMs, 4 * 60_000);
  const completions = new Map();
  const completionsByTurnId = new Map();
  let expected = "";
  let expectedTurnOnly = "";
  let settled = false;
  let rejectPromise = () => {};
  let timer = null;
  let approvalPending = false;
  let promiseDone = () => {};
  let hasStarted = false;

  const promise = new Promise((resolve, reject) => {
    rejectPromise = reject;
    const done = (value) => {
      cleanup();
      resolve(value);
    };
    promiseDone = done;
  });

  resetTimer(initialTimeoutMs, "runtime turn start timed out");

  function handle(event) {
    if (!event || settled) {
      return;
    }
    const payload = event.payload || {};
    const key = buildTurnKey(payload.threadId, payload.turnId);
    const turnOnlyKey = normalizeText(payload.turnId);
    if (!key && !turnOnlyKey) {
      return;
    }
    const current = getCompletion(key, turnOnlyKey) || {
      threadId: payload.threadId || "",
      turnId: payload.turnId || "",
      text: "",
      itemTexts: new Map(),
    };
    if (event.type === "runtime.turn.started") {
      hasStarted = true;
      setCompletion(key, turnOnlyKey, current);
      resetTimer(baseTimeoutMs);
      return;
    }
    if (event.type === "runtime.approval.requested") {
      hasStarted = true;
      approvalPending = true;
      resetTimer(Math.max(baseTimeoutMs, 30 * 60_000));
      return;
    }
    if (event.type === "runtime.approval.responded") {
      approvalPending = false;
      resetTimer(baseTimeoutMs);
      return;
    }
    if (event.type === "runtime.reply.delta") {
      hasStarted = true;
      addCompletionText(current, payload.text);
      setCompletion(key, turnOnlyKey, current);
      resetTimer(baseTimeoutMs);
      return;
    }
    if (event.type === "runtime.reply.completed") {
      hasStarted = true;
      addCompletionText(current, payload.text, { preferLatest: true });
      setCompletion(key, turnOnlyKey, current);
      resetTimer(baseTimeoutMs);
      return;
    }
    if (event.type === "runtime.turn.failed") {
      cleanup();
      rejectPromise(new Error(normalizeText(payload.error) || "runtime turn failed"));
      return;
    }
    if (event.type === "runtime.turn.completed") {
      hasStarted = true;
      addCompletionText(current, payload.text, { preferLatest: true });
      setCompletion(key, turnOnlyKey, current);
      maybeResolve();
    }
  }

  function getCompletion(key, turnOnlyKey) {
    return (key && completions.get(key))
      || (turnOnlyKey && completionsByTurnId.get(turnOnlyKey))
      || null;
  }

  function setCompletion(key, turnOnlyKey, current) {
    if (key) {
      completions.set(key, current);
    }
    if (turnOnlyKey) {
      completionsByTurnId.set(turnOnlyKey, current);
    }
  }

  function addCompletionText(current, text, { preferLatest = false } = {}) {
    const normalized = normalizeText(text);
    if (!normalized) {
      return;
    }
    current.text = preferLatest || normalized.length >= current.text.length ? normalized : current.text;
  }

  function maybeResolve() {
    if (!expected && !expectedTurnOnly) {
      return;
    }
    const current = getCompletion(expected, expectedTurnOnly);
    if (!current) {
      return;
    }
    promiseDone({
      threadId: current.threadId,
      turnId: current.turnId,
      text: current.text,
    });
  }

  function cleanup() {
    if (settled) {
      return;
    }
    settled = true;
    clearTimeout(timer);
    onDone?.();
  }

  function resetTimer(nextTimeoutMs, timeoutMessage = "") {
    clearTimeout(timer);
    timer = setTimeout(() => {
      cleanup();
      const message = timeoutMessage
        || (approvalPending ? "runtime approval timed out" : (hasStarted ? "runtime turn timed out" : "runtime turn start timed out"));
      rejectPromise(new Error(message));
    }, nextTimeoutMs);
  }

  return {
    handle,
    cancel(error) {
      cleanup();
      rejectPromise(error);
    },
    expect(turn) {
      expected = buildTurnKey(turn?.threadId, turn?.turnId);
      expectedTurnOnly = normalizeText(turn?.turnId);
      maybeResolve();
      return promise;
    },
  };
}

function normalizeTimeoutMs(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildTurnKey(threadId, turnId) {
  const thread = normalizeText(threadId);
  const turn = normalizeText(turnId);
  return thread && turn ? `${thread}:${turn}` : "";
}

function buildSpeakerTurnKey(speaker, turnId) {
  const normalizedSpeaker = normalizeSpeakerTarget(speaker);
  const turn = normalizeText(turnId);
  return normalizedSpeaker && turn ? `${normalizedSpeaker}:${turn}` : "";
}

function buildRuntimeBindingKey(speaker, topicId) {
  const normalizedSpeaker = normalizeSpeakerTarget(speaker) || "codex";
  const normalizedTopicId = normalizeText(topicId);
  return normalizedTopicId ? `roundtable:${normalizedTopicId}:${normalizedSpeaker}` : `roundtable:${normalizedSpeaker}`;
}

function isCheckinThreadUnavailableError(error) {
  const message = formatError(error).toLowerCase();
  return message.includes("no saved runtime thread")
    || message.includes("no saved codex thread")
    || message.includes("no saved claude code session")
    || message.includes("saved codex thread could not be resumed")
    || message.includes("saved claude code session could not be resumed");
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error || "unknown error");
}

module.exports = {
  RuntimeHub,
  buildSpeakerTurnKey,
  buildTurnKey,
  isCheckinThreadUnavailableError,
};
