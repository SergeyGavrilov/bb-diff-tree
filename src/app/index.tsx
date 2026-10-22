import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { definePluginApp, experimental_Icon as Icon, experimental_FileLink as FileLink, experimental_BranchPicker as BranchPicker, useBbNavigate, useComposer } from "@get-bb/plugin-sdk/app";
import { buildTree, filterFiles } from "../core/tree";
import type { ChangedFile, Directory } from "../core/tree";
import { useChanges, usePatch, useContents } from "./hooks/use-changes";
import type { Scope, Snapshot } from "./hooks/use-changes";
import { useHistory } from "./hooks/use-history";
import { InteractiveDiff } from "./components/interactive-diff";
import { ActionIcon } from "./components/action-icon";
import { automaticBaseHint } from "../core/comparison-base";
import { FileIcon } from "./components/file-icon";
import "./styles.css";

const statusLabels: Record<ChangedFile["changeKind"], string> = { added: "A", copied: "C", deleted: "D", modified: "M", renamed: "R", type_changed: "T" };
function Stats({ additions, deletions }: { additions: number; deletions: number }) {
  return <span className="dt-stats"><span className="dt-added">{additions ? `+${additions.toLocaleString()}` : ""}</span><span className="dt-deleted">{deletions ? `−${deletions.toLocaleString()}` : ""}</span></span>;
}
function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`dt-notice ${error ? "dt-error" : ""}`} role={error ? "alert" : "status"}>{children}</div>;
}

function TreeRows({ directory, collapsed, toggle, selected, select, mention, depth = 0, searching }: {
  directory: Directory; collapsed: Set<string>; toggle: (path: string) => void; selected: string | null;
  select: (path: string) => void; mention: (path: string) => void; depth?: number; searching: boolean;
}) {
  return <>{directory.directories.map(child => {
    const open = searching || !collapsed.has(child.path);
    return <div key={child.path}>
      <button type="button" className="dt-row dt-directory" style={{ paddingLeft: 12 + depth * 16 }} aria-expanded={open} onClick={() => toggle(child.path)} title={child.path}>
        <Icon name={open ? "ChevronDown" : "ChevronRight"} className="dt-icon" />
        <Icon name={open ? "FolderOpen" : "Folder"} className="dt-icon dt-folder" />
        <span className="dt-name">{child.name}</span><span className="dt-count">{child.count}</span><Stats {...child} />
      </button>
      {open && <TreeRows directory={child} collapsed={collapsed} toggle={toggle} selected={selected} select={select} mention={mention} depth={depth + 1} searching={searching} />}
    </div>;
  })}{directory.files.map(file => <button type="button" key={file.path} className={`dt-row ${selected === file.path ? "dt-selected" : ""}`} style={{ paddingLeft: 30 + depth * 16 }} aria-current={selected === file.path ? "true" : undefined} onClick={event => { if (event.metaKey || event.ctrlKey) { event.preventDefault(); mention(file.path); } else select(file.path); }} title={`${file.previousPath ? `${file.previousPath} → ${file.path}` : file.path}\nCmd/Ctrl+click to add file to chat`}>
    <FileIcon path={file.path} /><span className="dt-name">{file.path.split("/").pop()}</span>
    <span className={`dt-status dt-status-${file.changeKind}`} aria-label={file.changeKind}>{statusLabels[file.changeKind]}</span><Stats {...file} />
  </button>)}</>;
}
function directoryPaths(directory: Directory): string[] {
  return directory.directories.flatMap(child => [child.path, ...directoryPaths(child)]);
}
function navigateRows(event: KeyboardEvent<HTMLElement>) {
  if (!["ArrowDown", "ArrowUp", "Home", "End", "ArrowRight", "ArrowLeft"].includes(event.key)) return;
  const rows = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>(".dt-row"));
  const current = rows.indexOf(document.activeElement as HTMLButtonElement);
  if (current < 0) return;
  event.preventDefault();
  const row = rows[current];
  const expanded = row.getAttribute("aria-expanded");
  if ((event.key === "ArrowRight" && expanded === "false") || (event.key === "ArrowLeft" && expanded === "true")) { row.click(); return; }
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") return;
  const next = event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, current + (event.key === "ArrowDown" ? 1 : -1)));
  rows[next]?.focus();
}

