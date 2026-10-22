import { useEffect, useState } from "react";
import { useRpc, useSdk } from "@get-bb/plugin-sdk/app";
import type { ChangedFile } from "../../core/tree";
import type { DiffContents } from "../../core/diff-context";
import { automaticBase } from "../../core/comparison-base";
import type { AutomaticBase, Environment } from "../../core/comparison-base";
import type { rpcContract } from "../../shared/contracts";

export type Scope = "all" | "uncommitted" | "recent" | "commit";
export interface Snapshot {
  environmentId: string;
  base: string;
  label: string;
  mergeBaseRef?: string | null;
  target: { type: "uncommitted" } | { type: "all"; mergeBaseBranch: string } | { type: "range"; from: string; to: string };
  files: ChangedFile[];
  initialPatches: { path: string; patch: string; truncated: boolean }[];
  truncated: boolean;
}
const message = (cause: unknown) => cause instanceof Error ? cause.message : String(cause);

export function useChanges(threadId: string, scope: Scope, base: string, revision: number, count = 1, commit = "") {
  const sdk = useSdk();
  const rpc = useRpc<typeof rpcContract>();
  const [state, setState] = useState<{ key: string; threadId?: string; environment?: Environment; automatic?: AutomaticBase; snapshot?: Snapshot; error?: string }>({ key: "" });
  const key = JSON.stringify([threadId, scope, base, count, commit]);
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    let environment: Environment | undefined;
    let automatic: AutomaticBase | undefined;
    async function load() {
      const thread = await sdk.threads.get({ threadId, signal });
      if (!thread.environmentId) throw new Error("This thread has no workspace.");
      const environmentId = thread.environmentId;
      environment = await sdk.environments.get({ environmentId, signal });
      if (scope === "commit" && !commit) {
        if (!signal.aborted) setState({ key, threadId, environment });
        return;
      }
      if (scope === "recent" || scope === "commit") {
        const selection = scope === "recent" ? { kind: "recent" as const, count } : { kind: "commit" as const, sha: commit };
        const result = await rpc.call("committedChanges", { environmentId, selection });
        if (!signal.aborted) setState({ key, threadId, environment, snapshot: { environmentId, base: "", label: result.label, target: { type: "range", from: result.from, to: result.to }, files: result.files, initialPatches: [], truncated: result.truncated } });
        return;
      }
      let resolvedBase = base;
      let effectiveScope = scope;
      if (scope === "all") {
        const status = await sdk.environments.status({ environmentId, signal });
        if (status.outcome === "not_applicable") throw new Error(status.message);
        if (status.outcome === "unavailable") throw new Error(status.failure.message);
        automatic = automaticBase(environment, status.workspace);
        resolvedBase ||= automatic.branch;
        // BB's branch diff is empty without HEAD, even when untracked files exist.
        if (status.workspace.checkout.kind === "unborn") effectiveScope = "uncommitted";
      }
      const target = effectiveScope === "uncommitted"
        ? { target: "uncommitted" as const }
        : { target: "all" as const, mergeBaseBranch: resolvedBase };
      const patchTarget = effectiveScope === "uncommitted"
        ? { type: "uncommitted" as const }
        : { type: "all" as const, mergeBaseBranch: resolvedBase };
      const result = await sdk.environments.diffFiles({ environmentId, ...target, signal });
      if (result.outcome === "not_applicable") throw new Error(result.message);
      if (result.outcome === "unavailable") throw new Error(result.failure.message);
      if (!signal.aborted) setState({ key, threadId, environment, automatic, snapshot: { environmentId, base: resolvedBase, label: effectiveScope === "uncommitted" ? scope === "all" ? "Before the first commit" : "Working copy" : `From ${resolvedBase}`, target: patchTarget, ...result } });
    }
    load().catch(cause => { if (!signal.aborted) setState({ key, threadId, environment, automatic, error: message(cause) }); });
    return () => controller.abort();
  }, [sdk, rpc, threadId, scope, base, key, revision, count, commit]);
  return state.key === key ? state : { key, environment: state.threadId === threadId ? state.environment : undefined, automatic: state.threadId === threadId ? state.automatic : undefined };
}

