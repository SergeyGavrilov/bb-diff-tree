import { afterAll, beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import type { useSdk } from "@get-bb/plugin-sdk/app";
import type { ChangedFile } from "../src/core/tree";
import { environmentFixture } from "./fixtures/environment";

// jsdom lacks these browser APIs. Keep Pierre's real rendering and pointer handlers.
beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("CSSStyleSheet", class extends CSSStyleSheet { replaceSync() {} });
});
afterAll(() => vi.unstubAllGlobals());

const file = (path: string, extra: Partial<ChangedFile> = {}): ChangedFile => ({ path, previousPath: null, additions: 7, deletions: 2, changeKind: "modified", binary: false, loadMode: "on_demand", origin: "tracked", ...extra });
const patch = (path: string) => ({ path, truncated: false, patch: `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-old\n+new\n` });
const filesResult = (files: ChangedFile[]) => ({ outcome: "available" as const, files, initialPatches: [], mergeBaseRef: "abc", shortstat: "", truncated: false });
function makeThreadResponse({ environmentId }: { environmentId: string }): Awaited<ReturnType<ReturnType<typeof useSdk>["threads"]["get"]>> {
  return { activeBackgroundAgentCount: 0, archivedAt: null, canRestoreEnvironment: false, canSpawnChild: true,
    createdAt: 0, deletedAt: null, environmentId, id: "thread-1", lastReadAt: null, latestAttentionAt: 0,
    lifecycleOwnerThreadId: null, originKind: null, originPluginId: null, parentThreadId: null, pinnedAt: null,
    projectId: "project-1", providerId: "codex", queuedMessageCount: 0, runtime: { displayStatus: "idle" },
    sectionId: null, sourceThreadId: null, status: "idle", title: "Test", titleFallback: null, updatedAt: 0, visibility: "visible" };
}
const statusResult: Awaited<ReturnType<ReturnType<typeof useSdk>["environments"]["status"]>> = {
  outcome: "available", workspace: {
    branch: { currentBranch: "feature", defaultBranch: "main" },
    checkout: { kind: "branch", branchName: "feature", headSha: "abc" },
    mergeBase: { mergeBaseBranch: "develop", aheadCount: 1, behindCount: 0, baseRef: "abc", commits: [], deletions: 0, fileCount: 0, files: [], hasCommittedUnmergedChanges: true, insertions: 0, lineStatsComplete: true },
    workingTree: { state: "clean", deletions: 0, fileCount: 0, files: [], hasUncommittedChanges: false, insertions: 0, lineStatsComplete: true },
  },
};
const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); });
async function open(files: ChangedFile[], overrides: Record<string, unknown> = {}, rpc: Record<string, (input: any) => any> = {}) {
  const app = await loadPluginApp(() => import("../src/app/index"));
  const slot = renderSlot(app.threadPanelActions[0]!, { threadId: "thread-1", params: null }, {
    rpc,
    composer: { text: "Existing draft", scope: { kind: "thread", threadId: "thread-1" } },
    sdk: {
      threads: { get: async () => makeThreadResponse({ environmentId: "env-1" }) },
      environments: {
        get: async () => environmentFixture(),
        status: async () => statusResult,
        diffFiles: async () => filesResult(files),
        diffPatch: async ({ paths }: { paths: string[] }) => ({ outcome: "available", patches: paths.map(patch) }),
        diffFile: async ({ path, side }: { path: string; side: string }) => ({ path, content: side === "old" ? "old\n" : "new\n", contentEncoding: "utf8", sizeBytes: 4 }),
        ...overrides,
      },
    },
  });
  cleanups.push(() => slot.lifecycle.unmount());
  await slot.findByRole("navigation", { name: "Changes tree" });
  return slot;
}

