import type { FileDiffMetadata, SelectedLineRange } from "@pierre/diffs";
import { formatQuote } from "./quote-lines";

interface Row {
  hunk: number;
  old: number | null;
  next: number | null;
  side: "deletions" | "additions" | null;
  unified: number;
  split: number;
  prefix: " " | "-" | "+";
  text: string;
}
function rows(file: FileDiffMetadata): Row[] {
  const result: Row[] = [];
  let oldEnd = 0, newEnd = 0, unifiedEnd = 0, splitEnd = 0;
  const context = (count: number, hunk: number) => {
    for (let offset = 0; offset < count; offset++) result.push({ hunk, old: oldEnd + offset + 1, next: newEnd + offset + 1, side: null, unified: unifiedEnd + offset, split: splitEnd + offset, prefix: " ", text: (file.additionLines[newEnd + offset] ?? "").replace(/\r?\n$/, "") });
  };
  file.hunks.forEach((hunk, index) => {
    if (!file.isPartial) context(hunk.collapsedBefore, -index - 1);
    let unified = hunk.unifiedLineStart, split = hunk.splitLineStart;
    for (const block of hunk.hunkContent) {
      if (block.type === "context") {
        for (let offset = 0; offset < block.lines; offset++) result.push({
          hunk: index, old: hunk.deletionStart + block.deletionLineIndex - hunk.deletionLineIndex + offset,
          next: hunk.additionStart + block.additionLineIndex - hunk.additionLineIndex + offset,
          side: null, unified: unified + offset, split: split + offset, prefix: " ",
          text: (file.additionLines[block.additionLineIndex + offset] ?? "").replace(/\r?\n$/, ""),
        });
        unified += block.lines; split += block.lines;
      } else {
        for (let offset = 0; offset < block.deletions; offset++) result.push({
          hunk: index, old: hunk.deletionStart + block.deletionLineIndex - hunk.deletionLineIndex + offset,
          next: null, side: "deletions", unified: unified + offset, split: split + offset, prefix: "-",
          text: (file.deletionLines[block.deletionLineIndex + offset] ?? "").replace(/\r?\n$/, ""),
        });
        for (let offset = 0; offset < block.additions; offset++) result.push({
          hunk: index, old: null, next: hunk.additionStart + block.additionLineIndex - hunk.additionLineIndex + offset,
          side: "additions", unified: unified + block.deletions + offset, split: split + offset, prefix: "+",
          text: (file.additionLines[block.additionLineIndex + offset] ?? "").replace(/\r?\n$/, ""),
        });
        unified += block.deletions + block.additions; split += Math.max(block.deletions, block.additions);
      }
    }
    oldEnd = hunk.deletionCount ? hunk.deletionStart - 1 + hunk.deletionCount : hunk.deletionStart;
    newEnd = hunk.additionCount ? hunk.additionStart - 1 + hunk.additionCount : hunk.additionStart;
    unifiedEnd = unified; splitEnd = split;
  });
  if (!file.isPartial) context(file.additionLines.length - newEnd, -file.hunks.length - 1);
  return result;
}
export function selectedDiffQuote(file: FileDiffMetadata, range: SelectedLineRange, view: "split" | "unified", path: string, oldPath: string, revision: string): string {
  const lines = rows(file);
  const startSide = range.side ?? "additions", endSide = range.endSide ?? startSide;
  const first = lines.find(row => (startSide === "deletions" ? row.old : row.next) === range.start);
  const last = lines.find(row => (endSide === "deletions" ? row.old : row.next) === range.end);
  if (!first || !last) throw new Error("Select lines visible in this diff.");
  const coordinate = (row: Row) => view === "split" ? row.split : row.unified;
  const start = Math.min(coordinate(first), coordinate(last)), end = Math.max(coordinate(first), coordinate(last));
  const selected = lines.filter(row => coordinate(row) >= start && coordinate(row) <= end && (view === "unified" || startSide !== endSide || row.side === null || row.side === startSide));
  if (!selected.length || selected.length > 500) throw new Error("Select between 1 and 500 visible diff lines.");
  const groups = new Map<number, Row[]>();
  for (const row of selected) { const group = groups.get(row.hunk) ?? []; group.push(row); groups.set(row.hunk, group); }
  const patch = [`--- ${JSON.stringify(`a/${oldPath}`)}`, `+++ ${JSON.stringify(`b/${path}`)}`];
  for (const group of groups.values()) {
    const old = group.flatMap(row => row.old === null ? [] : [row.old]);
    const next = group.flatMap(row => row.next === null ? [] : [row.next]);
    const oldStart = old[0] ?? Math.max(0, (next[0] ?? 1) - 1), newStart = next[0] ?? Math.max(0, (old[0] ?? 1) - 1);
    patch.push(`@@ -${oldStart},${old.length} +${newStart},${next.length} @@`, ...group.map(row => row.prefix + row.text));
  }
  const describe = (side: string, number: number) => `${side === "deletions" ? "old" : "new"} line ${number}`;
  return formatQuote(path, revision, patch.join("\n"), `${describe(startSide, range.start)} → ${describe(endSide, range.end)}`);
}