export function usePatch(snapshot: Snapshot, file: ChangedFile | undefined) {
  const sdk = useSdk();
  const rpc = useRpc<typeof rpcContract>();
  const [state, setState] = useState<{ snapshot: Snapshot; path: string; patch?: string; truncated?: boolean; error?: string }>();
  useEffect(() => {
    if (!file || file.binary || file.loadMode === "too_large") return;
    const controller = new AbortController();
    const signal = controller.signal;
    const selectedFile = file;
    async function load() {
      const initial = snapshot.initialPatches.find(patch => patch.path === selectedFile.path);
      if (initial) {
        setState({ snapshot, ...initial });
        return;
      }
      if (snapshot.target.type === "range") {
        const patch = await rpc.call("committedPatch", { environmentId: snapshot.environmentId, from: snapshot.target.from, to: snapshot.target.to, path: selectedFile.path, previousPath: selectedFile.previousPath });
        if (!signal.aborted) setState({ snapshot, ...patch });
        return;
      }
      const result = await sdk.environments.diffPatch({ environmentId: snapshot.environmentId, paths: [selectedFile.path], target: snapshot.target, signal });
      if (result.outcome === "not_applicable") throw new Error(result.message);
      if (result.outcome === "unavailable") throw new Error(result.failure.message);
      const patch = result.patches.find(item => item.path === selectedFile.path);
      if (!patch) throw new Error("The file has changed. Refresh the changes list.");
      if (!signal.aborted) setState({ snapshot, ...patch });
    }
    load().catch(cause => { if (!signal.aborted) setState({ snapshot, path: selectedFile.path, error: message(cause) }); });
    return () => controller.abort();
  }, [sdk, rpc, snapshot, file]);
  return state?.snapshot === snapshot && state.path === file?.path ? state : undefined;
}


export function useContents(snapshot: Snapshot, file: ChangedFile | undefined) {
  const sdk = useSdk();
  const rpc = useRpc<typeof rpcContract>();
  const [state, setState] = useState<{ snapshot: Snapshot; path: string; contents?: DiffContents; error?: string }>();
  useEffect(() => {
    if (!file || file.binary || file.loadMode === "too_large") return;
    const controller = new AbortController();
    const signal = controller.signal;
    const selectedFile = file;
    async function load() {
      let contents: DiffContents;
      if (snapshot.target.type === "range") {
        contents = await rpc.call("committedContents", { environmentId: snapshot.environmentId, from: snapshot.target.from, to: snapshot.target.to, path: selectedFile.path, previousPath: selectedFile.previousPath });
      } else {
        const target = snapshot.target.type === "uncommitted" ? { target: "uncommitted" as const }
          : snapshot.mergeBaseRef ? { target: "all" as const, mergeBaseRef: snapshot.mergeBaseRef }
          : null;
        if (!target) throw new Error("Refresh to resolve the comparison revision.");
        const read = async (side: "old" | "new") => {
          if (side === "old" && selectedFile.changeKind === "added" || side === "new" && selectedFile.changeKind === "deleted") return "";
          const result = await sdk.environments.diffFile({ environmentId: snapshot.environmentId, ...target, path: selectedFile.path, side, signal });
          if (result.sizeBytes > 512 * 1024) throw new Error("Context exceeds the 512 KiB per-file limit.");
          if (result.contentEncoding !== "utf8" || result.content.includes("\0")) throw new Error("Context is unavailable for binary files.");
          return result.content;
        };
        const [old, next] = await Promise.all([read("old"), read("new")]);
        contents = { old, next };
      }
      if (!signal.aborted) setState({ snapshot, path: selectedFile.path, contents });
    }
    load().catch(cause => { if (!signal.aborted) setState({ snapshot, path: selectedFile.path, error: message(cause) }); });
    return () => controller.abort();
  }, [sdk, rpc, snapshot, file]);
  return state?.snapshot === snapshot && state.path === file?.path ? state : undefined;
}
