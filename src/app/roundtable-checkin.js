const {
  clampInteger,
  formatLocalTime,
  normalizeIsoText,
  normalizePositiveInteger,
  normalizeSpeakerTarget,
  normalizeText,
  parseFirstJsonObject,
  readBooleanEnv,
  readFirstEnv,
  readIntervalMs,
} = require("./roundtable-utils");

const DEFAULT_ROUNDTABLE_CHECKIN_MIN_MS = 10 * 60_000;
const DEFAULT_ROUNDTABLE_CHECKIN_MAX_MS = 60 * 60_000;
const ROUNDTABLE_CHECKIN_SPEAKERS = ["codex", "claude"];

class RoundtableCheckinStore {
  constructor({ db }) {
    if (!db) {
      throw new Error("RoundtableCheckinStore requires db");
    }
    this.db = db;
  }

  snapshot() {
    return this.loadState();
  }

  getSpeaker(speaker) {
    const normalizedSpeaker = normalizeSpeakerTarget(speaker);
    const row = normalizedSpeaker
      ? this.db.prepare("SELECT * FROM checkins WHERE speaker = ?").get(normalizedSpeaker)
      : null;
    return {
      ...defaultCheckinSpeakerState(normalizedSpeaker),
      ...(row ? checkinRowToState(row) : {}),
    };
  }

  setNextAt(speaker, nextAt, extra = {}) {
    const normalizedSpeaker = normalizeSpeakerTarget(speaker);
    if (!normalizedSpeaker) {
      return null;
    }
    const next = {
      ...defaultCheckinSpeakerState(normalizedSpeaker),
      ...this.getSpeaker(normalizedSpeaker),
      nextAt: normalizeIsoText(nextAt),
      ...extra,
    };
    this.writeSpeaker(normalizedSpeaker, next);
    return next;
  }

  recordAction(speaker, action = {}) {
    const normalizedSpeaker = normalizeSpeakerTarget(speaker);
    if (!normalizedSpeaker) {
      return null;
    }
    const current = {
      ...defaultCheckinSpeakerState(normalizedSpeaker),
      ...this.getSpeaker(normalizedSpeaker),
    };
    const next = {
      ...current,
      lastAt: new Date().toISOString(),
      lastAction: normalizeText(action.action),
      lastReason: normalizeText(action.reason),
      lastError: normalizeText(action.error),
    };
    this.writeSpeaker(normalizedSpeaker, next);
    return next;
  }

  loadState() {
    const rows = this.db.prepare("SELECT * FROM checkins ORDER BY speaker").all();
    const speakers = {};
    for (const row of rows) {
      speakers[row.speaker] = checkinRowToState(row);
    }
    return normalizeCheckinState({
      speakers,
      updatedAt: rows
        .map((row) => normalizeIsoText(row.updated_at))
        .filter(Boolean)
        .sort()
        .at(-1) || "",
    });
  }

  writeSpeaker(speaker, state) {
    const updatedAt = new Date().toISOString();
    this.db.prepare(
      `INSERT INTO checkins (
        speaker, enabled, min_interval_ms, max_interval_ms, next_at, last_at,
        last_action, last_reason, last_error, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(speaker) DO UPDATE SET
        enabled = excluded.enabled,
        min_interval_ms = excluded.min_interval_ms,
        max_interval_ms = excluded.max_interval_ms,
        next_at = excluded.next_at,
        last_at = excluded.last_at,
        last_action = excluded.last_action,
        last_reason = excluded.last_reason,
        last_error = excluded.last_error,
        updated_at = excluded.updated_at`
    ).run(
      speaker,
      state.enabled ? 1 : 0,
      state.minIntervalMs,
      state.maxIntervalMs,
      normalizeIsoText(state.nextAt),
      normalizeIsoText(state.lastAt),
      normalizeText(state.lastAction),
      normalizeText(state.lastReason),
      normalizeText(state.lastError),
      updatedAt,
    );
  }
}

class RoundtableCheckinPoller {
  constructor({ store, onWake }) {
    this.store = store;
    this.onWake = onWake;
    this.timers = new Map();
    this.closed = false;
    this.enabled = readBooleanEnv(readFirstEnv("ROUNDTABLE_CHECKIN_ENABLED"), true);
  }

