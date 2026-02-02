import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs/promises";
import path from "path";
import os from "os";
import simpleGit from "simple-git";
import { commitFiles } from "../src/services/git";

describe("MEDIUM-5: commitFiles stages only listed files", () => {
  it("commits only the specified files, leaving others unstaged", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "primer-test-m5-"));

    try {
      const git = simpleGit(tmpDir);
      await git.init();
      await git.addConfig("user.email", "test@test.com");
      await git.addConfig("user.name", "Test");

      // Create initial commit so we have a HEAD
      await fs.writeFile(path.join(tmpDir, "README.md"), "init");
      await git.add("README.md");
      await git.commit("initial");

      // Create multiple new files
      await fs.mkdir(path.join(tmpDir, ".vscode"), { recursive: true });
      await fs.writeFile(path.join(tmpDir, ".vscode", "settings.json"), "{}");
      await fs.writeFile(path.join(tmpDir, ".vscode", "mcp.json"), "{}");
      await fs.writeFile(path.join(tmpDir, "secret.env"), "TOKEN=abc123");
      await fs.writeFile(path.join(tmpDir, "other.txt"), "should not be committed");

      // Commit only the .vscode files
      await commitFiles(tmpDir, [".vscode/settings.json", ".vscode/mcp.json"], "add vscode configs");

      // Verify committed files
      const log = await git.log({ maxCount: 1 });
      assert.equal(log.latest?.message, "add vscode configs");

      // Check that committed files are in the tree
      const diff = await git.diff(["--name-only", "HEAD~1", "HEAD"]);
      const committedFiles = diff.trim().split("\n").sort();
      assert.deepEqual(committedFiles, [".vscode/mcp.json", ".vscode/settings.json"]);

      // Check that secret.env and other.txt are still untracked
      const status = await git.status();
      const untrackedNames = status.not_added.sort();
      assert.ok(untrackedNames.includes("other.txt"), "other.txt should remain untracked");
      assert.ok(untrackedNames.includes("secret.env"), "secret.env should remain untracked");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("does not create a commit when specified files have not changed", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "primer-test-m5b-"));

    try {
      const git = simpleGit(tmpDir);
      await git.init();
      await git.addConfig("user.email", "test@test.com");
      await git.addConfig("user.name", "Test");

      // Create initial commit with a file
      await fs.writeFile(path.join(tmpDir, "README.md"), "init");
      await git.add("README.md");
      await git.commit("initial");

      const logBefore = await git.log();
      const countBefore = logBefore.total;

      // Try to commit the same file again (no changes)
      await commitFiles(tmpDir, ["README.md"], "should not commit");

      const logAfter = await git.log();
      assert.equal(logAfter.total, countBefore, "No new commit should be created");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
