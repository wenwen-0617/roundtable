function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function normalizeIsoText(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "";
  }
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
}

function normalizePositiveInteger(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function readIntervalMs(rawValue, fallback) {
  const parsed = Number.parseInt(String(rawValue || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBooleanEnv(value, fallback) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (["0", "false", "no", "off", "disabled"].includes(normalized)) {
    return false;
  }
  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) {
    return true;
  }
  return fallback;
}

function readFirstEnv(...names) {
  for (const name of names) {
    const value = normalizeText(process.env[name]);
    if (value) {
      return value;
    }
  }
  return "";
}

function parseFirstJsonObject(text) {
  const normalized = String(text || "");
  const start = normalized.indexOf("{");
  const end = normalized.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }
  try {
    const parsed = JSON.parse(normalized.slice(start, end + 1));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function uniqueTextArray(values) {
  const seen = new Set();
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const item = normalizeText(value);
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function normalizeTextArray(value) {
  return Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter(Boolean)
    : [];
}

function formatLocalTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value || "");
  }
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date).replace(/\//g, "-");
}

function safeFileName(value) {
  return normalizeText(value).replace(/[^a-z0-9._-]/giu, "_");
}

function normalizeAttachments(value) {
  return (Array.isArray(value) ? value : [])
    .map((attachment) => ({
      name: normalizeText(attachment?.name),
      url: normalizeText(attachment?.url),
      mimeType: normalizeText(attachment?.mimeType || attachment?.mime_type),
      size: normalizePositiveInteger(attachment?.size),
    }))
    .filter((attachment) => attachment.url.startsWith("/uploads/"));
}

function speakerLabel(speaker) {
  switch (speaker) {
    case "codex":
      return "Codex";
    case "claude":
      return "Claude Code";
    case "deepseek":
      return "DeepSeek";
    case "gemini":
      return "Gemini";
    case "user":
      return "Wen";
    case "system":
      return "System";
    default:
      return speaker || "Unknown";
  }
}

function normalizeSpeakerTarget(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "codex") {
    return "codex";
  }
  if (normalized === "claude" || normalized === "claudecode" || normalized === "claude-code") {
    return "claude";
  }
  if (normalized === "deepseek") {
    return "deepseek";
  }
  if (normalized === "gemini") {
    return "gemini";
  }
  return "";
}

module.exports = {
  clampInteger,
  formatLocalTime,
  normalizeIsoText,
  normalizeAttachments,
  normalizePositiveInteger,
  normalizeSpeakerTarget,
  normalizeText,
  normalizeTextArray,
  parseFirstJsonObject,
  readBooleanEnv,
  readFirstEnv,
  readIntervalMs,
  safeFileName,
  speakerLabel,
  uniqueTextArray,
};
