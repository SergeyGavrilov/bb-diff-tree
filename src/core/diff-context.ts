import { parsePatchFiles, processFile } from "@pierre/diffs";
import type { FileDiffMetadata } from "@pierre/diffs";
export interface DiffContents { old: string; next: string }

/** Keep Git's hunk boundaries; only hydrate context when both versions match. */
export function contextualDiff(patch: string, contents?: DiffContents): { file: FileDiffMetadata | null; error?: string } {
  let partial: FileDiffMetadata | null = null;
  try {
    partial = parsePatchFiles(patch, undefined, true).flatMap(item => item.files)[0] ?? null;
    if (!partial || !contents || !partial.hunks.length) return { file: partial };
    const full = processFile(patch, { oldFile: { name: partial.prevName ?? partial.name, contents: contents.old }, newFile: { name: partial.name, contents: contents.next }, throwOnError: true });
    if (!full) throw new Error();
    let oldEnd = 0, newEnd = 0;
    partial.hunks.forEach((hunk, index) => {
      const hydrated = full.hunks[index];
      const oldStart = hunk.deletionCount ? hunk.deletionStart - 1 : hunk.deletionStart;
      const newStart = hunk.additionCount ? hunk.additionStart - 1 : hunk.additionStart;
      if (oldStart < oldEnd || newStart < newEnd ||
        full.deletionLines.slice(oldEnd, oldStart).join("") !== full.additionLines.slice(newEnd, newStart).join("") ||
        full.deletionLines.slice(oldStart, oldStart + hunk.deletionCount).join("") !== partial!.deletionLines.slice(hunk.deletionLineIndex, hunk.deletionLineIndex + hunk.deletionCount).join("") ||
        full.additionLines.slice(newStart, newStart + hunk.additionCount).join("") !== partial!.additionLines.slice(hunk.additionLineIndex, hunk.additionLineIndex + hunk.additionCount).join("") || !hydrated) throw new Error();
      oldEnd = oldStart + hunk.deletionCount; newEnd = newStart + hunk.additionCount;
    });
    if (full.deletionLines.slice(oldEnd).join("") !== full.additionLines.slice(newEnd).join("")) throw new Error();
    return { file: full };
  } catch {
    return { file: partial, error: contents ? "File contents changed. Refresh to expand unchanged lines." : undefined };
  }
}
