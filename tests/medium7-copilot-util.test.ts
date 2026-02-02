import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs/promises";
import path from "path";

describe("MEDIUM-7: copilot utility extraction", () => {
  it("src/utils/copilot.ts exports findCopilotCliPath", async () => {
    const mod = await import("../src/utils/copilot");
    assert.equal(typeof mod.findCopilotCliPath, "function");
  });

  it("src/utils/copilot.ts exports assertCopilotCliReady", async () => {
    const mod = await import("../src/utils/copilot");
    assert.equal(typeof mod.assertCopilotCliReady, "function");
  });

  it("instructions.ts no longer contains findCopilotCliPath", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src/services/instructions.ts"),
      "utf8"
    );
    assert.ok(
      !source.includes("function findCopilotCliPath"),
      "instructions.ts should not define findCopilotCliPath"
    );
    assert.ok(
      !source.includes("function assertCopilotCliReady"),
      "instructions.ts should not define assertCopilotCliReady locally"
    );
    assert.ok(
      !source.includes('from "node:child_process"'),
      "instructions.ts should not import execFile directly"
    );
    assert.ok(
      !source.includes('from "node:util"'),
      "instructions.ts should not import promisify directly"
    );
  });

  it("evaluator.ts no longer contains findCopilotCliPath", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src/services/evaluator.ts"),
      "utf8"
    );
    assert.ok(
      !source.includes("function findCopilotCliPath"),
      "evaluator.ts should not define findCopilotCliPath"
    );
    assert.ok(
      !source.includes('from "node:child_process"'),
      "evaluator.ts should not import execFile directly"
    );
    assert.ok(
      !source.includes('from "node:util"'),
      "evaluator.ts should not import promisify directly"
    );
  });

  it("instructions.ts imports assertCopilotCliReady from utils/copilot", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src/services/instructions.ts"),
      "utf8"
    );
    assert.ok(
      source.includes('from "../utils/copilot"'),
      "instructions.ts should import from ../utils/copilot"
    );
  });

  it("evaluator.ts imports assertCopilotCliReady from utils/copilot", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src/services/evaluator.ts"),
      "utf8"
    );
    assert.ok(
      source.includes('from "../utils/copilot"'),
      "evaluator.ts should import from ../utils/copilot"
    );
  });

  it("copilot.ts uses fast-glob for wildcard paths", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src/utils/copilot.ts"),
      "utf8"
    );
    assert.ok(
      source.includes('import fg from "fast-glob"'),
      "copilot.ts should import fast-glob"
    );
    assert.ok(
      source.includes("await fg(pattern)"),
      "copilot.ts should use fg() to resolve glob patterns"
    );
    // Verify wildcards are only in the glob section, not in fs.access calls
    const staticSection = source.split("// Glob-based locations")[0];
    assert.ok(
      !staticSection.includes("copilot-chat-*"),
      "Static location paths should not contain wildcards"
    );
  });
});
