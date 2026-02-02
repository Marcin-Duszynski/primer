import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "fs/promises";
import fg from "fast-glob";

const execFileAsync = promisify(execFile);

export async function findCopilotCliPath(): Promise<string> {
  // Try standard PATH first
  try {
    const { stdout } = await execFileAsync("which", ["copilot"], { timeout: 5000 });
    return stdout.trim();
  } catch {
    // Ignore - will try VS Code location
  }

  // VS Code Copilot Chat extension location
  const home = process.env.HOME ?? "";
  const staticLocations = [
    `${home}/Library/Application Support/Code - Insiders/User/globalStorage/github.copilot-chat/copilotCli/copilot`,
    `${home}/Library/Application Support/Code/User/globalStorage/github.copilot-chat/copilotCli/copilot`,
  ];

  for (const location of staticLocations) {
    try {
      await fs.access(location);
      return location;
    } catch {
      // Try next location
    }
  }

  // Glob-based locations for versioned extension directories
  const globPatterns = [
    `${home}/.vscode-insiders/extensions/github.copilot-chat-*/copilotCli/copilot`,
    `${home}/.vscode/extensions/github.copilot-chat-*/copilotCli/copilot`,
  ];

  for (const pattern of globPatterns) {
    const matches = await fg(pattern);
    if (matches.length > 0) {
      // Sort descending so the latest version wins
      matches.sort().reverse();
      return matches[0];
    }
  }

  throw new Error("Copilot CLI not found. Install GitHub Copilot Chat extension in VS Code.");
}

export async function assertCopilotCliReady(): Promise<string> {
  const cliPath = await findCopilotCliPath();

  try {
    await execFileAsync(cliPath, ["--version"], { timeout: 5000 });
  } catch {
    throw new Error(`Copilot CLI at ${cliPath} is not working.`);
  }

  // Note: Copilot CLI uses its own auth system, not gh CLI.
  // User must run: copilot, then /login inside the CLI.
  return cliPath;
}
