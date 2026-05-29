const os = require("os");
const fs = require("fs");
const path = require("path");

function readConfig() {
  const stateDir = readTextEnv("ROUNDTABLE_STATE_DIR")
    || path.join(os.homedir(), ".cyberboss-roundtable");
  const workspaceRoot = readTextEnv("ROUNDTABLE_WORKSPACE_ROOT")
    || process.cwd();

  return {
    mode: process.argv[2] || "",
    argv: process.argv.slice(2),
    stateDir,
    workspaceId: readTextEnv("ROUNDTABLE_WORKSPACE_ID") || "roundtable",
    workspaceRoot,
    codexEndpoint: readTextEnv("ROUNDTABLE_CODEX_ENDPOINT"),
    codexCommand: readTextEnv("ROUNDTABLE_CODEX_COMMAND"),
    codexAccessMode: readTextEnv("ROUNDTABLE_CODEX_ACCESS_MODE") || "default",
    codexModel: readTextEnv("ROUNDTABLE_CODEX_MODEL"),
    codexReasoningEffort: readTextEnv("ROUNDTABLE_CODEX_REASONING_EFFORT") || readTextEnv("ROUNDTABLE_CODEX_EFFORT"),
    turnTimeoutMs: readIntEnv("ROUNDTABLE_TURN_TIMEOUT_MS", 30 * 60 * 1000),
    turnStartTimeoutMs: readIntEnv("ROUNDTABLE_TURN_START_TIMEOUT_MS", 4 * 60 * 1000),
    claudeCommand: readTextEnv("ROUNDTABLE_CLAUDE_COMMAND") || resolveDefaultClaudeCommand(),
    claudeModel: readTextEnv("ROUNDTABLE_CLAUDE_MODEL"),
    claudePermissionMode: readTextEnv("ROUNDTABLE_CLAUDE_PERMISSION_MODE") || "default",
    claudeDisableVerbose: readBoolEnv("ROUNDTABLE_CLAUDE_DISABLE_VERBOSE"),
    claudeExtraArgs: readListEnv("ROUNDTABLE_CLAUDE_EXTRA_ARGS"),
    weixinInstructionsFile: readTextEnv("ROUNDTABLE_INSTRUCTIONS_FILE"),
    weixinOperationsFile: "",
    dbPath: readTextEnv("ROUNDTABLE_DB_PATH")
      || path.join(stateDir, "roundtable", "roundtable.db"),
    elevenLabsApiKey: readTextEnv("ELEVENLABS_API_KEY"),
    elevenLabsVoiceClaude: readTextEnv("ELEVENLABS_VOICE_CLAUDE"),
    elevenLabsVoiceCodex: readTextEnv("ELEVENLABS_VOICE_CODEX"),
  };
}

function readTextEnv(name) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function readBoolEnv(name) {
  const value = readTextEnv(name).toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function readIntEnv(name, fallback) {
  const parsed = parseInt(readTextEnv(name), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readListEnv(name) {
  return String(process.env[name] || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveDefaultClaudeCommand() {
  if (os.platform() !== "win32") {
    return "claude";
  }
  const candidates = [
    path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "npm", "claude.cmd"),
    path.join(os.homedir(), "AppData", "Roaming", "npm", "claude.cmd"),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // best effort
    }
  }
  return "claude";
}

module.exports = { readConfig };
