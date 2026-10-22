// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { history, committedChanges, committedPatch, committedContents } from "../../src/host/git-history";
import { hostContract } from "../../src/shared/contracts";

const roots: string[] = [];
function repo() {
  const path = mkdtempSync(join(tmpdir(), "bb-diff-tree-git-")); roots.push(path);
  execFileSync("git", ["init", "-b", "main", path]);
  git(path, "config", "user.name", "Diff Tree Test"); git(path, "config", "user.email", "diff-tree@example.invalid");
  return path;
}
function git(path: string, ...args: string[]) { return execFileSync("git", ["-C", path, ...args], { encoding: "utf8" }).trim(); }
function commit(path: string, name: string, content: string, subject: string) {
  writeFileSync(join(path, name), content); git(path, "add", "--", name); git(path, "commit", "-m", subject); return git(path, "rev-parse", "HEAD");
}
afterEach(() => { roots.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })); });

it("returns an empty history before the first commit", async () => {
  const path = repo();
  expect(await history(path)).toEqual({ commits: [], hasMore: false });
  await expect(committedChanges(path, { kind: "recent", count: 1 })).rejects.toThrow("No commits yet");
});
it("returns named commits and a combined last-two diff excluding working-copy changes", async () => {
  const path = repo();
  commit(path, "base.txt", "base\n", "Base");
  commit(path, "file.txt", "first\n", "First change");
  const head = commit(path, "file.txt", "second\n", "Second change");
  writeFileSync(join(path, "file.txt"), "dirty\n");
  writeFileSync(join(path, "untracked.txt"), "untracked\n");
  const log = await history(path);
  expect(log.commits.map(item => item.subject)).toEqual(["Second change", "First change", "Base"]);
  const result = await committedChanges(path, { kind: "recent", count: 2 });
  expect(result.files.map(file => file.path)).toEqual(["file.txt"]);
  expect(result.to).toBe(head);
  const patch = await committedPatch(path, { ...result, path: "file.txt", previousPath: null });
  expect(patch.patch).toContain("+second"); expect(patch.patch).not.toContain("dirty");
  expect(await committedContents(path, { ...result, path: "file.txt", previousPath: null })).toEqual({ old: "", next: "second\n" });
  const selected = await committedChanges(path, { kind: "commit", sha: log.commits[1].sha });
  const first = await committedPatch(path, { ...selected, path: "file.txt", previousPath: null });
  expect(first.patch).toContain("+first"); expect(first.patch).not.toContain("+second");
  expect(await committedContents(path, { ...selected, path: "file.txt", previousPath: null })).toEqual({ old: "", next: "first\n" });
});
it("handles the root commit and requests longer than the available history", async () => {
  const path = repo(); const sha = commit(path, "root.txt", "root\n", "Root");
  const root = await committedChanges(path, { kind: "commit", sha });
  expect(root.files[0]).toMatchObject({ path: "root.txt", changeKind: "added", additions: 1 });
  const all = await committedChanges(path, { kind: "recent", count: 100 });
  expect(all.files).toEqual(root.files); expect(all.label).toContain("Last commit");
  expect(await committedContents(path, { ...root, path: "root.txt", previousPath: null })).toEqual({ old: "", next: "root\n" });
});
it("preserves rename, deletion and binary metadata and literal special-character paths", async () => {
  const path = repo();
  commit(path, "old.txt", "old\n", "Root"); commit(path, "delete.txt", "delete\n", "Before rename");
  renameSync(join(path, "old.txt"), join(path, "new.txt")); rmSync(join(path, "delete.txt"));
  mkdirSync(join(path, "folder")); writeFileSync(join(path, "folder", "[a]* file.txt"), "special\n");
  writeFileSync(join(path, "image.bin"), Buffer.from([0, 1, 2, 3]));
  git(path, "add", "-A"); git(path, "commit", "-m", "Rename and delete");
  const result = await committedChanges(path, { kind: "recent", count: 1 });
  expect(result.files.find(f => f.path === "new.txt")).toMatchObject({ changeKind: "renamed", previousPath: "old.txt" });
  expect(result.files.find(f => f.path === "delete.txt")).toMatchObject({ changeKind: "deleted", deletions: 1 });
  expect(result.files.find(f => f.path === "image.bin")).toMatchObject({ binary: true });
  expect((await committedPatch(path, { ...result, path: "folder/[a]* file.txt", previousPath: null })).patch).toContain("+special");
  expect(await committedContents(path, { ...result, path: "folder/[a]* file.txt", previousPath: null })).toEqual({ old: "", next: "special\n" });
  expect(await committedContents(path, { ...result, path: "new.txt", previousPath: "old.txt" })).toEqual({ old: "old\n", next: "old\n" });
  expect(await committedContents(path, { ...result, path: "delete.txt", previousPath: null })).toEqual({ old: "delete\n", next: "" });
  await expect(committedContents(path, { ...result, path: "image.bin", previousPath: null })).rejects.toThrow("binary");
});
it("uses first-parent history for merge commits", async () => {
  const path = repo(); commit(path, "base.txt", "base\n", "Base");
  git(path, "checkout", "-b", "feature"); commit(path, "feature.txt", "feature\n", "Feature");
  git(path, "checkout", "main"); commit(path, "main.txt", "main\n", "Main");
  git(path, "merge", "--no-ff", "feature", "-m", "Merge");
  const log = await history(path); expect(log.commits.map(c => c.subject)).toEqual(["Merge", "Main", "Base"]);
  const result = await committedChanges(path, { kind: "recent", count: 1 });
  expect(result.files.map(f => f.path)).toEqual(["feature.txt"]);
});
it("rejects invalid revisions, counts and escaping paths at the host contract", () => {
  expect(hostContract.changes.input.safeParse({ workspace: "/x", selection: { kind: "recent", count: 0 } }).success).toBe(false);
  expect(hostContract.changes.input.safeParse({ workspace: "/x", selection: { kind: "commit", sha: "--help" } }).success).toBe(false);
  expect(hostContract.patch.input.safeParse({ workspace: "/x", from: "a".repeat(40), to: "b".repeat(40), path: "../outside", previousPath: null }).success).toBe(false);
});
it("isolates a renamed file when its old path is reused", async () => {
  const path = repo(); commit(path, "old.txt", "original\n", "Root");
  renameSync(join(path, "old.txt"), join(path, "new.txt")); writeFileSync(join(path, "old.txt"), "replacement\n");
  git(path, "add", "-A"); git(path, "commit", "-m", "Rename and reuse");
  const result = await committedChanges(path, { kind: "recent", count: 1 });
  const patch = await committedPatch(path, { ...result, path: "new.txt", previousPath: "old.txt" });
  expect(patch.patch.match(/^diff --git /gm)).toHaveLength(1);
  expect(patch.patch).not.toContain("+replacement");
});
