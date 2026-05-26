const fs = require("fs");

function buildOpeningTurnText(config, userText) {
  const instructions = loadWechatInstructions(config);
  const normalizedText = String(userText || "").trim();
  if (!instructions) {
    return normalizedText;
  }
  return [
    instructions,
    "",
    normalizedText,
  ].join("\n").trim();
}

function buildInstructionRefreshText(config) {
  const instructions = loadWechatInstructions(config);
  const context = resolveSessionInstructionsContext(config);
  if (!instructions) {
    return `Refresh your ${context} behavior for this existing thread. Reply in one short Chinese sentence confirming that you have updated your behavior for this thread.`;
  }
  return [
    `Re-read and adopt the updated ${context} instructions below for the rest of this existing thread.`,
    "This is an internal refresh command, not a user-facing task.",
    "Do not summarize the instructions back in detail.",
    "Reply in one short Chinese sentence confirming that you have updated your behavior for this thread.",
    "",
    instructions,
  ].join("\n").trim();
}

function loadWechatInstructions(config = {}) {
  const persona = loadInstructionFile(config.weixinInstructionsFile, config);
  const operations = loadInstructionFile(config.weixinOperationsFile, config);
  const sections = [];
  if (persona) {
    sections.push(persona);
  }
  if (operations) {
    sections.push(operations);
  }
  return sections.join("\n\n").trim();
}

function resolveSessionInstructionsLabel(config = {}) {
  return normalizeInstructionText(config.sessionInstructionsLabel).toUpperCase() || "WECHAT";
}

function resolveSessionInstructionsContext(config = {}) {
  return normalizeInstructionText(config.sessionInstructionsContext) || "WeChat thread";
}

function normalizeInstructionText(value) {
  return typeof value === "string" ? value.trim() : "";
}

const instructionCache = new Map();

function loadInstructionFile(filePath, config = {}) {
  const normalizedPath = typeof filePath === "string" ? filePath.trim() : "";
  if (!normalizedPath) {
    return "";
  }
  try {
    const stat = fs.statSync(normalizedPath);
    const cacheKey = `${normalizedPath}:${stat.mtimeMs}`;
    const cached = instructionCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    const raw = fs.readFileSync(normalizedPath, "utf8");
    const result = renderInstructionTemplate(raw, config).trim();
    instructionCache.set(cacheKey, result);
    return result;
  } catch {
    return "";
  }
}

function renderInstructionTemplate(raw, config = {}) {
  return String(raw || "").replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/gi, (_match, key) => {
    const value = config[key] ?? config[String(key).toLowerCase()];
    return value == null ? "" : String(value);
  });
}

module.exports = {
  buildOpeningTurnText,
  buildInstructionRefreshText,
  loadWechatInstructions,
  loadInstructionFile,
};
