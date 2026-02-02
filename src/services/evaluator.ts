import fs from "fs/promises";
import path from "path";
import { assertCopilotCliReady } from "../utils/copilot";

type EvalCase = {
  prompt: string;
  expectation: string;
  id?: string;
};

type EvalConfig = {
  instructionFile?: string;
  cases: EvalCase[];
  systemMessage?: string;
};

type EvalRunOptions = {
  configPath: string;
  repoPath: string;
  model: string;
  judgeModel: string;
  outputPath?: string;
  onProgress?: (message: string) => void;
};

export type EvalResult = {
  id: string;
  prompt: string;
  expectation: string;
  withInstructions?: string;
  withoutInstructions?: string;
  verdict?: "pass" | "fail" | "unknown";
  score?: number;
  rationale?: string;
};

export async function runEval(options: EvalRunOptions): Promise<{ summary: string; results: EvalResult[] }> {
  const config = await loadConfig(options.configPath);
  const instructionFile = config.instructionFile ?? ".github/copilot-instructions.md";
  const instructionPath = path.resolve(options.repoPath, instructionFile);
  const instructionText = await readOptionalFile(instructionPath);
  const progress = options.onProgress ?? (() => {});

  progress("Starting Copilot SDK...");
  const cliPath = await assertCopilotCliReady();
  const sdk = await import("@github/copilot-sdk");
  const client = new sdk.CopilotClient({ cliPath });

  try {
    const results: EvalResult[] = [];
    const total = config.cases.length;

    for (const [index, testCase] of config.cases.entries()) {
      const id = testCase.id ?? `case-${index + 1}`;
      const prompt = buildPrompt(options.repoPath, testCase.prompt);

      progress(`Running eval ${index + 1}/${total}: ${id} (without instructions)...`);
      const withoutInstructions = await askOnce(client, {
        prompt,
        model: options.model,
        systemMessage: config.systemMessage
      });

      progress(`Running eval ${index + 1}/${total}: ${id} (with instructions)...`);
      const withInstructions = await askOnce(client, {
        prompt,
        model: options.model,
        systemMessage: [config.systemMessage, instructionText].filter(Boolean).join("\n\n")
      });

      progress(`Running eval ${index + 1}/${total}: ${id} (judging)...`);
      const judgment = await judge(client, {
        model: options.judgeModel,
        prompt: testCase.prompt,
        expectation: testCase.expectation,
        withoutInstructions,
        withInstructions
      });

      results.push({
        id,
        prompt: testCase.prompt,
        expectation: testCase.expectation,
        withInstructions,
        withoutInstructions,
        verdict: judgment.verdict,
        score: judgment.score,
        rationale: judgment.rationale
      });

      progress(`Eval ${index + 1}/${total}: ${id} → ${judgment.verdict} (score: ${judgment.score})`);
    }

    if (options.outputPath) {
      const output = {
        repoPath: options.repoPath,
        model: options.model,
        judgeModel: options.judgeModel,
        results
      };
      await fs.writeFile(options.outputPath, JSON.stringify(output, null, 2), "utf8");
    }

    const summary = formatSummary(results);
    return { summary, results };
  } finally {
    await client.stop();
  }
}

type AskOptions = {
  prompt: string;
  model: string;
  systemMessage?: string;
};

async function askOnce(
  client: { createSession: (config?: Record<string, unknown>) => Promise<any> },
  options: AskOptions
): Promise<string> {
  const session = await client.createSession({
    model: options.model,
    streaming: true,
    infiniteSessions: { enabled: false },
    systemMessage: options.systemMessage
      ? { content: options.systemMessage }
      : undefined
  });

  let content = "";
  session.on((event: { type: string; data?: Record<string, unknown> }) => {
    if (event.type === "assistant.message_delta") {
      const delta = event.data?.deltaContent as string | undefined;
      if (delta) content += delta;
    }
  });

  await session.sendAndWait({ prompt: options.prompt }, 120000);
  await session.destroy();
  return content.trim();
}

type JudgeOptions = {
  model: string;
  prompt: string;
  expectation: string;
  withoutInstructions: string;
  withInstructions: string;
};

