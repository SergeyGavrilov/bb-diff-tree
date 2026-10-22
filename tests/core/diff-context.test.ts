import { expect, it } from "vitest";
import { contextualDiff } from "../../src/core/diff-context";
import { selectedDiffQuote } from "../../src/core/diff-selection";

export const old = Array.from({ length: 180 }, (_, i) => `line ${i + 1}\n`).join("");
export const next = old.replace("line 40\n", "changed 40\n").replace("line 140\n", "changed 140\n");
export const patch = "diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -39,3 +39,3 @@\n line 39\n-line 40\n+changed 40\n line 41\n@@ -139,3 +139,3 @@\n line 139\n-line 140\n+changed 140\n line 141\n";
it("hydrates the original hunks with all leading, middle and trailing context", () => {
  const result = contextualDiff(patch, { old, next });
  expect(result.error).toBeUndefined();
  expect(result.file!.isPartial).toBe(false);
  expect(result.file!.additionLines).toHaveLength(180);
  expect(result.file!.hunks.map(hunk => hunk.collapsedBefore)).toEqual([38, 97]);
  for (const line of [1, 80, 180]) {
    expect(selectedDiffQuote(result.file!, { start: line, end: line, side: "additions" }, "unified", "a.ts", "a.ts", "r")).toContain(` line ${line}`);
  }
});
it.each([next.replace("changed 40", "stale 40"), next.replace("line 1\n", "stale 1\n"), next.replace("line 180", "stale 180")])("keeps the original patch when a version changed inside or outside its hunks", content => {
  const result = contextualDiff(patch, { old, next: content });
  expect(result.file!.isPartial).toBe(true);
  expect(result.error).toContain("Refresh");
});
it("hydrates added and deleted files without an existing opposite version", () => {
  const added = "diff --git a/a b/a\nnew file mode 100644\n--- /dev/null\n+++ b/a\n@@ -0,0 +1 @@\n+new\n";
  expect(contextualDiff(added, { old: "", next: "new\n" }).file!.isPartial).toBe(false);
  const deleted = "diff --git a/a b/a\ndeleted file mode 100644\n--- a/a\n+++ /dev/null\n@@ -1 +0,0 @@\n-old\n";
  expect(contextualDiff(deleted, { old: "old\n", next: "" }).file!.isPartial).toBe(false);
});
