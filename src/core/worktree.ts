import type { ChangedFile, TreeFile } from "./tree";

export interface BrowserFile extends TreeFile { change?: ChangedFile }
export interface WorktreePath { path: string; kind: "file" | "directory" }

export function validWorkspacePath(path: string) {
  return !!path && !path.startsWith("/") && !/^[a-z][a-z\d+.-]*:/i.test(path) && !/[\u0000-\u001f\u007f]/u.test(path)
    && !path.split(/[\\/]/).some(part => !part || part === "." || part === ".." || part === ".git");
}
export function changedEntries(files: readonly ChangedFile[]): BrowserFile[] {
  return files.map(change => ({ path: change.path, previousPath: change.previousPath, additions: change.additions, deletions: change.deletions, change }));
}
export function worktreeEntries(paths: readonly WorktreePath[], changes: readonly ChangedFile[]) {
  const changed = new Map(changedEntries(changes).map(file => [file.path, file]));
  const unique = new Map(paths.filter(entry => validWorkspacePath(entry.path)).map(entry => [entry.path, entry]));
  return {
    files: [...unique.values()].filter(entry => entry.kind === "file").map(entry => changed.get(entry.path) ?? { path: entry.path }),
    directories: [...unique.values()].filter(entry => entry.kind === "directory").map(entry => entry.path),
  };
}
