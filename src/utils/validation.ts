const GITHUB_NAME_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;
const MAX_NAME_LENGTH = 100;

export function isValidGitHubName(name: string): boolean {
  if (!name || name.length > MAX_NAME_LENGTH) return false;
  if (name.includes("..")) return false;
  return GITHUB_NAME_PATTERN.test(name);
}

export function parseRepoIdentifier(input: string): { owner: string; name: string } | null {
  const parts = input.split("/");
  if (parts.length !== 2) return null;

  const [owner, name] = parts;
  if (!isValidGitHubName(owner) || !isValidGitHubName(name)) return null;

  return { owner, name };
}