function FileDiff({ snapshot, file, view, mention }: { snapshot: Snapshot; file: ChangedFile | undefined; view: "unified" | "split"; mention: (path: string) => void }) {
  const patch = usePatch(snapshot, file);
  const context = useContents(snapshot, file);
  if (!file) return <Notice>Select a file in the tree.</Notice>;
  return <section className="dt-preview" aria-label="Selected file diff">
    <header className="dt-file-header"><FileIcon path={file.path} /><div className="dt-file-path"><strong>{file.path}</strong>{file.previousPath && <small>← {file.previousPath}</small>}</div><Stats {...file} />
      <button type="button" className="dt-action" title="Add file mention to chat" aria-label="Add file mention to chat" onClick={() => mention(file.path)}><ActionIcon kind="quote" /></button>
      {file.changeKind !== "deleted" && <FileLink target={{ kind: "workspace", environmentId: snapshot.environmentId, path: file.path }} className="dt-open" title={snapshot.target.type === "range" ? "Open working-copy file" : "Open file"} aria-label="Open file"><Icon name="ExternalLink" className="dt-icon" /></FileLink>}
    </header>
    <div className="dt-diff-body">{file.binary ? <Notice>Binary file — no text diff available.</Notice> : file.loadMode === "too_large" ? <Notice>This file exceeds the BB diff limit. Open the file to view it.</Notice> : patch?.error ? <Notice error>{patch.error}</Notice> : patch?.patch === undefined ? <Notice>Loading diff…</Notice> : <>
      {patch.truncated && <Notice>Partial diff: the BB size limit was reached.</Notice>}
      {patch.patch ? <InteractiveDiff patch={patch.patch} path={file.path} oldPath={file.previousPath ?? undefined} revision={snapshot.target.type === "range" ? `${snapshot.label} (${snapshot.target.from}..${snapshot.target.to})` : snapshot.label} view={view} contents={context?.contents} contextError={context?.error} /> : <Notice>No text changes (empty file, rename, or permission change).</Notice>}
    </>}</div>
  </section>;
}

function ChangesBrowser({ snapshot }: { snapshot: Snapshot }) {
  const composer = useComposer();
  const [mentionStatus, setMentionStatus] = useState<{ error: boolean; text: string }>();
  const mention = (path: string) => {
    try {
      composer.insert({ kind: "path", source: "workspace", entryKind: "file", path, label: path, from: 0, to: path.length }, { at: "end", block: true });
      composer.focus(); setMentionStatus({ error: false, text: `Added ${path} to draft` });
    } catch (cause) { setMentionStatus({ error: true, text: cause instanceof Error ? cause.message : String(cause) }); }
  };
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(new Set<string>());
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"unified" | "split">("unified");
  const filtered = useMemo(() => filterFiles(snapshot.files, query), [snapshot.files, query]);
  const tree = useMemo(() => buildTree(filtered), [filtered]);
  const selectedFile = filtered.find(file => file.path === selected) ?? filtered[0];
  const toggle = (path: string) => setCollapsed(previous => { const next = new Set(previous); if (!next.delete(path)) next.add(path); return next; });
  return <div className="dt-browser">
    <aside className="dt-sidebar" aria-label="Changed files">
      <div className="dt-search"><Icon name="Search" className="dt-icon" /><input aria-label="Search files" placeholder="Search by path…" value={query} onChange={event => setQuery(event.target.value)} />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><Icon name="X" className="dt-icon" /></button>}</div>
      <div className="dt-tree-toolbar"><span>{filtered.length} / {snapshot.files.length} files</span><button type="button" title="Expand all" aria-label="Expand all" onClick={() => setCollapsed(new Set())}><ActionIcon kind="expand" /></button><button type="button" title="Collapse all" aria-label="Collapse all" disabled={!!query.trim()} onClick={() => setCollapsed(new Set(directoryPaths(tree)))}><ActionIcon kind="collapse" /></button></div>
      <nav className="dt-tree" aria-label="Changes tree" onKeyDown={navigateRows}>{filtered.length ? <TreeRows directory={tree} collapsed={collapsed} toggle={toggle} selected={selectedFile?.path ?? null} select={setSelected} mention={mention} searching={!!query.trim()} /> : <Notice>{query ? "No matching files." : "No changes."}</Notice>}</nav>
      {mentionStatus && <div className={`dt-context ${mentionStatus.error ? "dt-error" : ""}`} role={mentionStatus.error ? "alert" : "status"}>{mentionStatus.text}</div>}
      <footer className="dt-summary"><Stats {...buildTree(snapshot.files)} /><span>{snapshot.label}</span></footer>
    </aside>
    <div className="dt-content"><div className="dt-view-toolbar"><span>Changes</span><div className="dt-segment" role="group" aria-label="Diff view"><button type="button" aria-pressed={view === "unified"} onClick={() => setView("unified")}>Unified</button><button type="button" aria-pressed={view === "split"} onClick={() => setView("split")}>Split</button></div></div><FileDiff snapshot={snapshot} file={selectedFile} view={view} mention={mention} /></div>
  </div>;
}

