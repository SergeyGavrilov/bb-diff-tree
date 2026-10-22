import { useEffect, useState } from "react";
import { useRpc, useSdk } from "@get-bb/plugin-sdk/app";
import type { ChangedFile } from "../../core/tree";
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
