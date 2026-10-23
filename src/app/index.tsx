import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { definePluginApp, experimental_Icon as Icon, experimental_FileLink as FileLink, experimental_BranchPicker as BranchPicker, useComposer } from "@get-bb/plugin-sdk/app";
import { buildTree, filterFiles } from "../core/tree";
import type { ChangedFile, Directory } from "../core/tree";
import { useChanges } from "./hooks/use-changes";
import { useFileDiff } from "./hooks/use-file-diff";
import type { Scope, Snapshot } from "./hooks/use-changes";
import { useHistory } from "./hooks/use-history";
import { InteractiveDiff } from "./components/interactive-diff";
import { ActionIcon } from "./components/action-icon";
import { automaticBaseHint } from "../core/comparison-base";
import { FileIcon } from "./components/file-icon";
import { HeaderButton } from "./components/header-button";
import { usePreferences } from "./hooks/use-preferences";
import { mountChatFileLinks } from "./chat-file-links";
import { useFileRequest } from "./file-navigation";
import { DiffLoading } from "./components/diff-loading";
import { FileSource } from "./components/file-source";
import { useWorktree } from "./hooks/use-worktree";
import { changedEntries, worktreeEntries, validWorkspacePath } from "../core/worktree";
import type { BrowserFile } from "../core/worktree";
import type { Environment } from "../core/comparison-base";
import "./styles.css";

const statusLabels: Record<ChangedFile["changeKind"], string> = { added: "A", copied: "C", deleted: "D", modified: "M", renamed: "R", type_changed: "T" };
function Stats({ additions, deletions }: { additions: number; deletions: number }) {
  return <span className="dt-stats"><span className="dt-added">{additions ? `+${additions.toLocaleString()}` : ""}</span><span className="dt-deleted">{deletions ? `−${deletions.toLocaleString()}` : ""}</span></span>;
}
function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`dt-notice ${error ? "dt-error" : ""}`} role={error ? "alert" : "status"}>{children}</div>;
}

function TreeRows({ directory, collapsed, toggle, selected, select, mention, depth = 0, searching }: {
  directory: Directory<BrowserFile>; collapsed: Set<string>; toggle: (path: string) => void; selected: string | null;
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
    {file.change && <><span className={`dt-status dt-status-${file.change.changeKind}`} aria-label={file.change.changeKind}>{statusLabels[file.change.changeKind]}</span><Stats {...file.change} /></>}
  </button>)}</>;
}
function directoryPaths(directory: Directory<BrowserFile>): string[] {
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
  const patch = useFileDiff(snapshot, file);
  const { smoothTransitions } = usePreferences();
  if (!file) return <Notice>Select a file in the tree.</Notice>;
  const loading = !file.binary && file.loadMode !== "too_large" && !patch?.error && patch?.patch === undefined;
  const transitionKey = JSON.stringify([snapshot.environmentId, snapshot.target, snapshot.mergeBaseRef, file.path]);
  return <section className="dt-preview" aria-label="Selected file diff">
    <header className="dt-file-header"><FileIcon path={file.path} /><div className="dt-file-path"><strong>{file.path}</strong>{file.previousPath && <small>← {file.previousPath}</small>}</div><Stats {...file} />
      <button type="button" className="dt-action" title="Add file mention to chat" aria-label="Add file mention to chat" onClick={() => mention(file.path)}><ActionIcon kind="quote" /></button>
      {file.changeKind !== "deleted" && <FileLink target={{ kind: "workspace", environmentId: snapshot.environmentId, path: file.path }} className="dt-open" title={snapshot.target.type === "range" ? "Open working-copy file" : "Open file"} aria-label="Open file"><Icon name="ExternalLink" className="dt-icon" /></FileLink>}
    </header>
    <div className="dt-diff-body" aria-busy={loading}>{file.binary ? <Notice>Binary file — no text diff available.</Notice> : file.loadMode === "too_large" ? <Notice>This file exceeds the BB diff limit. Open the file to view it.</Notice> : patch?.error ? <Notice error>{patch.error}</Notice> : patch?.patch === undefined ? <DiffLoading smooth={smoothTransitions} /> : <div key={transitionKey} className={`dt-diff-reveal${smoothTransitions ? " dt-diff-reveal-smooth" : ""}`}>
      {patch.truncated && <Notice>Partial diff: the BB size limit was reached.</Notice>}
      {patch.patch ? <InteractiveDiff patch={patch.patch} path={file.path} oldPath={file.previousPath ?? undefined} revision={snapshot.target.type === "range" ? `${snapshot.label} (${snapshot.target.from}..${snapshot.target.to})` : snapshot.label} view={view} contents={patch.contents} contextError={patch.contextError} /> : <Notice>No text changes (empty file, rename, or permission change).</Notice>}
    </div>}</div>
  </section>;
}

