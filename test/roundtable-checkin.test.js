const test = require("node:test");
const assert = require("node:assert/strict");

const {
  RoundtableServer,
  buildRuntimePrompt,
  buildCheckinRuntimePrompt,
  parseRoundtableCheckinResponse,
  resolveRequestedCheckinDelayMs,
} = require("../src/app/roundtable-server");
const { resolveRoundtableCheckinRange } = require("../src/app/roundtable-checkin");

test("roundtable check-in parser accepts speak JSON and legacy move JSON", () => {
  assert.deepEqual(
    parseRoundtableCheckinResponse('{"action":"speak","message":"早，用户。我醒了。"}'),
    {
      action: "speak",
      message: "早，用户。我醒了。",
    }
  );
  assert.deepEqual(
    parseRoundtableCheckinResponse('{"action":"move","message":"早，用户。我醒了。"}'),
    {
      action: "speak",
      message: "早，用户。我醒了。",
    }
  );
});

test("roundtable check-in parser accepts silent and remind_self JSON", () => {
  assert.deepEqual(
    parseRoundtableCheckinResponse('{"action":"silent"}'),
    {
      action: "silent",
    }
  );
  assert.deepEqual(
    parseRoundtableCheckinResponse('{"action":"remind_self","afterMinutes":20}'),
    {
      action: "remind_self",
      afterMinutes: 20,
    }
  );
  assert.equal(resolveRequestedCheckinDelayMs({ action: "remind_self", afterMinutes: 20 }), 20 * 60_000);
});

test("roundtable check-in parser treats non-JSON as a group message", () => {
  assert.deepEqual(parseRoundtableCheckinResponse("我醒了，来看看桌上有什么。"), {
    action: "speak",
    message: "我醒了，来看看桌上有什么。",
  });
});

test("roundtable check-in parser never posts control JSON as chat text", () => {
  assert.deepEqual(parseRoundtableCheckinResponse('{"action":"silent"}'), {
    action: "silent",
  });
  assert.deepEqual(parseRoundtableCheckinResponse('{"action":"silent"'), {
    action: "silent",
  });
});

test("roundtable check-in prompt stays compact and includes action choices", () => {
  const prompt = buildCheckinRuntimePrompt({
    speaker: "codex",
    state: {
      topic: "大家好",
      messages: [
        { speaker: "user", text: "早上好" },
        { speaker: "claude", text: "早。" },
      ],
    },
  });
  assert.match(prompt, /^check-in/);
  assert.match(prompt, /Time: \d{4}-\d{2}-\d{2} \d{2}:\d{2} /);
  assert.match(prompt, /This is your time/);
  assert.match(prompt, /"action":"remind_self"/);
  assert.match(prompt, /"action":"speak"/);
  assert.doesNotMatch(prompt, /Current server time/);
  assert.doesNotMatch(prompt, /Shared task state/);
  assert.doesNotMatch(prompt, /Topic:/);
  assert.doesNotMatch(prompt, /DeepSeek is not part of automatic check-ins/);
  assert.ok(prompt.length < 950);
  assert.match(prompt, /Wen: 早上好/);
});

test("roundtable check-in does not create a runtime thread when none is saved", async () => {
  const calls = [];
  const appLike = Object.assign(Object.create(RoundtableServer.prototype), {
    store: {
      get() {
        return {
          id: "topic-1",
          running: false,
        };
      },
    },
    runtimeHub: {
      getSavedThreadId() {
        return "";
      },
      async sendTurn() {
        calls.push("sendTurn");
        return "";
      },
    },
    appendCheckinEvent(speaker, action) {
      calls.push(`${speaker}:${action}`);
    },
  });

  const result = await RoundtableServer.prototype.runCheckinSpeaker.call(appLike, "codex");

  assert.equal(result.action, "skipped_no_thread");
  assert.equal(result.retryAfterMs, undefined);
  assert.deepEqual(calls, ["codex:skipped_no_thread"]);
});

