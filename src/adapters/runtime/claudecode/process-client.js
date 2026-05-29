const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");

const IS_WINDOWS = os.platform() === "win32";

class ClaudeCodeProcessClient {
  constructor({ command = "claude", cwd, env, model = "", permissionMode = "default", disableVerbose = false, extraArgs = [], mcpConfigPaths = [], ipcServer = null, workspaceRoot = "" }) {
    this.command = command;
    this.cwd = cwd;
    this.env = env;
    this.model = model;
    this.permissionMode = permissionMode;
    this.disableVerbose = disableVerbose;
    this.extraArgs = extraArgs;
    this.mcpConfigPaths = mcpConfigPaths;
    this.ipcServer = ipcServer;
    this.workspaceRoot = workspaceRoot;
    this.child = null;
    this.stdin = null;
    this.stdoutBuffer = "";
    this.listeners = new Set();
    this.pendingTurnId = "";
    this.pendingReplyText = "";
    this.sessionId = "";
    this.resumeSessionId = "";
    this.activeThreadId = "";
    this.alive = false;
    this.sessionWaiters = new Set();
  }

  onMessage(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event, raw) {
    if (this.ipcServer) {
      this.ipcServer.broadcast({ type: "processEvent", event, raw });
    }
    for (const listener of this.listeners) {
      try {
        listener(event, raw);
      } catch {
        // ignore
      }
    }
  }

  async connect(resumeSessionId = "") {
    if (this.child) return;
    this.sessionId = "";
    this.resumeSessionId = isValidSessionId(resumeSessionId) ? resumeSessionId : "";
    this.activeThreadId = "";
    const args = buildArgs({
      model: this.model,
      permissionMode: this.permissionMode,
      disableVerbose: this.disableVerbose,
      extraArgs: this.extraArgs,
      mcpConfigPaths: this.mcpConfigPaths,
      resumeSessionId,
    });
    const mcpLabel = this.mcpConfigPaths.length
      ? this.mcpConfigPaths.join(",")
      : "(none)";
    console.log(
      `[claudecode-runtime] launching command=${this.command} cwd=${this.cwd} mcp_config=${mcpLabel}`
    );
    const spawnSpec = buildSpawnSpec(this.command, args);
    const child = spawn(spawnSpec.command, spawnSpec.args, {
      cwd: this.cwd,
      env: this.env,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
      windowsHide: true,
    });
    this.child = child;
    this.stdin = child.stdin;
    this.alive = true;

    child.stdout.on("data", (chunk) => {
      this.stdoutBuffer += chunk.toString("utf8");
      const lines = this.stdoutBuffer.split("\n");
      this.stdoutBuffer = lines.pop() || "";
      for (const line of lines) {
        this.handleLine(line.trim());
      }
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString("utf8").trim();
      if (text) {
        console.error(`[claudecode-runtime] stderr: ${text}`);
        this.emit({
          type: "stderr",
          text,
          turnId: this.pendingTurnId,
          sessionId: this.activeThreadId || this.sessionId,
        }, null);
        if (this.ipcServer && !isPotentiallySensitive(text)) {
          this.ipcServer.broadcast({ type: "stderr", text });
        }
      }
    });

    child.on("error", (err) => {
      this.rejectSessionWaiters(err);
      this.alive = false;
      this.child = null;
      this.stdin = null;
      this.emit({ type: "process.error", error: err.message, sessionId: this.activeThreadId || this.sessionId, turnId: this.pendingTurnId }, null);
    });

    child.on("close", (code) => {
      this.rejectSessionWaiters(new Error(`claudecode process closed with code ${code ?? "unknown"}`));
      this.alive = false;
      this.child = null;
      this.stdin = null;
      this.emit({ type: "process.close", code, sessionId: this.activeThreadId || this.sessionId, turnId: this.pendingTurnId }, null);
    });
  }

  handleLine(line) {
    if (!line) return;
    let raw;
    try {
      raw = JSON.parse(line);
    } catch {
      return;
    }
    const eventType = raw?.type;
    switch (eventType) {
      case "system":
        if (raw.session_id) {
          this.sessionId = raw.session_id;
          this.resumeSessionId = "";
          this.resolveSessionWaiters(raw.session_id);
          this.emit({ type: "session.id", sessionId: raw.session_id }, raw);
        }
        break;
      case "assistant":
        this.handleAssistant(raw);
        break;
      case "user":
        this.handleUser(raw);
        break;
      case "result":
        this.handleResult(raw);
        break;
      case "control_request":
        this.handleControlRequest(raw);
        break;
      case "control_cancel_request":
        break;
    }
  }