const noChanges: ChangedFile[] = [];
function ChangesBrowser({ snapshot, environment, revision, worktreeMode, browseWorktree, request }: { snapshot?: Snapshot; environment: Environment; revision: number; worktreeMode: boolean; browseWorktree: () => void; request?: { path: string; sequence: number } }) {
  const preferences = usePreferences();
  const composer = useComposer();
  const [mentionStatus, setMentionStatus] = useState<{ error: boolean; text: string }>();
  const mention = (path: string) => {
    try {
      composer.insert({ kind: "path", source: "workspace", entryKind: "file", path, label: path, from: 0, to: path.length }, { at: "end", block: true });
      composer.focus(); setMentionStatus({ error: false, text: `Added ${path} to draft` });
    } catch (cause) { setMentionStatus({ error: true, text: cause instanceof Error ? cause.message : String(cause) }); }
  };
  const [query, setQuery] = useState("");
  const worktree = useWorktree(environment.id, worktreeMode, revision, query);
  const [changesCollapsed, setChangesCollapsed] = useState(new Set<string>());
  const [worktreeCollapsed, setWorktreeCollapsed] = useState<Set<string>>();
  const [selected, setSelected] = useState<string | null>(request?.path ?? null);
  const [view, setView] = useState<"unified" | "split">(preferences.defaultView);
  const [manualView, setManualView] = useState(false);
  const [preview, setPreview] = useState<"diff" | "file">("diff");
  useEffect(() => { if (!manualView) setView(preferences.defaultView); }, [preferences.defaultView, manualView]);
  useEffect(() => {
    if (!request) return;
    setQuery(""); setSelected(request.path);
    setChangesCollapsed(previous => new Set([...previous].filter(path => !request.path.startsWith(`${path}/`))));
    setWorktreeCollapsed(previous => previous ? new Set([...previous].filter(path => !request.path.startsWith(`${path}/`))) : undefined);
  }, [request]);
  const changes = snapshot?.files ?? noChanges;
  const entries = useMemo(() => worktreeMode ? worktreeEntries(worktree?.paths ?? [], changes) : { files: changedEntries(changes), directories: [] }, [worktreeMode, worktree?.paths, changes]);
  const filtered = useMemo(() => worktreeMode ? entries.files : filterFiles(entries.files, query), [worktreeMode, entries.files, query]);
  const tree = useMemo(() => buildTree(filtered, entries.directories), [filtered, entries.directories]);
  const missingRequested = !worktreeMode && selected === request?.path && !changes.some(file => file.path === selected);
  const requestedFile: BrowserFile | undefined = worktreeMode && selected === request?.path && validWorkspacePath(selected!) ? { path: selected! } : undefined;
  const selectedFile = missingRequested ? undefined : filtered.find(file => file.path === selected) ?? requestedFile ?? filtered[0];
  const defaultCollapsed = useMemo(() => new Set(directoryPaths(tree).filter(path => !request?.path.startsWith(`${path}/`))), [tree, request]);
  const collapsed = worktreeMode ? worktreeCollapsed ?? defaultCollapsed : changesCollapsed;
  const setCollapsed = (next: Set<string> | ((previous: Set<string>) => Set<string>)) => {
    if (worktreeMode) setWorktreeCollapsed(previous => typeof next === "function" ? next(previous ?? defaultCollapsed) : next);
    else setChangesCollapsed(next);
  };
  const showSource = !!selectedFile && (!selectedFile.change || !snapshot || (preview === "file" && (worktreeMode || selectedFile.change.changeKind !== "deleted")));
  const toggle = (path: string) => setCollapsed(previous => { const next = new Set(previous); if (!next.delete(path)) next.add(path); return next; });
  return <div className="dt-browser">
    <aside className="dt-sidebar" aria-label={worktreeMode ? "Worktree files" : "Changed files"}>
      <div className="dt-search"><Icon name="Search" className="dt-icon" /><input aria-label="Search files" placeholder="Search by path…" maxLength={256} value={query} onChange={event => setQuery(event.target.value)} />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><Icon name="X" className="dt-icon" /></button>}</div>
      <div className="dt-tree-toolbar"><span>{filtered.length} / {entries.files.length} files</span><button type="button" title="Expand all" aria-label="Expand all" onClick={() => setCollapsed(new Set())}><ActionIcon kind="expand" /></button><button type="button" title="Collapse all" aria-label="Collapse all" disabled={!!query.trim()} onClick={() => setCollapsed(new Set(directoryPaths(tree)))}><ActionIcon kind="collapse" /></button></div>
      {worktreeMode && worktree?.truncated && <p className="dt-context" role="status">The worktree list is partial. Search by path to find files outside this list.</p>}
      <nav className="dt-tree" aria-label={worktreeMode ? "Worktree tree" : "Changes tree"} onKeyDown={navigateRows}>{worktreeMode && !worktree ? <Notice>Loading worktree…</Notice> : worktreeMode && worktree?.error ? <Notice error>{worktree.error}</Notice> : filtered.length || tree.directories.length ? <TreeRows directory={tree} collapsed={collapsed} toggle={toggle} selected={selectedFile?.path ?? null} select={setSelected} mention={mention} searching={!!query.trim()} /> : <Notice>{query ? "No matching files." : worktreeMode ? "No files in the worktree." : "No changes."}</Notice>}</nav>
      {mentionStatus && <div className={`dt-context ${mentionStatus.error ? "dt-error" : ""}`} role={mentionStatus.error ? "alert" : "status"}>{mentionStatus.text}</div>}
      <footer className="dt-summary"><Stats {...buildTree(entries.files)} /><span>{worktreeMode ? "Working copy" : snapshot?.label}</span></footer>
    </aside>
    <div className="dt-content"><div className="dt-view-toolbar"><span>{showSource ? "File" : "Changes"}</span>
      <div className="dt-preview-controls">
      {!showSource && <div className="dt-segment" role="group" aria-label="Diff view"><button type="button" aria-pressed={view === "unified"} onClick={() => { setView("unified"); setManualView(true); }}>Unified</button><button type="button" aria-pressed={view === "split"} onClick={() => { setView("split"); setManualView(true); }}>Split</button></div>}
      {selectedFile && <div className="dt-segment" role="group" aria-label="File preview"><button type="button" disabled={!selectedFile.change || !snapshot} aria-pressed={!showSource} onClick={() => setPreview("diff")}>Diff</button><button type="button" disabled={!worktreeMode && selectedFile.change?.changeKind === "deleted"} aria-pressed={showSource} onClick={() => setPreview("file")}>File</button></div>}
      </div>
    </div>{missingRequested ? <Notice><strong>{selected}</strong><p>No changes for this file in the selected comparison.</p><button type="button" className="dt-action dt-text-action" onClick={browseWorktree}>View in worktree</button><FileLink target={{ kind: "workspace", environmentId: environment.id, path: selected! }}>Open file in BB</FileLink></Notice> : showSource && selectedFile ? <FileSource environment={environment} path={selectedFile.path} revision={revision} mention={mention} /> : snapshot ? <FileDiff snapshot={snapshot} file={selectedFile?.change} view={view} mention={mention} /> : <Notice>Select a file in the tree.</Notice>}</div>
  </div>;
}

