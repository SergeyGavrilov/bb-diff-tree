export interface ChangedFile {
  path: string;
  previousPath: string | null;
  additions: number;
  deletions: number;
  changeKind: "added" | "copied" | "deleted" | "modified" | "renamed" | "type_changed";
  binary: boolean;
  loadMode: "auto" | "on_demand" | "too_large";
  origin: "tracked" | "untracked";
}

export interface TreeFile {
  path: string;
  previousPath?: string | null;
  additions?: number;
  deletions?: number;
}
export interface Directory<T extends TreeFile = ChangedFile> {
  name: string;
  path: string;
  directories: Directory<T>[];
  files: T[];
  count: number;
  additions: number;
  deletions: number;
}

export function buildTree<T extends TreeFile>(files: readonly T[], paths: readonly string[] = []): Directory<T> {
  const root: Directory<T> = { name: "", path: "", directories: [], files: [], count: 0, additions: 0, deletions: 0 };
  const directories = new Map<string, Directory<T>>([["", root]]);
  function ensureDirectory(parts: string[]) {
    let parent = root;
    const ancestors = [root];
    for (const name of parts) {
      const path = parent.path ? `${parent.path}/${name}` : name;
      let directory = directories.get(path);
      if (!directory) {
        directory = { name, path, directories: [], files: [], count: 0, additions: 0, deletions: 0 };
        directories.set(path, directory);
        parent.directories.push(directory);
      }
      parent = directory;
      ancestors.push(parent);
    }
    return { parent, ancestors };
  }
  for (const path of paths) ensureDirectory(path.split("/"));
  for (const file of files) {
    const parts = file.path.split("/"); parts.pop();
    const { parent, ancestors } = ensureDirectory(parts);
    parent.files.push(file);
    for (const directory of ancestors) {
      directory.count++;
      directory.additions += file.additions ?? 0;
      directory.deletions += file.deletions ?? 0;
    }
  }
  for (const directory of directories.values()) {
    directory.directories.sort((a, b) => a.name.localeCompare(b.name));
    directory.files.sort((a, b) => a.path.localeCompare(b.path));
  }
  return root;
}

export function filterFiles<T extends TreeFile>(files: readonly T[], query: string): T[] {
  const needle = query.trim().toLocaleLowerCase();
  return files.filter(file => `${file.path}\n${file.previousPath ?? ""}`.toLocaleLowerCase().includes(needle));
}
