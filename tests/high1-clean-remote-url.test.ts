import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs/promises";
import path from "path";
import os from "os";
import simpleGit from "simple-git";
import { cloneRepo } from "../src/services/git";

describe("HIGH-1: cleanRemoteUrl strips token from cloned repo", () => {
  it("remote URL contains no token after clone with cleanRemoteUrl", async () => {
    // Create a bare "source" repo to clone from
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "primer-test-h1-"));
    const sourceRepo = path.join(tmpDir, "source.git");
    const cloneDest = path.join(tmpDir, "cloned");

    try {
      // Init a bare repo as the "remote"
      await simpleGit().init(true, [sourceRepo]);

      // Simulate an authed URL (the token is fake)
      const authedUrl = `file://${sourceRepo}`;
      const cleanUrl = "https://github.com/owner/repo";

      await cloneRepo(authedUrl, cloneDest, {
        shallow: false,
        cleanRemoteUrl: cleanUrl,
      });

      // Read the remote URL from the cloned repo
      const git = simpleGit(cloneDest);
      const remoteUrl = (await git.remote(["get-url", "origin"]))?.trim();

      assert.equal(
        remoteUrl,
        cleanUrl,
        "Remote URL should be the clean URL, not the authed URL"
      );
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("remote URL is unchanged when cleanRemoteUrl is not provided", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "primer-test-h1b-"));
    const sourceRepo = path.join(tmpDir, "source.git");
    const cloneDest = path.join(tmpDir, "cloned");

    try {
      await simpleGit().init(true, [sourceRepo]);

      const originalUrl = `file://${sourceRepo}`;

      await cloneRepo(originalUrl, cloneDest, { shallow: false });

      const git = simpleGit(cloneDest);
      const remoteUrl = (await git.remote(["get-url", "origin"]))?.trim();

      assert.equal(
        remoteUrl,
        originalUrl,
        "Remote URL should remain the original clone URL"
      );
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