type JudgeResult = {
  verdict: "pass" | "fail" | "unknown";
  score: number;
  rationale: string;
};

async function judge(
  client: { createSession: (config?: Record<string, unknown>) => Promise<any> },
  options: JudgeOptions
): Promise<JudgeResult> {
  const session = await client.createSession({
    model: options.model,
    streaming: true,
    infiniteSessions: { enabled: false },
    systemMessage: {
      content: "You are a strict evaluator. Return JSON with keys: verdict (pass|fail|unknown), score (0-100), rationale. Do not include any other text."
    }
  });

  let content = "";
  session.on((event: { type: string; data?: Record<string, unknown> }) => {
    if (event.type === "assistant.message_delta") {
      const delta = event.data?.deltaContent as string | undefined;
      if (delta) content += delta;
    }
  });

  const prompt = [
    "Evaluate which response best matches the expectation.",
    "",
    `Expectation: ${options.expectation}`,
    "",
    "Response A (without custom instructions):",
    options.withoutInstructions,
    "",
    "Response B (with custom instructions):",
    options.withInstructions,
    "",
    "Return JSON only."
  ].join("\n");

  await session.sendAndWait({ prompt }, 120000);
  await session.destroy();

  return parseJudge(content);
}

function parseJudge(content: string): JudgeResult {
  try {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON detected");
    const parsed = JSON.parse(match[0]) as JudgeResult;
    if (!parsed.verdict) throw new Error("Missing verdict");
    return {
      verdict: parsed.verdict,
      score: Number(parsed.score ?? 0),
      rationale: String(parsed.rationale ?? "")
    };
  } catch {
    return {
      verdict: "unknown",
      score: 0,
      rationale: content.trim()
    };
  }
}

async function loadConfig(configPath: string): Promise<EvalConfig> {
  const raw = await fs.readFile(configPath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Eval config is not valid JSON: ${configPath}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Eval config must be a JSON object.");
  }

  const obj = parsed as Record<string, unknown>;

  if (!Array.isArray(obj.cases) || obj.cases.length === 0) {
    throw new Error("Eval config must contain a non-empty 'cases' array.");
  }

  for (let i = 0; i < obj.cases.length; i++) {
    const c = obj.cases[i] as Record<string, unknown>;
    if (typeof c !== "object" || c === null || Array.isArray(c)) {
      throw new Error(`Eval config cases[${i}] must be an object.`);
    }
    if (typeof c.prompt !== "string" || c.prompt.trim() === "") {
      throw new Error(`Eval config cases[${i}].prompt must be a non-empty string.`);
    }
    if (typeof c.expectation !== "string" || c.expectation.trim() === "") {
      throw new Error(`Eval config cases[${i}].expectation must be a non-empty string.`);
    }
    if (c.id !== undefined && typeof c.id !== "string") {
      throw new Error(`Eval config cases[${i}].id must be a string if provided.`);
    }
  }

  if (obj.instructionFile !== undefined && typeof obj.instructionFile !== "string") {
    throw new Error("Eval config 'instructionFile' must be a string if provided.");
  }
  if (obj.systemMessage !== undefined && typeof obj.systemMessage !== "string") {
    throw new Error("Eval config 'systemMessage' must be a string if provided.");
  }

  return parsed as EvalConfig;
}

async function readOptionalFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

function buildPrompt(repoPath: string, userPrompt: string): string {
  return [
    "You are working in this repository:",
    repoPath,
    "Use the file system tools when needed to inspect the codebase.",
    "",
    userPrompt
  ].join("\n");
}

function formatSummary(results: EvalResult[]): string {
  const total = results.length;
  const passed = results.filter((r) => r.verdict === "pass").length;
  const failed = results.filter((r) => r.verdict === "fail").length;
  const unknown = results.filter((r) => r.verdict === "unknown").length;

  const lines = [
    `Eval results: ${passed}/${total} pass, ${failed} fail, ${unknown} unknown.`
  ];

  for (const result of results) {
    lines.push(
      `- ${result.id}: ${result.verdict ?? "unknown"} (score: ${result.score ?? 0})`
    );
  }

  return `\n${lines.join("\n")}`;
}
