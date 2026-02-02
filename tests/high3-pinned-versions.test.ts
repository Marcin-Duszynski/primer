import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs/promises";
import path from "path";
import os from "os";

// renderMcp is private, so we test via generateConfigs which calls it
import { generateConfigs } from "../src/services/generator";

describe("HIGH-3: npx packages are version-pinned", () => {
  it("renderMcp produces pinned @modelcontextprotocol/server-github version", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "primer-test-h3-"));
    try {
      await generateConfigs({
        repoPath: tmpDir,
        analysis: { languages: [], frameworks: [], buildTools: [], testCommands: [] },
        selections: ["mcp"],
        force: true,
      });

      const mcpJson = JSON.parse(
        await fs.readFile(path.join(tmpDir, ".vscode", "mcp.json"), "utf8")
      );

      const githubArgs: string[] = mcpJson.servers.github.args;
      const githubPkg = githubArgs.find((a: string) =>
        a.startsWith("@modelcontextprotocol/server-github")
      );
      assert.ok(githubPkg, "server-github arg not found");
      assert.match(
        githubPkg!,
        /@modelcontextprotocol\/server-github@\d+/,
        "server-github must be pinned to a specific version"
      );
      assert.equal(githubPkg, "@modelcontextprotocol/server-github@2025.4.8");

      const fsArgs: string[] = mcpJson.servers.filesystem.args;
      const fsPkg = fsArgs.find((a: string) =>
        a.startsWith("@modelcontextprotocol/server-filesystem")
      );
      assert.ok(fsPkg, "server-filesystem arg not found");
      assert.match(
        fsPkg!,
        /@modelcontextprotocol\/server-filesystem@\d+/,
        "server-filesystem must be pinned to a specific version"
      );
      assert.equal(fsPkg, "@modelcontextprotocol/server-filesystem@2026.1.14");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("does NOT contain un-pinned package references", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src/services/generator.ts"),
      "utf8"
    );
    // Ensure no bare (un-versioned) package names remain in the npx args
    assert.ok(
      !source.includes('"@modelcontextprotocol/server-github"'),
      "Found un-pinned server-github in generator.ts"
    );
    assert.ok(
      !source.includes('"@modelcontextprotocol/server-filesystem"'),
      "Found un-pinned server-filesystem in generator.ts"
    );
  });
});
