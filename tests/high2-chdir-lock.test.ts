import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs/promises";
import path from "path";

describe("HIGH-2: process.chdir() concurrency guard", () => {
  it("instructions.ts declares a chdirLock variable", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src/services/instructions.ts"),
      "utf8"
    );
    assert.ok(
      source.includes("let chdirLock = false"),
      "Should declare chdirLock flag"
    );
  });

  it("instructions.ts checks chdirLock at function entry", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src/services/instructions.ts"),
      "utf8"
    );
    assert.ok(
      source.includes("if (chdirLock)"),
      "Should guard with chdirLock check"
    );
    assert.ok(
      source.includes("already running"),
      "Should throw descriptive error about concurrent calls"
    );
  });

  it("instructions.ts sets chdirLock = true before chdir", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src/services/instructions.ts"),
      "utf8"
    );
    // Find the lock set and chdir lines
    const lockSetIndex = source.indexOf("chdirLock = true");
    const chdirIndex = source.indexOf("process.chdir(repoPath)");
    assert.ok(lockSetIndex > 0, "Should set chdirLock = true");
    assert.ok(chdirIndex > 0, "Should call process.chdir");
    assert.ok(
      lockSetIndex < chdirIndex,
      "chdirLock must be set BEFORE process.chdir"
    );
  });

  it("instructions.ts resets chdirLock in finally block", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src/services/instructions.ts"),
      "utf8"
    );
    // The finally block should contain "chdirLock = false"
    const finallyIndex = source.lastIndexOf("finally");
    assert.ok(finallyIndex > 0, "Should have a finally block");

    // Find the reset that is NOT the initial declaration (skip "let chdirLock = false")
    const finallyBlock = source.substring(finallyIndex);
    assert.ok(
      finallyBlock.includes("chdirLock = false"),
      "chdirLock reset must appear inside the finally block"
    );
  });

  it("instructions.ts wraps assertCopilotCliReady in the outer try/finally that resets chdirLock", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src/services/instructions.ts"),
      "utf8"
    );

    const chdirCall = "process.chdir(repoPath)";
    const chdirIndex = source.indexOf(chdirCall);
    assert.ok(chdirIndex > 0, "Should call process.chdir(repoPath)");

    const afterChdir = source.substring(chdirIndex + chdirCall.length);
    const trimmedAfterChdir = afterChdir.replace(/^;\s*/, "");
    assert.ok(
      trimmedAfterChdir.startsWith("try {"),
      "An outer try { must immediately follow process.chdir(repoPath) (got: " +
        JSON.stringify(trimmedAfterChdir.substring(0, 40)) +
        ")"
    );

    const lastFinally = source.lastIndexOf("finally");
    assert.ok(lastFinally > 0, "Should have a finally block");
    const outermostFinallyBlock = source.substring(lastFinally);
    assert.ok(
      outermostFinallyBlock.includes("process.chdir(originalCwd)"),
      "Outermost finally must restore process.chdir(originalCwd)"
    );
    assert.ok(
      outermostFinallyBlock.includes("chdirLock = false"),
      "Outermost finally must reset chdirLock = false"
    );

    const assertCopilotIndex = source.indexOf("assertCopilotCliReady()");
    assert.ok(assertCopilotIndex > 0, "Should call assertCopilotCliReady()");
    const outerTryIndex = source.indexOf("try {", chdirIndex);
    assert.ok(outerTryIndex > 0, "Should have outer try block after chdir");
    assert.ok(
      assertCopilotIndex > outerTryIndex,
      "assertCopilotCliReady() must be inside the outer try block"
    );
    assert.ok(
      assertCopilotIndex < lastFinally,
      "assertCopilotCliReady() must come before the outermost finally"
    );
  });

  it("instructions.ts has TODO comment about SDK cwd option", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src/services/instructions.ts"),
      "utf8"
    );
    assert.ok(
      source.includes("// TODO:") && source.includes("cwd"),
      "Should have TODO comment about replacing chdir with SDK cwd option"
    );
  });
});
