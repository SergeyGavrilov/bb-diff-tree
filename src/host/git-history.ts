import { execFile } from "node:child_process";
import type { Commit, CommitSelection } from "../shared/contracts";
import type { ChangedFile } from "../core/tree";

class GitError extends Error {
  constructor(message: string, readonly code: unknown) { super(message); }
}
async function git(workspace: string, args: string[], signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile("git", ["--no-pager", "-c", "core.quotePath=false", "-C", workspace, ...args], {
      encoding: "utf8", timeout: 20000, maxBuffer: 4 * 1024 * 1024, signal,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" },
    }, (error, stdout, stderr) => {
      if (error) reject(new GitError(error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER" ? "Diff exceeds the 4 MiB preview limit." : stderr.trim() || error.message, error.code));
      else resolve(stdout);
    });
    child.stdin?.end();
  });
}
async function head(workspace: string, signal?: AbortSignal) {
  await git(workspace, ["rev-parse", "--is-inside-work-tree"], signal);
  try { return (await git(workspace, ["rev-parse", "--verify", "--quiet", "HEAD"], signal)).trim(); }
  catch (error) { if (error instanceof GitError && error.code === 1) return null; throw error; }
}
export async function history(workspace: string, signal?: AbortSignal) {
  const tip = await head(workspace, signal);
  if (!tip) return { commits: [], hasMore: false };
  const output = await git(workspace, ["log", "--no-show-signature", "--first-parent", "-z", "--format=%H%x00%ct%x00%an%x00%s", "-n", "201", tip, "--"], signal);
  const fields = output.split("\0");
  const commits: Commit[] = [];
  for (let i = 0; i + 3 < fields.length; i += 4) {
    const sha = fields[i].trim();
    commits.push({ sha, shortSha: sha.slice(0, 8), timestamp: Number(fields[i + 1]), author: fields[i + 2], subject: fields[i + 3] });
  }
  return { commits: commits.slice(0, 200), hasMore: commits.length > 200 };
}

function statusKind(status: string): ChangedFile["changeKind"] {
  switch (status[0]) { case "A": return "added"; case "D": return "deleted"; case "R": return "renamed"; case "C": return "copied"; case "T": return "type_changed"; default: return "modified"; }
}
function parseFiles(names: string, statistics: string): ChangedFile[] {
  const stats = new Map<string, { additions: number; deletions: number; binary: boolean }>();
  const fields = statistics.split("\0");
  for (let i = 0; i < fields.length && fields[i]; i++) {
    const match = /^([^\t]+)\t([^\t]+)\t([\s\S]*)$/.exec(fields[i]);
    if (!match) throw new Error("Invalid Git line statistics.");
    let path = match[3];
    if (!path) { i++; path = fields[++i]; }
    stats.set(path, { additions: Number(match[1]) || 0, deletions: Number(match[2]) || 0, binary: match[1] === "-" || match[2] === "-" });
  }
  const records = names.split("\0");
  const files: ChangedFile[] = [];
  for (let i = 0; i < records.length && records[i];) {
    const status = records[i++];
    let path = records[i++];
    let previousPath: string | null = null;
    if (/^[RC]/.test(status)) { previousPath = path; path = records[i++]; }
    const stat = stats.get(path);
    if (!path || !stat) throw new Error("Git file list and statistics do not match.");
    files.push({ path, previousPath, ...stat, changeKind: statusKind(status), loadMode: stat.additions + stat.deletions > 50000 ? "too_large" : "on_demand", origin: "tracked" });
  }
  return files;
}
const diffArgs = ["diff", "--no-color", "--no-ext-diff", "--no-textconv", "--find-renames"];
export async function committedChanges(workspace: string, selection: CommitSelection, signal?: AbortSignal) {
  const tip = await head(workspace, signal);
  if (!tip) throw new Error("No commits yet. Use Uncommitted to view working-copy changes.");
  const to = selection.kind === "commit" ? (await git(workspace, ["rev-parse", "--verify", `${selection.sha}^{commit}`], signal)).trim() : tip;
  const count = selection.kind === "recent" ? selection.count : 1;
  const ancestry = (await git(workspace, ["rev-list", "--first-parent", `--max-count=${count + 1}`, to, "--"], signal)).trim().split("\n");
  const included = Math.min(count, ancestry.length);
  const from = ancestry[count] ?? (await git(workspace, ["hash-object", "-t", "tree", "--stdin"], signal)).trim();
  const [names, statistics] = await Promise.all([
    git(workspace, [...diffArgs, "--name-status", "-z", from, to, "--"], signal),
    git(workspace, [...diffArgs, "--numstat", "-z", from, to, "--"], signal),
  ]);
  const allFiles = parseFiles(names, statistics);
  const label = selection.kind === "commit" ? `Commit ${to.slice(0, 8)}` : `Last ${included === 1 ? "commit" : `${included} commits`} · ${to.slice(0, 8)}`;
  return { from, to, label, files: allFiles.slice(0, 10000), truncated: allFiles.length > 10000 };
}
export async function committedPatch(workspace: string, input: { from: string; to: string; path: string; previousPath: string | null }, signal?: AbortSignal) {
  const paths = input.previousPath && input.previousPath !== input.path ? [input.path, input.previousPath] : [input.path];
  // Literal pathspecs preserve brackets, asterisks and other valid filename characters.
  const output = await git(workspace, [...diffArgs, "--patch", input.from, input.to, "--", ...paths.map(path => `:(literal)${path}`)], signal);
  const patches = output.split(/(?=^diff --git )/m).filter(Boolean);
  // A rename's old name may be reused by another file in the same range.
  // Return only the chosen file to BB's single-file diff component.
  const patch = patches.length <= 1 ? output : patches.find(part => {
    const header = part.split("\n", 1)[0];
    return header.endsWith(` b/${input.path}`) || header.endsWith(` ${JSON.stringify(`b/${input.path}`)}`);
  });
  if (patch === undefined) throw new Error("Could not isolate the selected file's patch.");
  return { path: input.path, patch, truncated: false };
}

export async function committedContents(workspace: string, input: { from: string; to: string; path: string; previousPath: string | null }, signal?: AbortSignal) {
  async function read(revision: string, path: string) {
    const entry = await git(workspace, ["ls-tree", "-z", revision, "--", `:(literal)${path}`], signal);
    if (!entry) return ""; // Added/deleted files and the empty tree before the root commit.
    const match = /^\d+ blob ([0-9a-f]+)\t/.exec(entry);
    if (!match) throw new Error("Context is unavailable for this file type.");
    const size = Number((await git(workspace, ["cat-file", "-s", match[1]], signal)).trim());
    // Bound the JSON response below the host's 8 MiB wire limit, including escaping.
    if (size > 512 * 1024) throw new Error("Context exceeds the 512 KiB per-file limit.");
    const content = await git(workspace, ["cat-file", "blob", match[1]], signal);
    if (content.includes("\0")) throw new Error("Context is unavailable for binary files.");
    return content;
  }
  const [old, next] = await Promise.all([read(input.from, input.previousPath ?? input.path), read(input.to, input.path)]);
  return { old, next };
}
