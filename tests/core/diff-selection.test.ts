import { expect, it } from "vitest";
import { parsePatchFiles } from "@pierre/diffs";
import { selectedDiffQuote } from "../../src/core/diff-selection";
const patch = "diff --git a/old.ts b/new.ts\n--- a/old.ts\n+++ b/new.ts\n@@ -2,3 +2,4 @@\n context\n-old\n+new\n+extra\n end\n@@ -20 +21 @@\n-later\n+next\n";
const file = parsePatchFiles(patch)[0].files[0];
it("quotes a single clicked line with its actual number, path and revision", () => {
  const quote = selectedDiffQuote(file, { start: 3, end: 3, side: "additions" }, "unified", "new.ts", "old.ts", "Commit abc");
  expect(quote).toContain("+new"); expect(quote).not.toContain("+extra");
  expect(quote).toContain("new line 3"); expect(quote).toContain("Commit abc");
});
it("quotes a unified mixed-side selection in visual order", () => {
  const quote = selectedDiffQuote(file, { start: 3, end: 4, side: "deletions", endSide: "additions" }, "unified", "new.ts", "old.ts", "r");
  expect(quote).toContain("-old\n+new\n+extra"); expect(quote).toContain('a/old.ts'); expect(quote).toContain('b/new.ts');
});
it("quotes only the selected side in split view", () => {
  const quote = selectedDiffQuote(file, { start: 3, end: 4, side: "additions" }, "split", "new.ts", "old.ts", "r");
  expect(quote).toContain("+new\n+extra"); expect(quote).not.toContain("-old");
});
it("handles reverse drag and crossing a collapsed gap without inventing context", () => {
  const forward = selectedDiffQuote(file, { start: 2, end: 21, side: "additions" }, "unified", "new.ts", "old.ts", "r");
  const reverse = selectedDiffQuote(file, { start: 21, end: 2, side: "additions" }, "unified", "new.ts", "old.ts", "r");
  expect(forward.slice(forward.indexOf("```"))).toBe(reverse.slice(reverse.indexOf("```")));
  expect(forward.match(/^@@ /gm)).toHaveLength(2); expect(forward).toContain("+next");
});
it("rejects non-visible lines", () => {
  expect(() => selectedDiffQuote(file, { start: 10, end: 20 }, "unified", "new.ts", "old.ts", "r")).toThrow("visible");
});
it("bounds the amount of selected text added to a draft", () => {
  const large = parsePatchFiles("diff --git a/a b/a\n--- a/a\n+++ b/a\n@@ -0,0 +1,501 @@\n" + "+line\n".repeat(501))[0].files[0];
  expect(() => selectedDiffQuote(large, { start: 1, end: 501, side: "additions" }, "unified", "a", "a", "r")).toThrow("500");
});