export function DiffTreePanel({ threadId }: { threadId: string }) {
  const preferences = usePreferences();
  const request = useFileRequest(threadId);
  const previousRequest = useRef(request);
  const [scope, setScope] = useState<Scope>("all");
  const [base, setBase] = useState("");
  const [revision, setRevision] = useState(0);
  const [count, setCount] = useState(1);
  const [commit, setCommit] = useState("");
  const [worktreeMode, setWorktreeMode] = useState(false);
  useEffect(() => {
    if (previousRequest.current === request) return;
    previousRequest.current = request;
    if (request) { setScope("all"); setRevision(value => value + 1); }
  }, [request]);
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
    if (!preferences.refreshOnReturn) return;
    const onVisible = () => { if (document.visibilityState === "visible") refreshRef.current(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [preferences.refreshOnReturn]);
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
      <button type="button" className="dt-action dt-text-action dt-worktree-toggle" onClick={() => setWorktreeMode(value => !value)} title={worktreeMode ? "Full worktree shown. Switch to changes only" : "Changes only shown. Browse the full worktree"} aria-label="Browse worktree" aria-pressed={worktreeMode}><Icon name="FolderTree" className="dt-icon" />Worktree<span className="dt-worktree-state">{worktreeMode ? "Full tree" : "Diff"}</span></button>
      <button type="button" className="dt-action dt-refresh" onClick={refresh} title="Refresh" aria-label="Refresh"><ActionIcon kind="refresh" /></button>
    </header>
    {scope === "recent" && <p className="dt-context">Combined diff of the last {count === 1 ? "commit" : `${count} commits`} along first-parent history. Working-copy changes are excluded.</p>}
    {scope === "commit" && history.hasMore && <p className="dt-context">Showing the 200 most recent commits along first-parent history.</p>}
    {scope === "commit" && history.error && <Notice error>{history.error}</Notice>}
    {snapshot?.truncated && <Notice>The BB file limit was reached; some changed files may be missing.</Notice>}
    {error && worktreeMode && environment && <p className="dt-context" role="status">Comparison unavailable: {error}. Worktree files are still available.</p>}
    {environment && (worktreeMode || snapshot) ? <ChangesBrowser key={threadId} snapshot={snapshot} environment={environment} revision={revision} worktreeMode={worktreeMode} browseWorktree={() => setWorktreeMode(true)} request={request} /> : error ? <Notice error>{error}</Notice> : <Notice>{scope === "commit" ? history.loading ? "Loading commit history…" : "Choose a commit to view its changes." : "Loading changes…"}</Notice>}
  </div>;
}
export default definePluginApp(app => {
  app.contentScripts.register({ id: "chat-file-links", mount: () => mountChatFileLinks() });
  app.slots.threadPanelAction({ id: "changes", title: "Diff Tree", icon: "GitBranch", layout: "flush", component: DiffTreePanel });
  app.slots.experimental_threadHeaderAction({ id: "open", title: "Diff Tree", component: HeaderButton });
});
