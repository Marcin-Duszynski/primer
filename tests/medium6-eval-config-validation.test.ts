import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs/promises";
import path from "path";
import os from "os";

// loadConfig is private — we test it via runEval which calls it first.
// runEval will throw validation errors before reaching the copilot SDK.
import { runEval } from "../src/services/evaluator";

async function writeConfig(dir: string, content: string): Promise<string> {
  const configPath = path.join(dir, "eval-config.json");
  await fs.writeFile(configPath, content, "utf8");
  return configPath;
}

async function expectRunEvalThrows(configContent: string, expectedMessage: RegExp) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "primer-test-m6-"));
  try {
    const configPath = await writeConfig(tmpDir, configContent);
    await assert.rejects(
      () =>
        runEval({
          configPath,
          repoPath: tmpDir,
          model: "gpt-4.1",
          judgeModel: "gpt-4.1",
        }),
      (err: Error) => {
        assert.match(err.message, expectedMessage);
        return true;
      }
    );
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

describe("MEDIUM-6: eval config schema validation", () => {
  it("rejects invalid JSON", async () => {
    await expectRunEvalThrows(
      "not json at all {{{",
      /not valid JSON/
    );
  });

  it("rejects non-object top-level (array)", async () => {
    await expectRunEvalThrows(
      '[{"prompt": "hi", "expectation": "hello"}]',
      /must be a JSON object/
    );
  });

  it("rejects non-object top-level (string)", async () => {
    await expectRunEvalThrows(
      '"just a string"',
      /must be a JSON object/
    );
  });

  it("rejects missing cases array", async () => {
    await expectRunEvalThrows(
      '{"systemMessage": "hi"}',
      /non-empty 'cases' array/
    );
  });

  it("rejects empty cases array", async () => {
    await expectRunEvalThrows(
      '{"cases": []}',
      /non-empty 'cases' array/
    );
  });

  it("rejects case without prompt", async () => {
    await expectRunEvalThrows(
      '{"cases": [{"expectation": "should work"}]}',
      /cases\[0\]\.prompt must be a non-empty string/
    );
  });

  it("rejects case with empty prompt", async () => {
    await expectRunEvalThrows(
      '{"cases": [{"prompt": "  ", "expectation": "should work"}]}',
      /cases\[0\]\.prompt must be a non-empty string/
    );
  });

  it("rejects case without expectation", async () => {
    await expectRunEvalThrows(
      '{"cases": [{"prompt": "hello"}]}',
      /cases\[0\]\.expectation must be a non-empty string/
    );
  });

  it("rejects case with empty expectation", async () => {
    await expectRunEvalThrows(
      '{"cases": [{"prompt": "hello", "expectation": ""}]}',
      /cases\[0\]\.expectation must be a non-empty string/
    );
  });

  it("rejects case with non-string id", async () => {
    await expectRunEvalThrows(
      '{"cases": [{"prompt": "hello", "expectation": "world", "id": 42}]}',
      /cases\[0\]\.id must be a string/
    );
  });

  it("rejects non-string instructionFile", async () => {
    await expectRunEvalThrows(
      '{"cases": [{"prompt": "a", "expectation": "b"}], "instructionFile": 123}',
      /instructionFile.*must be a string/
    );
  });

  it("rejects non-string systemMessage", async () => {
    await expectRunEvalThrows(
      '{"cases": [{"prompt": "a", "expectation": "b"}], "systemMessage": true}',
      /systemMessage.*must be a string/
    );
  });

  it("validates errors at correct case index", async () => {
    await expectRunEvalThrows(
      '{"cases": [{"prompt": "ok", "expectation": "ok"}, {"prompt": "", "expectation": "bad"}]}',
      /cases\[1\]\.prompt must be a non-empty string/
    );
  });
});
