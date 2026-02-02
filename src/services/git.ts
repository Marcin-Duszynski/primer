import fs from "fs/promises";
import path from "path";
import simpleGit, { SimpleGitProgressEvent } from "simple-git";

export async function isGitRepo(repoPath: string): Promise<boolean> {
  try {
    await fs.access(path.join(repoPath, ".git"));
    return true;
  } catch {
    return false;
  }
}

export async function getRepoRoot(repoPath: string): Promise<string> {
  const git = simpleGit(repoPath);
  const root = await git.revparse(["--show-toplevel"]);
  return root.trim();
}

export type CloneOptions = {
  shallow?: boolean;
  timeoutMs?: number;
  onProgress?: (stage: string, progress: number) => void;
  cleanRemoteUrl?: string;
};

export async function cloneRepo(
  repoUrl: string, 
  destination: string,
  options: CloneOptions = {}
): Promise<void> {
  const { shallow = true, timeoutMs = 60000, onProgress, cleanRemoteUrl } = options;
  
  const git = simpleGit({
    progress: onProgress ? ({ stage, progress }: SimpleGitProgressEvent) => {
      onProgress(stage, progress);
    } : undefined,
    timeout: {
      block: timeoutMs
    }
  });

  const cloneArgs: string[] = [];
  if (shallow) {
    cloneArgs.push("--depth", "1");
  }

  await git.clone(repoUrl, destination, cloneArgs);

  // Strip embedded credentials from the persisted remote URL
  if (cleanRemoteUrl) {
    await simpleGit(destination).remote(["set-url", "origin", cleanRemoteUrl]);
  }
}

export async function checkoutBranch(repoPath: string, branch: string): Promise<void> {
  const git = simpleGit(repoPath);
  const branches = await git.branchLocal();
  if (!branches.all.includes(branch)) {
    await git.checkoutLocalBranch(branch);
    return;
  }
  await git.checkout(branch);
}

/** @deprecated Use commitFiles() to stage only specific files */
export async function commitAll(repoPath: string, message: string): Promise<void> {
  const git = simpleGit(repoPath);
  await git.add(["-A"]);
  const status = await git.status();
  if (status.files.length === 0) return;
  await git.commit(message);
}

export async function commitFiles(repoPath: string, files: string[], message: string): Promise<void> {
  const git = simpleGit(repoPath);
  await git.add(files);
  const status = await git.status();
  if (status.files.length === 0) return;
  await git.commit(message);
}

/** Normalize a git URL by removing trailing slashes and any existing auth */
function normalizeGitUrl(url: string): string {
  let normalized = url.trim();
  // Remove trailing slashes
  while (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  // Remove any existing x-access-token auth
  normalized = normalized.replace(/https:\/\/x-access-token:[^@]+@/, "https://");
  return normalized;
}

export async function pushBranch(repoPath: string, branch: string, token?: string): Promise<void> {
  const git = simpleGit(repoPath);
  
  if (token) {
    // Set up credentials for this push
    const remoteUrl = (await git.remote(["get-url", "origin"])) ?? "";
    const normalizedUrl = normalizeGitUrl(remoteUrl);
    if (normalizedUrl.startsWith("https://")) {
      const authedUrl = normalizedUrl.replace("https://", `https://x-access-token:${token}@`);
      await git.remote(["set-url", "origin", authedUrl]);
      try {
        await git.push(["-u", "origin", branch]);
      } finally {
        // Restore original URL to avoid leaking token
        await git.remote(["set-url", "origin", normalizedUrl]);
      }
      return;
    }
  }
  
  await git.push(["-u", "origin", branch]);
}
