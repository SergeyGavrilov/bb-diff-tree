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

export interface Directory {
  name: string;
  path: string;
  directories: Directory[];
  files: ChangedFile[];
  count: number;
  additions: number;
  deletions: number;
}

export function buildTree(files: readonly ChangedFile[]): Directory {
  const root: Directory = { name: "", path: "", directories: [], files: [], count: 0, additions: 0, deletions: 0 };
  const directories = new Map<string, Directory>([["", root]]);
  for (const file of files) {
    const parts = file.path.split("/");
    parts.pop();
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
    parent.files.push(file);
    for (const directory of ancestors) {
      directory.count++;
      directory.additions += file.additions;
      directory.deletions += file.deletions;
    }
  }
  for (const directory of directories.values()) {
    directory.directories.sort((a, b) => a.name.localeCompare(b.name));
    directory.files.sort((a, b) => a.path.localeCompare(b.path));
  }
  return root;
}

export function filterFiles(files: readonly ChangedFile[], query: string): ChangedFile[] {
  const needle = query.trim().toLocaleLowerCase();
  return files.filter(file => `${file.path}\n${file.previousPath ?? ""}`.toLocaleLowerCase().includes(needle));
}