  handleAssistant(raw) {
    const usage = raw?.message?.usage;
    if (usage && typeof usage === "object") {
      this.emit({
        type: "context.updated",
        usage,
        turnId: this.pendingTurnId,
        sessionId: this.activeThreadId || this.sessionId,
      }, raw);
    }
    const content = raw?.message?.content;
    if (!Array.isArray(content)) return;
    for (const item of content) {
      if (!item || typeof item !== "object") continue;
      const itemType = item.type;
      if (itemType === "text" && typeof item.text === "string" && item.text) {
        this.pendingReplyText = item.text.trim();
        this.emit({
          type: "reply.completed",
          text: this.pendingReplyText,
          turnId: this.pendingTurnId,
          sessionId: this.activeThreadId || this.sessionId,
        }, raw);
      } else if (itemType === "tool_use") {
        const toolName = typeof item.name === "string" ? item.name : "";
        if (toolName === "AskUserQuestion") continue;
        this.emit({
          type: "tool.use",
          toolName,
          input: item.input || {},
          turnId: this.pendingTurnId,
          sessionId: this.activeThreadId || this.sessionId,
        }, raw);
      } else if (itemType === "thinking" && typeof item.thinking === "string" && item.thinking) {
        this.emit({
          type: "thinking",
          text: item.thinking.trim(),
          turnId: this.pendingTurnId,
          sessionId: this.activeThreadId || this.sessionId,
        }, raw);
      }
    }
  }

  handleUser(raw) {
    const content = raw?.message?.content;
    if (!Array.isArray(content)) return;
    for (const item of content) {
      if (!item || typeof item !== "object") continue;
      if (item.type === "tool_result") {
        const isError = Boolean(item.is_error);
        const resultText = typeof item.content === "string" ? item.content : "";
        this.emit({
          type: "tool.result",
          toolResult: resultText,
          isError,
          turnId: this.pendingTurnId,
          sessionId: this.activeThreadId || this.sessionId,
        }, raw);
      }
    }
  }

  handleResult(raw) {
    if (raw.session_id) {
      this.sessionId = raw.session_id;
      this.resumeSessionId = "";
    }
    const resultText = typeof raw.result === "string" && raw.result.trim()
      ? raw.result.trim()
      : this.pendingReplyText;
    this.emit({
      type: "turn.completed",
      turnId: this.pendingTurnId,
      sessionId: this.activeThreadId || this.sessionId,
      text: resultText,
    }, raw);
    this.pendingTurnId = "";
    this.pendingReplyText = "";
    this.activeThreadId = "";
  }

  handleControlRequest(raw) {
    const request = raw?.request || {};
    if (request.subtype !== "can_use_tool") return;
    this.emit({
      type: "approval.requested",
      requestId: raw.request_id,
      toolName: request.tool_name,
      input: request.input,
      sessionId: this.activeThreadId || this.sessionId,
      turnId: this.pendingTurnId,
    }, raw);
  }

  async sendUserMessage({ text, attachments = [], threadId, onTurnStarted = null }) {
    if (!this.alive || !this.stdin) {
      throw new Error("claudecode process not running");
    }
    const turnId = `turn-${Date.now()}`;
    this.pendingTurnId = turnId;
    this.pendingReplyText = "";
    this.activeThreadId = threadId || this.sessionId;
    const started = { turnId, threadId: this.activeThreadId };
    if (typeof onTurnStarted === "function") {
      onTurnStarted(started);
    }
    if (this.ipcServer) {
      this.ipcServer.broadcast({
        type: "inboundMessage",
        workspaceRoot: this.workspaceRoot,
        text,
      });
    }
    const payload = JSON.stringify({
      type: "user",
      message: { role: "user", content: buildClaudeContent(text, attachments) },
    });
    this.stdin.write(payload + "\n");
    this.emit({
      type: "turn.started",
      turnId: this.pendingTurnId,
      sessionId: this.activeThreadId,
    }, null);
    return started;
  }

  async sendResponse(requestId, { decision }) {
    if (!this.alive || !this.stdin) {
      throw new Error("claudecode process not running");
    }
    const behavior = decision === "accept" ? "allow" : "deny";
    const response = behavior === "allow"
      ? { behavior: "allow", updatedInput: {} }
      : { behavior: "deny", message: "The user denied this tool use. Stop and wait for the user's instructions." };
    const payload = JSON.stringify({
      type: "control_response",
      response: {
        subtype: "success",
        request_id: requestId,
        response,
      },
    });
    this.stdin.write(payload + "\n");
  }

  async waitForSessionId({ timeoutMs = 5000 } = {}) {
    if (this.sessionId) {
      return this.sessionId;
    }
    if (!this.alive) {
      throw new Error("claudecode process not running");
    }
    const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 5000;
    const promise = new Promise((resolve, reject) => {
      const entry = { resolve, reject, timer: null };
      entry.timer = setTimeout(() => {
        this.sessionWaiters.delete(entry);
        reject(new Error("timed out waiting for claudecode session id"));
      }, timeout);
      this.sessionWaiters.add(entry);
    });
    // The process can die before the caller awaits this promise. Attach a noop
    // rejection handler here so that Node does not treat that race as fatal;
    // callers that await still receive the same rejection.
    promise.catch(() => {});
    return await promise;
  }