test("roundtable check-in busy skip waits for the normal random schedule", async () => {
  const calls = [];
  const appLike = Object.assign(Object.create(RoundtableServer.prototype), {
    store: {
      get() {
        return {
          id: "topic-1",
          running: true,
        };
      },
    },
    appendCheckinEvent(speaker, action) {
      calls.push(`${speaker}:${action}`);
    },
  });

  const result = await RoundtableServer.prototype.runCheckinSpeaker.call(appLike, "claude");

  assert.equal(result.action, "skipped_busy");
  assert.equal(result.retryAfterMs, undefined);
  assert.deepEqual(calls, ["claude:skipped_busy"]);
});

test("roundtable check-in range recovers stale one-minute stored intervals", () => {
  const previousMin = process.env.ROUNDTABLE_CHECKIN_MIN_INTERVAL_MS;
  const previousMax = process.env.ROUNDTABLE_CHECKIN_MAX_INTERVAL_MS;
  delete process.env.ROUNDTABLE_CHECKIN_MIN_INTERVAL_MS;
  delete process.env.ROUNDTABLE_CHECKIN_MAX_INTERVAL_MS;
  try {
    assert.deepEqual(
      resolveRoundtableCheckinRange({ minIntervalMs: 60_000, maxIntervalMs: 60_000 }),
      { minIntervalMs: 10 * 60_000, maxIntervalMs: 60 * 60_000 }
    );
  } finally {
    if (previousMin === undefined) {
      delete process.env.ROUNDTABLE_CHECKIN_MIN_INTERVAL_MS;
    } else {
      process.env.ROUNDTABLE_CHECKIN_MIN_INTERVAL_MS = previousMin;
    }
    if (previousMax === undefined) {
      delete process.env.ROUNDTABLE_CHECKIN_MAX_INTERVAL_MS;
    } else {
      process.env.ROUNDTABLE_CHECKIN_MAX_INTERVAL_MS = previousMax;
    }
  }
});

test("roundtable check-in accepts structured runtime turn results", async () => {
  const applied = [];
  const state = {
    id: "topic-1",
    running: false,
    topic: "main",
    messages: [],
  };
  const appLike = Object.assign(Object.create(RoundtableServer.prototype), {
    store: {
      get() {
        return JSON.parse(JSON.stringify(state));
      },
      update(mutator) {
        Object.assign(state, mutator(JSON.parse(JSON.stringify(state))));
        return state;
      },
    },
    runtimeHub: {
      getSavedThreadId() {
        return "thread-1";
      },
      async sendTurn() {
        return {
          threadId: "thread-1",
          turnId: "turn-1",
          text: '{"action":"silent"}',
        };
      },
    },
    checkinStore: {
      getSpeaker() {
        return {};
      },
    },
    appendCheckinEvent() {},
    applyCheckinAction(speaker, action, rawText) {
      applied.push({ speaker, action, rawText });
    },
  });

  const result = await RoundtableServer.prototype.runCheckinSpeaker.call(appLike, "codex");

  assert.deepEqual(result, { action: "silent" });
  assert.deepEqual(applied, [{
    speaker: "codex",
    action: { action: "silent" },
    rawText: '{"action":"silent"}',
  }]);
});

test("roundtable runtime prompt sends only unread messages for a speaker", () => {
  const state = {
    topic: "大家好",
    round: 0,
    maxRounds: 4,
    messages: [
      { id: "m1", speaker: "user", text: "旧消息" },
      { id: "m2", speaker: "codex", text: "旧回复" },
      { id: "m3", speaker: "user", text: "新消息" },
      { id: "pending", speaker: "codex", text: "", pending: true },
    ],
    lastSeenMessageIdBySpeaker: {
      codex: "m2",
      claude: "",
    },
  };
  const prompt = buildRuntimePrompt({ speaker: "codex", state });
  assert.doesNotMatch(prompt, /旧消息/);
  assert.doesNotMatch(prompt, /旧回复/);
  assert.match(prompt, /Wen: 新消息/);
  assert.match(prompt, /Time: \d{4}-\d{2}-\d{2} \d{2}:\d{2} /);
  assert.doesNotMatch(prompt, /UTC \d{4}-\d{2}-\d{2}T/);
  assert.doesNotMatch(prompt, /Shared task state:/);
  assert.match(prompt, /Unread:/);
  assert.doesNotMatch(prompt, /Unread messages since your last turn/);
  assert.doesNotMatch(prompt, /Codex roundtable update/);
  assert.doesNotMatch(prompt, /casual group chat between Codex/);
  assert.doesNotMatch(prompt, /Topic:/);
  assert.doesNotMatch(prompt, /Round:/);
  assert.doesNotMatch(prompt, /reply naturally in plain chat text/);
});

