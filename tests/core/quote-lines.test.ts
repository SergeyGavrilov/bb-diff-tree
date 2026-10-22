import { expect, it } from "vitest";
import { formatQuote } from "../../src/core/quote-lines";
it("includes path and immutable revision context in the draft fragment", () => {
  const quote = formatQuote("src/a.ts", "Commit abc123", "+new", "new line 3");
  expect(quote).toContain("src/a.ts"); expect(quote).toContain("Commit abc123"); expect(quote).toContain("new line 3"); expect(quote).toContain("+new");
});
it("keeps embedded code fences inside the quoted block", () => {
  expect(formatQuote("a.md", "r", "```", "line 1")).toContain("````\n```\n````");
});
