import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isValidGitHubName, parseRepoIdentifier } from "../src/utils/validation";

describe("MEDIUM-4: isValidGitHubName", () => {
  it("accepts valid simple names", () => {
    assert.equal(isValidGitHubName("octocat"), true);
    assert.equal(isValidGitHubName("my-repo"), true);
    assert.equal(isValidGitHubName("my_repo"), true);
    assert.equal(isValidGitHubName("my.repo"), true);
    assert.equal(isValidGitHubName("A"), true);
    assert.equal(isValidGitHubName("a1"), true);
    assert.equal(isValidGitHubName("1a"), true);
  });

  it("rejects empty string", () => {
    assert.equal(isValidGitHubName(""), false);
  });

  it("rejects names exceeding 100 characters", () => {
    assert.equal(isValidGitHubName("a".repeat(100)), true);
    assert.equal(isValidGitHubName("a".repeat(101)), false);
  });

  it("rejects directory traversal (..)", () => {
    assert.equal(isValidGitHubName(".."), false);
    assert.equal(isValidGitHubName("foo..bar"), false);
    assert.equal(isValidGitHubName("a..b"), false);
  });

  it("rejects names starting or ending with special chars", () => {
    assert.equal(isValidGitHubName("-repo"), false);
    assert.equal(isValidGitHubName("repo-"), false);
    assert.equal(isValidGitHubName(".repo"), false);
    assert.equal(isValidGitHubName("repo."), false);
    assert.equal(isValidGitHubName("_repo"), false);
    assert.equal(isValidGitHubName("repo_"), false);
  });

  it("rejects names with slashes or spaces", () => {
    assert.equal(isValidGitHubName("foo/bar"), false);
    assert.equal(isValidGitHubName("foo bar"), false);
    assert.equal(isValidGitHubName("foo\tbar"), false);
  });

  it("rejects injection attempts", () => {
    assert.equal(isValidGitHubName("../../../etc/passwd"), false);
    assert.equal(isValidGitHubName("foo;rm -rf /"), false);
    assert.equal(isValidGitHubName("$(whoami)"), false);
    assert.equal(isValidGitHubName("`id`"), false);
  });
});

describe("MEDIUM-4: parseRepoIdentifier", () => {
  it("parses valid owner/name", () => {
    const result = parseRepoIdentifier("octocat/hello-world");
    assert.deepEqual(result, { owner: "octocat", name: "hello-world" });
  });

  it("returns null for missing slash", () => {
    assert.equal(parseRepoIdentifier("octocat"), null);
  });

  it("returns null for too many slashes", () => {
    assert.equal(parseRepoIdentifier("a/b/c"), null);
  });

  it("returns null for invalid owner", () => {
    assert.equal(parseRepoIdentifier("../evil/repo"), null);
    assert.equal(parseRepoIdentifier("-bad/repo"), null);
  });

  it("returns null for invalid name", () => {
    assert.equal(parseRepoIdentifier("owner/.."), null);
    assert.equal(parseRepoIdentifier("owner/-bad"), null);
  });

  it("returns null for empty parts", () => {
    assert.equal(parseRepoIdentifier("/repo"), null);
    assert.equal(parseRepoIdentifier("owner/"), null);
    assert.equal(parseRepoIdentifier("/"), null);
  });
});