test("roundtable opening prompt uses speaker-specific peer mention instructions", () => {
  const state = {
    topic: "固定：主厅",
    round: 0,
    messages: [
      { id: "m1", speaker: "user", text: "醒来看到什么" },
    ],
    lastSeenMessageIdBySpeaker: {},
  };
  const codexPrompt = buildRuntimePrompt({ speaker: "codex", state });
  assert.match(codexPrompt, /This is a casual group chat between Codex, Claude Code, DeepSeek, Gemini, and Wen\./);
  assert.match(codexPrompt, /To have Claude Code reply next, mention @Claude\./);
  assert.match(codexPrompt, /Topic: 主厅/);
  assert.match(codexPrompt, /Recent transcript:\s+Wen: 醒来看到什么/s);
  assert.match(codexPrompt, /Codex, reply naturally in plain chat text\./);
  assert.doesNotMatch(codexPrompt, /Round:/);

  const claudePrompt = buildRuntimePrompt({ speaker: "claude", state });
  assert.match(claudePrompt, /To have Codex reply next, mention @Codex\./);
  assert.match(claudePrompt, /Claude Code, reply naturally in plain chat text\./);
});

test("fresh runtime transcript hides summary injections for other speakers", () => {
  const state = {
    topic: "private injection",
    round: 0,
    maxRounds: 4,
    messages: [
      { id: "m1", speaker: "user", text: "shared note" },
      {
        id: "m2",
        speaker: "system",
        text: "Summary context injected for Codex.\n\nCodex-only summary body",
        label: "Summary Inject",
        transcript: true,
        injectionTarget: "codex",
      },
      {
        id: "m3",
        speaker: "system",
        text: "Summary context injected for Claude Code.\n\nClaude-only summary body",
        label: "Summary Inject",
        transcript: true,
        injectionTarget: "claude",
      },
    ],
    freshRuntimeHandoffs: {
      claude: "Claude fresh handoff",
    },
    lastSeenMessageIdBySpeaker: {
      claude: "",
    },
  };

  const prompt = buildRuntimePrompt({ speaker: "claude", state });
  assert.match(prompt, /Wen: shared note/);
  assert.match(prompt, /Claude-only summary body/);
  assert.doesNotMatch(prompt, /Codex-only summary body/);
});

test("roundtable clears pending turn bindings when a message fails", () => {
  const appLike = Object.assign(Object.create(RoundtableServer.prototype), {
    pendingMessageByTurnKey: new Map([
      ["thread-1::turn-1", { messageId: "m-timeout" }],
      ["thread-2::turn-2", { messageId: "m-ok" }],
    ]),
    pendingMessageBySpeakerTurnKey: new Map([
      ["codex::turn-1", { messageId: "m-timeout" }],
      ["codex::turn-2", { messageId: "m-ok" }],
    ]),
  });

  RoundtableServer.prototype.clearPendingMessageTurnBindings.call(appLike, "m-timeout");

  assert.deepEqual([...appLike.pendingMessageByTurnKey.keys()], ["thread-2::turn-2"]);
  assert.deepEqual([...appLike.pendingMessageBySpeakerTurnKey.keys()], ["codex::turn-2"]);
});