  async close() {
    if (!this.child) return;
    if (this.stdin && !this.stdin.destroyed) {
      this.stdin.end();
    }
    if (this.child && !this.child.killed) {
      await Promise.race([
        new Promise((resolve) => setTimeout(resolve, 2000)),
        new Promise((resolve) => this.child.once("close", resolve)),
      ]);
    }
    if (this.child && !this.child.killed) {
      this.child.kill("SIGTERM");
      await Promise.race([
        new Promise((resolve) => setTimeout(resolve, 3000)),
        new Promise((resolve) => this.child.once("close", resolve)),
      ]);
    }
    if (this.child && !this.child.killed) {
      this.child.kill("SIGKILL");
      await Promise.race([
        new Promise((resolve) => setTimeout(resolve, 1000)),
        new Promise((resolve) => this.child.once("close", resolve)),
      ]);
    }
    this.alive = false;
    this.child = null;
    this.stdin = null;
    this.sessionId = "";
    this.resumeSessionId = "";
    this.activeThreadId = "";
    this.pendingTurnId = "";
    this.pendingReplyText = "";
    this.rejectSessionWaiters(new Error("claudecode process closed"));
  }

  resolveSessionWaiters(sessionId) {
    if (!this.sessionWaiters.size) {
      return;
    }
    for (const entry of this.sessionWaiters) {
      clearTimeout(entry.timer);
      entry.resolve(sessionId);
    }
    this.sessionWaiters.clear();
  }

  rejectSessionWaiters(error) {
    if (!this.sessionWaiters.size) {
      return;
    }
    for (const entry of this.sessionWaiters) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    this.sessionWaiters.clear();
  }
}

function buildSpawnSpec(command, args) {
  if (IS_WINDOWS) {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", quoteCmdCommand(command), ...args],
    };
  }
  return { command, args };
}

function quoteCmdCommand(command) {
  const normalized = String(command || "").trim();
  return /\s/u.test(normalized) ? `"${normalized.replace(/"/gu, '\\"')}"` : normalized;
}

function buildArgs({ model, permissionMode, disableVerbose, extraArgs, mcpConfigPaths, resumeSessionId }) {
  const args = [
    "--print",
    "--output-format", "stream-json",
    "--input-format", "stream-json",
    "--permission-prompt-tool", "stdio",
    "--strict-mcp-config",
  ];
  if (!disableVerbose) {
    args.push("--verbose");
  }
  if (permissionMode && permissionMode !== "default") {
    args.push("--permission-mode", permissionMode);
  }
  if (resumeSessionId && isValidSessionId(resumeSessionId)) {
    args.push("--resume", resumeSessionId);
  }
  if (model) {
    args.push("--model", model);
  }
  if (Array.isArray(mcpConfigPaths)) {
    for (const configPath of mcpConfigPaths) {
      if (typeof configPath === "string" && configPath.trim()) {
        args.push("--mcp-config", configPath.trim());
      }
    }
  }
  if (Array.isArray(extraArgs)) {
    const safe = extraArgs.filter((arg) =>
      typeof arg === "string" && arg.length > 0 && !/^-[ce]\b/i.test(arg)
    );
    args.push(...safe);
  }
  return args;
}

function isValidSessionId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value));
}

const SENSITIVE_KEYWORDS = /\b(?:key|token|secret|password|credential|api[_-]?key|auth[_-]?token|access[_-]?token|private[_-]?key)\b/i;
const SENSITIVE_PATTERNS = /\b(?:sk-[a-zA-Z0-9]{20,}|Bearer\s+[a-zA-Z0-9_\-]{20,}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36})\b/i;

function isPotentiallySensitive(text) {
  return SENSITIVE_KEYWORDS.test(text) || SENSITIVE_PATTERNS.test(text);
}

module.exports = { ClaudeCodeProcessClient };

function buildClaudeContent(text, attachments = []) {
  const blocks = [];
  for (const attachment of Array.isArray(attachments) ? attachments : []) {
    const localPath = typeof attachment?.localPath === "string" ? attachment.localPath.trim() : "";
    const mimeType = typeof attachment?.mimeType === "string" ? attachment.mimeType.trim() : "";
    if (!localPath || !mimeType) {
      continue;
    }
    try {
      const buffer = fs.readFileSync(localPath);
      if (mimeType.startsWith("image/")) {
        blocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: mimeType,
            data: buffer.toString("base64"),
          },
        });
      } else if (mimeType === "application/pdf") {
        blocks.push({
          type: "document",
          source: {
            type: "base64",
            media_type: mimeType,
            data: buffer.toString("base64"),
          },
        });
      } else if (isInlineTextMimeType(mimeType)) {
        const content = buffer.toString("utf8").slice(0, 24_000);
        blocks.push({
          type: "text",
          text: `[Attached file: ${attachment.name || attachment.url || localPath}]\n${content}`,
        });
      }
    } catch {
      // The textual prompt still contains the attachment manifest.
    }
  }
  if (text) {
    blocks.push({ type: "text", text });
  }
  if (!blocks.length) {
    return text;
  }
  return blocks.length === 1 && blocks[0].type === "text" ? blocks[0].text : blocks;
}

function isInlineTextMimeType(mimeType) {
  return [
    "text/plain",
    "text/markdown",
    "application/json",
    "text/csv",
  ].includes(mimeType);
}

module.exports.buildClaudeContent = buildClaudeContent;

function isPendingThreadId(threadId) {
  return /^pending-\d+$/u.test(String(threadId || "").trim());
}