describe("Diff Tree panel", () => {
  it.each(["header", "cmd", "ctrl"])("adds a workspace mention through %s without submitting or changing selection", async gesture => {
    const slot = await open([file("a.ts"), file("src/b.py")]);
    if (gesture === "header") fireEvent.click(slot.getByRole("button", { name: "Add file mention to chat" }));
    else fireEvent.click(slot.getByRole("button", { name: /b.py/ }), { metaKey: gesture === "cmd", ctrlKey: gesture === "ctrl" });
    const path = gesture === "header" ? "a.ts" : "src/b.py";
    expect(slot.inspection.composer.text).toContain("Existing draft");
    expect(slot.inspection.composer.draft.mentions).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "path", source: "workspace", entryKind: "file", path })]));
    expect(slot.inspection.composer.submits).toHaveLength(0);
    expect(slot.getByRole("button", { name: /a.ts/ }).getAttribute("aria-current")).toBe("true");
    expect(slot.getByRole("button", { name: /b.py/ }).querySelector(".dt-file-icon svg path")).toBeTruthy();
  });

  it.each(["Unified", "Split"])("expands context in both directions and at both file edges in %s view", async view => {
    const old = Array.from({ length: 180 }, (_, i) => `line ${i + 1}\n`).join("");
    const next = old.replace("line 40\n", "changed 40\n").replace("line 140\n", "changed 140\n");
    const content = "diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -39,3 +39,3 @@\n line 39\n-line 40\n+changed 40\n line 41\n@@ -139,3 +139,3 @@\n line 139\n-line 140\n+changed 140\n line 141\n";
    const slot = await open([file("a.ts")], {
      diffPatch: async () => ({ outcome: "available", patches: [{ path: "a.ts", patch: content, truncated: false }] }),
      diffFile: async ({ side }: { side: string }) => ({ path: "a.ts", content: side === "old" ? old : next, contentEncoding: "utf8", sizeBytes: 1600 }),
    });
    fireEvent.click(slot.getByRole("button", { name: view }));
    let shadow: ShadowRoot;
    await waitFor(() => { shadow = slot.container.querySelector("diffs-container")!.shadowRoot!; expect(shadow?.querySelector('[data-expand-up]')).toBeTruthy(); });
    const gap = () => shadow.querySelector('[data-separator]:not([data-separator-first]):not([data-separator-last])')!;
    expect(shadow!.querySelector('[data-column-number="42"]')).toBeNull();
    fireEvent.click(gap().querySelector('[data-expand-up]')!);
    await waitFor(() => expect(shadow.querySelector('[data-column-number="42"]')).toBeTruthy());
    fireEvent.click(gap().querySelector('[data-expand-down]')!);
    await waitFor(() => expect(shadow.querySelector('[data-column-number="138"]')).toBeTruthy());
    fireEvent.click(shadow!.querySelector('[data-separator-first] [data-expand-down]')!);
    await waitFor(() => expect(shadow.querySelector('[data-column-number="38"]')).toBeTruthy());
    fireEvent.click(shadow!.querySelector('[data-separator-last] [data-expand-up]')!);
    await waitFor(() => expect(shadow.querySelector('[data-column-number="142"]')).toBeTruthy());
    const line = shadow!.querySelector('[data-column-number="42"]')!;
    Object.defineProperty(shadow!, "elementFromPoint", { value: () => line, configurable: true });
    for (const type of ["pointerdown", "pointerup"]) {
      const event = new MouseEvent(type, { bubbles: true, composed: true, button: 0, clientX: 40, clientY: 40 });
      Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: "mouse" } });
      fireEvent(type === "pointerdown" ? line : document, event);
    }
    fireEvent.click(await slot.findByRole("button", { name: "Add to chat" }));
    expect(slot.inspection.composer.text).toContain(" line 42");
    expect(slot.inspection.sdkCalls.filter(call => call.method === "environments.diffFile").map(call => call.args[0])).toEqual(expect.arrayContaining([
      expect.objectContaining({ target: "all", mergeBaseRef: "abc", side: "old" }), expect.objectContaining({ target: "all", mergeBaseRef: "abc", side: "new" }),
    ]));
  });

  it("keeps the patch readable when full context cannot be loaded", async () => {
    const slot = await open([file("a.ts")], { diffFile: async () => { throw new Error("File unavailable"); } });
    await slot.findByText("Unchanged lines unavailable: File unavailable");
    await waitFor(() => expect(slot.container.querySelector("diffs-container")?.shadowRoot?.querySelector('[data-column-number="1"]')).toBeTruthy());
    expect(slot.queryByRole("alert")).toBeNull();
  });
  it("groups files, searches paths, expands search results and loads only the chosen patch", async () => {
    const slot = await open([file("src/domain/account.ts"), file("src/api/routes.ts"), file("README.md")]);
    expect(slot.getByRole("button", { name: /src/ }).getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(slot.getByRole("button", { name: "Collapse all" }));
    expect(slot.queryByRole("button", { name: /account.ts/ })).toBeNull();
    fireEvent.change(slot.getByRole("textbox", { name: "Search files" }), { target: { value: "domain/acc" } });
    await slot.findByRole("button", { name: /account.ts/ });
    expect(slot.queryByRole("button", { name: /routes.ts/ })).toBeNull();
    await waitFor(() => expect(slot.inspection.sdkCalls.some(call => call.method === "environments.diffPatch" && JSON.stringify(call.args).includes("src/domain/account.ts"))).toBe(true));
  });

  it("resolves the configured base branch and switches to working-copy changes", async () => {
    const slot = await open([file("a.ts")]);
    const initial = slot.inspection.sdkCalls.find(call => call.method === "environments.diffFiles");
    expect(initial?.args[0]).toMatchObject({ environmentId: "env-1", target: "all", mergeBaseBranch: "develop" });
    fireEvent.change(slot.getByRole("combobox", { name: "Changes scope" }), { target: { value: "uncommitted" } });
    await waitFor(() => expect(slot.inspection.sdkCalls.filter(call => call.method === "environments.diffFiles").at(-1)?.args[0]).toMatchObject({ target: "uncommitted" }));
  });

  it("shows all files and loads their patches before the first commit, including with an explicit base", async () => {
    const unbornStatus = { ...statusResult, workspace: { ...statusResult.workspace,
      checkout: { kind: "unborn", branchName: "main" }, mergeBase: null,
    } };
    const slot = await open([file("first.ts")], {
      status: async () => unbornStatus,
      diffFiles: async ({ target }: { target: string }) => filesResult(target === "uncommitted" ? [file("first.ts")] : []),
      diffPatch: async ({ target, paths }: { target: { type: string }; paths: string[] }) => ({ outcome: "available", patches: target.type === "uncommitted" ? paths.map(patch) : [] }),
    });
    await slot.findByRole("button", { name: /first.ts/ });
    await waitFor(() => expect(slot.inspection.sdkCalls.filter(call => call.method === "environments.diffPatch").at(-1)?.args[0]).toMatchObject({ target: { type: "uncommitted" }, paths: ["first.ts"] }));
    fireEvent.change(slot.getByRole("textbox", { name: "Base" }), { target: { value: "release" } });
    await slot.findByRole("button", { name: /first.ts/ });
    await waitFor(() => expect(slot.inspection.sdkCalls.filter(call => call.method === "environments.diffFiles")).toHaveLength(2));
    expect(slot.inspection.sdkCalls.filter(call => call.method === "environments.diffFiles").at(-1)?.args[0]).toMatchObject({ target: "uncommitted" });
    expect(slot.queryByRole("alert")).toBeNull();
  });

  it("resumes branch comparison after the first commit", async () => {
    let committed = false;
    const slot = await open([file("first.ts")], {
      status: async () => committed ? statusResult : { ...statusResult, workspace: { ...statusResult.workspace, checkout: { kind: "unborn", branchName: "main" }, mergeBase: null } },
    });
    expect(slot.inspection.sdkCalls.find(call => call.method === "environments.diffFiles")?.args[0]).toMatchObject({ target: "uncommitted" });
    committed = true;
    fireEvent.click(slot.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(slot.inspection.sdkCalls.filter(call => call.method === "environments.diffFiles").at(-1)?.args[0]).toMatchObject({ target: "all", mergeBaseBranch: "develop" }));
  });

  it("compares with the creation branch and supports manual selection and automatic reset", async () => {
    const slot = await open([file("a.ts")], {
      get: async () => environmentFixture({ baseBranch: "feature/parent", mergeBaseBranch: "develop" }),
    });
    const picker = slot.getByTestId("bb-branch-picker");
    expect(picker.getAttribute("data-host-id")).toBe("host-1");
    expect(picker.getAttribute("data-project-id")).toBe("project-1");
    expect((slot.getByRole("textbox", { name: "Base" }) as HTMLInputElement).value).toBe("feature/parent");
    expect(slot.getByLabelText("Created from feature/parent")).toBeTruthy();
    await waitFor(() => expect(slot.inspection.sdkCalls.filter(call => call.method === "environments.diffPatch").at(-1)?.args[0]).toMatchObject({ target: { type: "all", mergeBaseBranch: "feature/parent" } }));
    fireEvent.change(slot.getByRole("textbox", { name: "Base" }), { target: { value: "origin/release" } });
    await waitFor(() => expect(slot.inspection.sdkCalls.filter(call => call.method === "environments.diffFiles").at(-1)?.args[0]).toMatchObject({ mergeBaseBranch: "origin/release" }));
    await waitFor(() => expect(slot.inspection.sdkCalls.filter(call => call.method === "environments.diffPatch").at(-1)?.args[0]).toMatchObject({ target: { type: "all", mergeBaseBranch: "origin/release" } }));
    fireEvent.click(slot.getByRole("button", { name: "Use automatic comparison branch" }));
    await waitFor(() => expect(slot.inspection.sdkCalls.filter(call => call.method === "environments.diffFiles").at(-1)?.args[0]).toMatchObject({ mergeBaseBranch: "feature/parent" }));
    expect(slot.getByRole("option", { name: "All changes" })).toBeTruthy();
    expect(slot.getByRole("option", { name: "Uncommitted" })).toBeTruthy();
  });

  it("keeps the branch picker available when comparison fails", async () => {
    const slot = await open([file("a.ts")], {
      diffFiles: async ({ mergeBaseBranch }: { mergeBaseBranch: string }) => {
        if (mergeBaseBranch === "missing") throw new Error("Branch not found");
        return filesResult([file("a.ts")]);
      },
    });
    fireEvent.change(slot.getByRole("textbox", { name: "Base" }), { target: { value: "missing" } });
    expect(await slot.findByRole("alert")).toBeTruthy();
    fireEvent.change(slot.getByRole("textbox", { name: "Base" }), { target: { value: "main" } });
    await slot.findByRole("navigation", { name: "Changes tree" });
    expect(slot.queryByRole("alert")).toBeNull();
  });

  it("loads recent-commit ranges and an individual history commit through the same immutable target", async () => {
    const a = "a".repeat(40), b = "b".repeat(40), c = "c".repeat(40);
    const slot = await open([file("a.ts")], {}, {
      history: () => ({ commits: [{ sha: b, shortSha: "bbbbbbbb", subject: "Latest", author: "Test", timestamp: 1 }, { sha: a, shortSha: "aaaaaaaa", subject: "Previous", author: "Test", timestamp: 0 }], hasMore: false }),
      committedChanges: ({ selection }: { selection: { kind: string; count?: number; sha?: string } }) => ({ from: c, to: selection.sha ?? b, label: selection.kind === "recent" ? `Last ${selection.count} commits` : "Selected commit", files: [file("history.ts")], truncated: false }),
      committedPatch: ({ path }: { path: string }) => patch(path),
      committedContents: () => ({ old: "old\n", next: "new\n" }),
    });
    fireEvent.change(slot.getByRole("combobox", { name: "Changes scope" }), { target: { value: "recent" } });
    await slot.findByRole("button", { name: /history.ts/ });
    fireEvent.change(slot.getByRole("spinbutton", { name: "Number of commits" }), { target: { value: "2" } });
    await waitFor(() => expect(slot.inspection.rpcCalls.filter(call => call.method === "committedChanges").at(-1)?.input).toMatchObject({ selection: { kind: "recent", count: 2 } }));
    await waitFor(() => expect(slot.inspection.rpcCalls.filter(call => call.method === "committedPatch").at(-1)?.input).toMatchObject({ from: c, to: b, path: "history.ts" }));
    await waitFor(() => expect(slot.inspection.rpcCalls.filter(call => call.method === "committedContents").at(-1)?.input).toMatchObject({ from: c, to: b, path: "history.ts" }));
    fireEvent.change(slot.getByRole("combobox", { name: "Changes scope" }), { target: { value: "commit" } });
    await slot.findByRole("option", { name: /Previous/ });
    fireEvent.change(slot.getByRole("combobox", { name: "Commit" }), { target: { value: a } });
    await waitFor(() => expect(slot.inspection.rpcCalls.filter(call => call.method === "committedChanges").at(-1)?.input).toMatchObject({ selection: { kind: "commit", sha: a } }));
    await waitFor(() => expect(slot.inspection.rpcCalls.filter(call => call.method === "committedPatch").at(-1)?.input).toMatchObject({ from: c, to: a }));
    await waitFor(() => expect(slot.inspection.rpcCalls.filter(call => call.method === "committedContents").at(-1)?.input).toMatchObject({ from: c, to: a }));
  });

  it("adds exact lines and their revision to the existing draft without submitting", async () => {
    const slot = await open([file("a.ts")]);
    let line: Element | undefined;
    await waitFor(() => {
      const shadow = slot.container.querySelector("diffs-container")?.shadowRoot;
      line = Array.from(shadow?.querySelectorAll('[data-column-number="1"]') ?? []).at(-1);
      expect(line).toBeTruthy();
    });
    const pointer = (type: string) => {
      const event = new MouseEvent(type, { bubbles: true, composed: true, button: 0, clientX: 40, clientY: 40 });
      Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: "mouse" } });
      fireEvent(type === "pointerup" ? document : line!, event);
    };
    const shadow = slot.container.querySelector("diffs-container")!.shadowRoot!;
    Object.defineProperty(shadow, "elementFromPoint", { value: () => line, configurable: true });
    pointer("pointerdown"); pointer("pointerup");
    fireEvent.click(await slot.findByRole("button", { name: "Add to chat" }));
    expect(slot.inspection.composer.text).toContain("Existing draft");
    expect(slot.inspection.composer.text).toContain("a.ts");
    expect(slot.inspection.composer.text).toContain("new line 1");
    expect(slot.inspection.composer.text).toContain("From develop");
    expect(slot.inspection.composer.text).toContain("new");
    expect(slot.inspection.composer.submits).toHaveLength(0);
  });

  it.each(["shift", "drag"])("selects multiple rendered lines with %s and adds exactly that diff to the draft", async gesture => {
    const content = "diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1,4 +1,4 @@\n a\n-b\n+B\n c\n d\n";
    const slot = await open([file("a.ts")], { diffPatch: async () => ({ outcome: "available", patches: [{ path: "a.ts", patch: content, truncated: false }] }) });
    let shadow: ShadowRoot;
    await waitFor(() => { shadow = slot.container.querySelector("diffs-container")!.shadowRoot!; expect(shadow?.querySelector('[data-column-number="4"]')).toBeTruthy(); });
    const line = (n: number) => Array.from(shadow.querySelectorAll(`[data-column-number="${n}"]`)).at(-1)!;
    let hovered = line(1);
    Object.defineProperty(shadow!, "elementFromPoint", { value: () => hovered, configurable: true });
    const pointer = (type: string, target: Element | Document, shiftKey = false) => {
      const event = new MouseEvent(type, { bubbles: true, composed: true, shiftKey, button: 0, clientX: 40, clientY: 40 });
      Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: "mouse" } });
      fireEvent(target, event);
    };
    pointer("pointerdown", hovered);
    if (gesture === "shift") {
      pointer("pointerup", document);
      hovered = line(3); pointer("pointerdown", hovered, true);
    } else {
      hovered = line(3); pointer("pointermove", hovered);
    }
    pointer("pointerup", document);
    fireEvent.click(await slot.findByRole("button", { name: "Add to chat" }));
    expect(slot.inspection.composer.text).toContain(" a\n-b\n+B\n c");
    expect(slot.inspection.composer.text).not.toContain("\n d");
    expect(slot.inspection.composer.text).toContain("new line 1 → new line 3");
    expect(slot.inspection.composer.submits).toHaveLength(0);
    expect(slot.queryByRole("spinbutton", { name: "First line" })).toBeNull();
  });

  it("does not download patches for binary files", async () => {
    const slot = await open([file("image.png", { binary: true })]);
    await slot.findByText(/Binary file/);
    expect(slot.inspection.sdkCalls.filter(call => call.method === "environments.diffPatch")).toHaveLength(0);
  });

  it("keeps selection and collapsed folders across refresh", async () => {
    const slot = await open([file("a.ts"), file("src/b.ts")]);
    fireEvent.click(slot.getByRole("button", { name: /b.ts/ }));
    fireEvent.click(slot.getByRole("button", { name: /src/ }));
    fireEvent.click(slot.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(slot.inspection.sdkCalls.filter(call => call.method === "environments.diffFiles")).toHaveLength(2));
    expect(slot.getByRole("button", { name: /src/ }).getAttribute("aria-expanded")).toBe("false");
    expect(slot.getByText("src/b.ts")).toBeTruthy();
  });

  it("shows non-Git environments as an actionable error", async () => {
    const app = await loadPluginApp(() => import("../src/app/index"));
    const slot = renderSlot(app.threadPanelActions[0]!, { threadId: "t", params: null }, { sdk: {
      threads: { get: async () => makeThreadResponse({ environmentId: "e" }) },
      environments: { get: async () => environmentFixture(), status: async () => ({ outcome: "not_applicable", message: "Not a Git repository", reason: "non_git_environment" }) },
    } });
    cleanups.push(() => slot.lifecycle.unmount());
    expect(await slot.findByRole("alert")).toBeTruthy();
  });
});