  start() {
    if (!this.enabled) {
      console.log("[roundtable] check-in disabled");
      return;
    }
    console.log("[roundtable] check-in enabled for codex, claude");
    for (const speaker of ROUNDTABLE_CHECKIN_SPEAKERS) {
      this.scheduleSpeaker(speaker);
    }
  }

  close() {
    this.closed = true;
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  scheduleSpeaker(speaker, requestedDelayMs = 0) {
    if (this.closed || !this.enabled) {
      return;
    }
    const normalizedSpeaker = normalizeSpeakerTarget(speaker);
    if (!normalizedSpeaker) {
      return;
    }
    const current = this.store.getSpeaker(normalizedSpeaker);
    const range = resolveRoundtableCheckinRange(current);
    const existingDelayMs = delayUntil(current.nextAt);
    const delayMs = requestedDelayMs > 0
      ? requestedDelayMs
      : existingDelayMs > 0
        ? existingDelayMs
        : pickRandomDelayMs(range.minIntervalMs, range.maxIntervalMs);
    const nextAt = new Date(Date.now() + delayMs).toISOString();
    this.store.setNextAt(normalizedSpeaker, nextAt, {
      enabled: true,
      minIntervalMs: range.minIntervalMs,
      maxIntervalMs: range.maxIntervalMs,
    });
    clearTimeout(this.timers.get(normalizedSpeaker));
    this.timers.set(normalizedSpeaker, setTimeout(() => {
      void this.fireSpeaker(normalizedSpeaker);
    }, delayMs));
    console.log(`[roundtable] ${normalizedSpeaker} next check-in in ${formatDelayMinutes(delayMs)} at ${formatLocalTime(nextAt)}`);
  }

  async fireSpeaker(speaker) {
    if (this.closed || !this.enabled) {
      return;
    }
    const normalizedSpeaker = normalizeSpeakerTarget(speaker);
    let result = null;
    try {
      result = await this.onWake(normalizedSpeaker);
    } catch (error) {
      result = {
        action: "error",
        error: formatError(error),
      };
    }
    const requestedDelayMs = resolveRequestedCheckinDelayMs(result);
    this.scheduleSpeaker(normalizedSpeaker, requestedDelayMs);
  }
}

function parseRoundtableCheckinResponse(rawText) {
  const text = normalizeText(rawText);
  if (!text) {
    return { action: "silent" };
  }
  const parsed = parseFirstJsonObject(text);
  if (!parsed) {
    return looksLikeCheckinControl(text)
      ? { action: "silent" }
      : { action: "speak", message: text };
  }
  const action = normalizeText(parsed.action).toLowerCase();
  if (action === "silent") {
    return { action };
  }
  if (action === "remind_self") {
    return {
      action,
      afterMinutes: clampInteger(parsed.afterMinutes, 1, 24 * 60, 30),
    };
  }
  if (action === "move" || action === "speak") {
    return {
      action: "speak",
      message: normalizeText(parsed.message) || text,
    };
  }
  if (normalizeText(parsed.message)) {
    return { action: "speak", message: normalizeText(parsed.message) };
  }
  return { action: "silent" };
}

function looksLikeCheckinControl(text) {
  const normalized = normalizeText(text);
  return normalized.startsWith("{") || /"action"\s*:/iu.test(normalized);
}

function resolveRequestedCheckinDelayMs(result = {}) {
  const retryAfterMs = normalizePositiveInteger(result.retryAfterMs);
  if (retryAfterMs) {
    return retryAfterMs;
  }
  if (normalizeText(result.action).toLowerCase() === "remind_self") {
    const afterMinutes = clampInteger(result.afterMinutes, 1, 24 * 60, 30);
    return afterMinutes * 60_000;
  }
  return 0;
}

function resolveManualCheckinDelayMs(body = {}) {
  const afterMs = normalizePositiveInteger(body.afterMs);
  if (afterMs) {
    return afterMs;
  }
  const afterMinutes = normalizePositiveInteger(body.afterMinutes);
  if (afterMinutes) {
    return afterMinutes * 60_000;
  }
  const nextAt = normalizeIsoText(body.nextAt);
  if (nextAt) {
    const delayMs = Date.parse(nextAt) - Date.now();
    if (Number.isFinite(delayMs) && delayMs > 0) {
      return delayMs;
    }
  }
  throw new Error("set afterMinutes, afterMs, or nextAt");
}

function emptyCheckinState() {
  return normalizeCheckinState({});
}

function normalizeCheckinState(value) {
  const speakers = {};
  const sourceSpeakers = value?.speakers && typeof value.speakers === "object" ? value.speakers : {};
  for (const speaker of ROUNDTABLE_CHECKIN_SPEAKERS) {
    speakers[speaker] = {
      ...defaultCheckinSpeakerState(speaker),
      ...(sourceSpeakers[speaker] || {}),
    };
  }
  return {
    speakers,
    updatedAt: normalizeIsoText(value?.updatedAt),
  };
}

function defaultCheckinSpeakerState(speaker) {
  return {
    enabled: true,
    minIntervalMs: readIntervalMs(readFirstEnv("ROUNDTABLE_CHECKIN_MIN_INTERVAL_MS"), DEFAULT_ROUNDTABLE_CHECKIN_MIN_MS),
    maxIntervalMs: readIntervalMs(readFirstEnv("ROUNDTABLE_CHECKIN_MAX_INTERVAL_MS"), DEFAULT_ROUNDTABLE_CHECKIN_MAX_MS),
    nextAt: "",
    lastAt: "",
    lastAction: "",
    lastReason: "",
    lastError: "",
    speaker,
  };
}

function checkinRowToState(row) {
  return {
    speaker: normalizeSpeakerTarget(row?.speaker),
    enabled: Boolean(row?.enabled),
    minIntervalMs: readIntervalMs(row?.min_interval_ms, DEFAULT_ROUNDTABLE_CHECKIN_MIN_MS),
    maxIntervalMs: readIntervalMs(row?.max_interval_ms, DEFAULT_ROUNDTABLE_CHECKIN_MAX_MS),
    nextAt: normalizeIsoText(row?.next_at),
    lastAt: normalizeIsoText(row?.last_at),
    lastAction: normalizeText(row?.last_action),
    lastReason: normalizeText(row?.last_reason),
    lastError: normalizeText(row?.last_error),
  };
}

function resolveRoundtableCheckinRange(current = {}) {
  const configuredMinIntervalMs = readIntervalMs(
    readFirstEnv("ROUNDTABLE_CHECKIN_MIN_INTERVAL_MS"),
    DEFAULT_ROUNDTABLE_CHECKIN_MIN_MS
  );
  const configuredMaxIntervalMs = readIntervalMs(
    readFirstEnv("ROUNDTABLE_CHECKIN_MAX_INTERVAL_MS"),
    DEFAULT_ROUNDTABLE_CHECKIN_MAX_MS
  );
  const minIntervalMs = Math.max(
    configuredMinIntervalMs,
    readIntervalMs(current.minIntervalMs, configuredMinIntervalMs)
  );
  const maxIntervalMs = Math.max(
    minIntervalMs,
    configuredMaxIntervalMs,
    readIntervalMs(current.maxIntervalMs, Math.max(configuredMaxIntervalMs, minIntervalMs))
  );
  return { minIntervalMs, maxIntervalMs };
}

function delayUntil(value) {
  const normalized = normalizeIsoText(value);
  if (!normalized) {
    return 0;
  }
  const delayMs = Date.parse(normalized) - Date.now();
  return Number.isFinite(delayMs) && delayMs > 0 ? delayMs : 0;
}

function pickRandomDelayMs(minIntervalMs, maxIntervalMs) {
  if (maxIntervalMs <= minIntervalMs) {
    return minIntervalMs;
  }
  return minIntervalMs + Math.floor(Math.random() * (maxIntervalMs - minIntervalMs + 1));
}

function formatDelayMinutes(delayMs) {
  const minutes = Math.max(1, Math.round(delayMs / 60_000));
  return `${minutes}m`;
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error || "unknown error");
}

module.exports = {
  RoundtableCheckinPoller,
  RoundtableCheckinStore,
  parseRoundtableCheckinResponse,
  resolveRoundtableCheckinRange,
  resolveManualCheckinDelayMs,
  resolveRequestedCheckinDelayMs,
};
