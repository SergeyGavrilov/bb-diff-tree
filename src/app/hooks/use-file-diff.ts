import { useEffect, useState } from "react";
import { useRpc, useSdk } from "@get-bb/plugin-sdk/app";
import type { ChangedFile } from "../../core/tree";
import type { DiffContents } from "../../core/diff-context";
import type { rpcContract } from "../../shared/contracts";
import type { Snapshot } from "./use-changes";

type Sdk = ReturnType<typeof useSdk>;
type Rpc = ReturnType<typeof useRpc<typeof rpcContract>>;
interface FileDiffState {
  key: string;
  patch?: string;
  truncated?: boolean;
  error?: string;
  contents?: DiffContents;
  contextError?: string;
}
const message = (cause: unknown) => cause instanceof Error ? cause.message : String(cause);

async function readPatch(sdk: Sdk, rpc: Rpc, snapshot: Snapshot, file: ChangedFile, signal: AbortSignal) {
  const initial = snapshot.initialPatches.find(patch => patch.path === file.path);
  if (initial) return initial;
  if (snapshot.target.type === "range") {
    return rpc.call("committedPatch", { environmentId: snapshot.environmentId, from: snapshot.target.from, to: snapshot.target.to, path: file.path, previousPath: file.previousPath });
  }
  const result = await sdk.environments.diffPatch({ environmentId: snapshot.environmentId, paths: [file.path], target: snapshot.target, signal });
  if (result.outcome === "not_applicable") throw new Error(result.message);
  if (result.outcome === "unavailable") throw new Error(result.failure.message);
  const patch = result.patches.find(item => item.path === file.path);
  if (!patch) throw new Error("The file has changed. Refresh the changes list.");
  return patch;
}

async function readContents(sdk: Sdk, rpc: Rpc, snapshot: Snapshot, file: ChangedFile, signal: AbortSignal): Promise<DiffContents> {
  if (snapshot.target.type === "range") {
    return rpc.call("committedContents", { environmentId: snapshot.environmentId, from: snapshot.target.from, to: snapshot.target.to, path: file.path, previousPath: file.previousPath });
  }
  const target = snapshot.target.type === "uncommitted" ? { target: "uncommitted" as const }
    : snapshot.mergeBaseRef ? { target: "all" as const, mergeBaseRef: snapshot.mergeBaseRef }
    : null;
  if (!target) throw new Error("Refresh to resolve the comparison revision.");
  const read = async (side: "old" | "new") => {
    if (side === "old" && file.changeKind === "added" || side === "new" && file.changeKind === "deleted") return "";
    const result = await sdk.environments.diffFile({ environmentId: snapshot.environmentId, ...target, path: file.path, side, signal });
    if (result.sizeBytes > 512 * 1024) throw new Error("Context exceeds the 512 KiB per-file limit.");
    if (result.contentEncoding !== "utf8" || result.content.includes("\0")) throw new Error("Context is unavailable for binary files.");
    return result.content;
  };
  const [old, next] = await Promise.all([read("old"), read("new")]);
  return { old, next };
}

export function useFileDiff(snapshot: Snapshot, file: ChangedFile | undefined) {
  const sdk = useSdk();
  const rpc = useRpc<typeof rpcContract>();
  const [state, setState] = useState<FileDiffState>();
  // A metadata refresh changes snapshot identity but not the comparison. Never
  // retain a diff across a different file, workspace, side, or pinned revision.
  const key = JSON.stringify([snapshot.environmentId, snapshot.target, snapshot.mergeBaseRef, file?.path, file?.previousPath, file?.changeKind, file?.binary, file?.loadMode]);
  const refreshing = state?.key === key && state.patch !== undefined;
  useEffect(() => {
    if (!file || file.binary || file.loadMode === "too_large") return;
    const selectedFile = file;
    const controller = new AbortController();
    const signal = controller.signal;
    const commit = (next: Omit<FileDiffState, "key">) => {
      if (signal.aborted) return;
      setState(previous => {
        const unchanged = previous?.key === key && next.contents && previous.contents?.old === next.contents.old && previous.contents.next === next.contents.next;
        return { ...next, key, contents: unchanged ? previous.contents : next.contents };
      });
    };
    async function load() {
      const context = readContents(sdk, rpc, snapshot, selectedFile, signal)
        .then(contents => ({ contents }), cause => ({ contextError: message(cause) }));
      const patch = await readPatch(sdk, rpc, snapshot, selectedFile, signal);
      // First open can render its patch immediately. During refresh keep the
      // mounted viewer until both new versions arrive, then replace together.
      if (!refreshing) commit(patch);
      commit({ ...patch, ...await context });
    }
    load().catch(cause => commit({ error: message(cause) }));
    return () => controller.abort();
    // `refreshing` describes the view at request start; completing a request
    // must not schedule another request.
  }, [sdk, rpc, snapshot, file, key]);
  return state?.key === key ? state : undefined;
}
