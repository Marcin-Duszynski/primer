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
