const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const {
  buildOpeningTurnText,
  buildInstructionRefreshText,
} = require("../src/adapters/runtime/shared-instructions");

test("roundtable opening turn includes configured instructions without wrapper", () => {
  const config = {
    sessionInstructionsLabel: "ROUNDTABLE",
    sessionInstructionsContext: "Roundtable Codex discussion",
    weixinInstructionsFile: path.resolve(__dirname, "..", "package.json"),
    weixinOperationsFile: "",
  };

  const opening = buildOpeningTurnText(config, "hi");
  assert.match(opening, /"name": "cyberboss-roundtable"/);
  assert.match(opening, /\nhi$/);
  assert.doesNotMatch(opening, /ROUNDTABLE SESSION INSTRUCTIONS/);
  assert.doesNotMatch(opening, /Current user message/);
  assert.doesNotMatch(opening, /WECHAT SESSION INSTRUCTIONS/);

  const refresh = buildInstructionRefreshText(config);
  assert.match(refresh, /^Re-read and adopt the updated Roundtable Codex discussion instructions/);
  assert.match(refresh, /updated Roundtable Codex discussion instructions/);
  assert.doesNotMatch(refresh, /SESSION INSTRUCTIONS/);
});
