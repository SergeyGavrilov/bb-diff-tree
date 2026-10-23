import { expect, it } from "vitest";
import { buildTree } from "../../src/core/tree";
import { validWorkspacePath, worktreeEntries } from "../../src/core/worktree";
import type { ChangedFile } from "../../src/core/tree";

it("merges existing worktree files with change metadata without marking unchanged paths as modified", () => {
  const changed: ChangedFile = { path: "src/change.ts", previousPath: "old.ts", additions: 3, deletions: 1, changeKind: "renamed", binary: false, loadMode: "auto", origin: "tracked" };
  const result = worktreeEntries([
    { path: "src/change.ts", kind: "file" }, { path: "src/plain.py", kind: "file" },
    { path: "src/plain.py", kind: "file" }, { path: "empty", kind: "directory" },
    { path: "../escape", kind: "file" }, { path: ".git/config", kind: "file" },
  ], [changed, { ...changed, path: "deleted.ts", changeKind: "deleted" }]);
  expect(result.files).toHaveLength(2);
  expect(result.files.find(file => file.path === "src/plain.py")).toEqual({ path: "src/plain.py" });
  expect(result.files[0].change).toBe(changed);
  const tree = buildTree(result.files, result.directories);
  expect(tree).toMatchObject({ count: 2, additions: 3, deletions: 1 });
  expect(tree.directories.find(directory => directory.path === "empty")).toMatchObject({ count: 0, files: [], directories: [] });
});

it("accepts workspace paths and rejects traversal or absolute file targets", () => {
  for (const path of ["src/a.ts", ".gitignore", "новая папка/a b.py", "__proto__/constructor.ts"]) expect(validWorkspacePath(path)).toBe(true);
  for (const path of ["", "/etc/passwd", "C:\\secrets.txt", "../file", "src/../../file", "src\\..\\file", ".git/config", "a\0b", "src//file"]) expect(validWorkspacePath(path), path).toBe(false);
});