export function DiffTreePanel({ threadId }: { threadId: string }) {
  const [scope, setScope] = useState<Scope>("all");
  const [base, setBase] = useState("");
  const [revision, setRevision] = useState(0);
  const [count, setCount] = useState(1);
  const [commit, setCommit] = useState("");
  const { snapshot, error, environment, automatic } = useChanges(threadId, scope, base, revision, count, commit);
  const history = useHistory(scope === "commit" ? environment?.id : undefined, revision);
  useEffect(() => {
    if (scope === "commit" && !commit && history.commits[0]) setCommit(history.commits[0].sha);
  }, [scope, commit, history.commits]);
  // Manual refresh keeps large diffs stable during review; refresh on returning to the tab.
  const refresh = () => setRevision(value => value + 1);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") refreshRef.current(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  return <div className="dt-root">
    <header className="dt-toolbar">
      <div className="dt-brand"><Icon name="GitBranch" className="dt-icon" /><strong>Diff Tree</strong></div>
      <div className="dt-toolbar-fields">
        <select className="dt-select dt-scope" aria-label="Changes scope" value={scope} onChange={event => setScope(event.target.value as Scope)}>
          <option value="all">All changes</option><option value="uncommitted">Uncommitted</option><option value="recent">Recent commits</option><option value="commit">Single commit</option>
        </select>
        {scope === "all" && <div className="dt-base-control">
          <div className="dt-base-picker" title={base ? `Manual selection: ${base}` : automatic ? automaticBaseHint(automatic) : "Loading comparison branch…"}>
            <div className="dt-native-picker"><BranchPicker hostId={environment?.hostId ?? null} projectId={environment?.projectId ?? null} value={base || automatic?.branch || null} onChange={value => setBase(value ?? "")} label="Base" placeholder="Choose branch" /></div>
            <span className="dt-auto-badge" aria-label={base ? "Manual comparison branch" : automatic ? automaticBaseHint(automatic) : "Automatic comparison branch"}>{base ? "Manual" : "Auto"}</span>
            {base && <button type="button" className="dt-action" onClick={() => setBase("")} title="Use automatic comparison branch" aria-label="Use automatic comparison branch"><ActionIcon kind="refresh" /></button>}
          </div>
        </div>}
        {scope === "recent" && <label className="dt-count-control">Last <input type="number" aria-label="Number of commits" min="1" max="100" value={count} onChange={event => setCount(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} /> {count === 1 ? "commit" : "commits"}</label>}
        {scope === "commit" && <select className="dt-select dt-commit-select" aria-label="Commit" value={commit} onChange={event => setCommit(event.target.value)} disabled={history.loading || !history.commits.length}>
          {!history.commits.length && <option value="">{history.loading ? "Loading history…" : "No commits yet"}</option>}
          {history.commits.map(item => <option key={item.sha} value={item.sha}>{item.shortSha} · {item.subject} · {item.author}</option>)}
        </select>}
      </div>
      <button type="button" className="dt-action dt-refresh" onClick={refresh} title="Refresh" aria-label="Refresh"><ActionIcon kind="refresh" /></button>
    </header>
    {scope === "recent" && <p className="dt-context">Combined diff of the last {count === 1 ? "commit" : `${count} commits`} along first-parent history. Working-copy changes are excluded.</p>}
    {scope === "commit" && history.hasMore && <p className="dt-context">Showing the 200 most recent commits along first-parent history.</p>}
    {scope === "commit" && history.error && <Notice error>{history.error}</Notice>}
    {snapshot?.truncated && <Notice>The BB file limit was reached; some changed files may be missing.</Notice>}
    {error ? <Notice error>{error}</Notice> : snapshot ? <ChangesBrowser key={threadId} snapshot={snapshot} /> : <Notice>{scope === "commit" ? history.loading ? "Loading commit history…" : "Choose a commit to view its changes." : "Loading changes…"}</Notice>}
  </div>;
}
function HeaderButton() {
  const navigate = useBbNavigate();
  return <button type="button" className="dt-launch" aria-label="Open Diff Tree" title="Diff Tree — browse changes by folder" onClick={() => navigate.openThreadPanel({ actionId: "changes", title: "Diff Tree" })}><Icon name="GitBranch" className="dt-icon" /></button>;
}
export default definePluginApp(app => {
  app.slots.threadPanelAction({ id: "changes", title: "Diff Tree", icon: "GitBranch", layout: "flush", component: DiffTreePanel });
  app.slots.experimental_threadHeaderAction({ id: "open", title: "Diff Tree", component: HeaderButton });
});