test("roundtable clears pending turn bindings for an interrupted speaker", () => {
  const state = {
    messages: [
      { id: "m-codex", speaker: "codex", text: "", pending: true },
      { id: "m-claude", speaker: "claude", text: "", pending: true },
    ],
  };
  const appLike = Object.assign(Object.create(RoundtableServer.prototype), {
    store: {
      get() {
        return state;
      },
    },
    pendingMessageByTurnKey: new Map([
      ["thread-1:turn-1", { messageId: "m-codex" }],
      ["thread-2:turn-2", { messageId: "m-claude" }],
    ]),
    pendingMessageBySpeakerTurnKey: new Map([
      ["codex:turn-1", { messageId: "m-codex" }],
      ["claude:turn-2", { messageId: "m-claude" }],
    ]),
  });

  RoundtableServer.prototype.clearPendingMessageTurnBindingsForSpeaker.call(appLike, "codex");

  assert.deepEqual([...appLike.pendingMessageByTurnKey.keys()], ["thread-2:turn-2"]);
  assert.deepEqual([...appLike.pendingMessageBySpeakerTurnKey.keys()], ["claude:turn-2"]);
});

test("roundtable ignores late runtime text after an interrupt", () => {
  const state = {
    messages: [{ id: "m-codex", speaker: "codex", text: "Interrupted by the user.", pending: false }],
    runtimeRuns: [],
    events: [],
    pendingApprovals: [],
  };
  const store = {
    get() {
      return state;
    },
    update(mutator) {
      Object.assign(state, mutator(state));
      return state;
    },
    updateTransient(mutator) {
      Object.assign(state, mutator(state));
      return state;
    },
  };
  const appLike = Object.assign(Object.create(RoundtableServer.prototype), {
    store,
    pendingMessageByTurnKey: new Map([["thread-1:turn-1", { messageId: "m-codex" }]]),
    pendingMessageBySpeakerTurnKey: new Map([["codex:turn-1", { messageId: "m-codex" }]]),
  });

  RoundtableServer.prototype.appendSystemEvent.call(appLike, {
    type: "runtime.reply.completed",
    payload: {
      speaker: "codex",
      threadId: "thread-1",
      turnId: "turn-1",
      text: "late answer",
    },
  });

  assert.equal(state.messages[0].text, "Interrupted by the user.");
  assert.equal(appLike.pendingMessageByTurnKey.size, 0);
  assert.equal(appLike.pendingMessageBySpeakerTurnKey.size, 0);
});

test("roundtable uses turn completion text over longer assistant fragments", () => {
  const state = {
    messages: [{ id: "m-claude", speaker: "claude", text: "", pending: true }],
    runtimeRuns: [],
    events: [],
    pendingApprovals: [],
  };
  const store = {
    get() {
      return state;
    },
    update(mutator) {
      Object.assign(state, mutator(state));
      return state;
    },
    updateTransient(mutator) {
      Object.assign(state, mutator(state));
      return state;
    },
  };
  const appLike = Object.assign(Object.create(RoundtableServer.prototype), {
    store,
    pendingMessageByTurnKey: new Map([["thread-1:turn-1", { messageId: "m-claude" }]]),
    pendingMessageBySpeakerTurnKey: new Map([["claude:turn-1", { messageId: "m-claude" }]]),
  });

  RoundtableServer.prototype.appendSystemEvent.call(appLike, {
    type: "runtime.reply.completed",
    payload: {
      speaker: "claude",
      threadId: "thread-1",
      turnId: "turn-1",
      text: "This is a much longer pre-tool fragment that should not win.",
    },
  });
  RoundtableServer.prototype.appendSystemEvent.call(appLike, {
    type: "runtime.turn.completed",
    payload: {
      speaker: "claude",
      threadId: "thread-1",
      turnId: "turn-1",
      text: "Final answer.",
    },
  });

  assert.equal(state.messages[0].text, "Final answer.");
  assert.equal(state.messages[0].pending, false);
  assert.equal(appLike.pendingMessageByTurnKey.size, 0);
  assert.equal(appLike.pendingMessageBySpeakerTurnKey.size, 0);
});
