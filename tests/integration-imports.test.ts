import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs/promises";
import path from "path";

describe("Integration: import consistency checks", () => {
  it("pr.ts imports commitFiles (not commitAll)", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src/commands/pr.ts"),
      "utf8"
    );
    assert.ok(
      source.includes("commitFiles"),
      "pr.ts should import commitFiles"
    );
    assert.ok(
      !source.includes("commitAll"),
      "pr.ts should NOT import commitAll"
    );
  });

  it("pr.ts imports parseRepoIdentifier", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src/commands/pr.ts"),
      "utf8"
    );
    assert.ok(
      source.includes("parseRepoIdentifier"),
      "pr.ts should import parseRepoIdentifier"
    );
  });

  it("pr.ts calls commitFiles with specific files", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src/commands/pr.ts"),
      "utf8"
    );
    assert.ok(
      source.includes('commitFiles(repoPath, [".vscode/settings.json", ".vscode/mcp.json"]'),
      "pr.ts should call commitFiles with specific .vscode files"
    );
  });

  it("BatchTui.tsx imports commitFiles (not commitAll)", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src/ui/BatchTui.tsx"),
      "utf8"
    );
    assert.ok(
      source.includes("commitFiles"),
      "BatchTui.tsx should import commitFiles"
    );
    assert.ok(
      !source.includes("commitAll"),
      "BatchTui.tsx should NOT import commitAll"
    );
  });

  it("BatchTui.tsx calls commitFiles with specific files", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src/ui/BatchTui.tsx"),
      "utf8"
    );
    assert.ok(
      source.includes('commitFiles(repoPath, [".github/copilot-instructions.md"]'),
      "BatchTui.tsx should call commitFiles with the instructions file only"
    );
  });

  it("BatchTui.tsx imports isValidGitHubName", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src/ui/BatchTui.tsx"),
      "utf8"
    );
    assert.ok(
      source.includes("isValidGitHubName"),
      "BatchTui.tsx should import isValidGitHubName"
    );
  });

  it("BatchTui.tsx validates repo names before path.join", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src/ui/BatchTui.tsx"),
      "utf8"
    );
    // Ensure validation happens before the path.join
    const validationIndex = source.indexOf("isValidGitHubName(repo.owner)");
    const pathJoinIndex = source.indexOf("path.join(cacheRoot, repo.owner, repo.name)");
    assert.ok(validationIndex > 0, "Should validate repo.owner");
    assert.ok(pathJoinIndex > 0, "Should use path.join with repo.owner and repo.name");
    assert.ok(
      validationIndex < pathJoinIndex,
      "Validation must happen BEFORE path.join"
    );
  });

  it("BatchTui.tsx passes cleanRemoteUrl in clone options", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src/ui/BatchTui.tsx"),
      "utf8"
    );
    assert.ok(
      source.includes("cleanRemoteUrl: cleanUrl"),
      "BatchTui.tsx should pass cleanRemoteUrl to cloneRepo"
    );
  });

  it("git.ts exports commitFiles function", async () => {
    const mod = await import("../src/services/git");
    assert.equal(typeof mod.commitFiles, "function");
  });

  it("git.ts marks commitAll as deprecated", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src/services/git.ts"),
      "utf8"
    );
    assert.ok(
      source.includes("@deprecated"),
      "commitAll should be marked @deprecated"
    );
  });

  it("git.ts CloneOptions includes cleanRemoteUrl", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src/services/git.ts"),
      "utf8"
    );
    assert.ok(
      source.includes("cleanRemoteUrl?: string"),
      "CloneOptions should include cleanRemoteUrl"
    );
  });
});
