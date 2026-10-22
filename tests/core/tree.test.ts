import { expect, it } from "vitest";
import { buildTree, filterFiles } from "../../src/core/tree";
import type { ChangedFile } from "../../src/core/tree";
const file = (path: string, additions = 1, deletions = 0, previousPath: string | null = null): ChangedFile => ({ path, previousPath, additions, deletions, changeKind: "modified", binary: false, loadMode: "auto", origin: "tracked" });
it("builds sorted directory groups with aggregate counts and line statistics", () => {
  const tree = buildTree([file("z.ts"), file("src/b.ts", 3, 2), file("src/deep/a.ts", 5, 4), file("a.ts")]);
  expect(tree.count).toBe(4);
  expect(tree.additions).toBe(10);
  expect(tree.deletions).toBe(6);
  expect(tree.files.map(f => f.path)).toEqual(["a.ts", "z.ts"]);
  expect(tree.directories[0]).toMatchObject({ path: "src", count: 2, additions: 8, deletions: 6 });
});
it("searches both current and previous names without losing unusual path characters", () => {
  const files = [file("новая папка/a b.ts", 1, 0, "old.ts"), file("__proto__/constructor.ts")];
  expect(filterFiles(files, " OLD.TS ")).toEqual([files[0]]);
  expect(buildTree(files).directories.map(d => d.name)).toContain("__proto__");
});
