import { useEffect, useState } from "react";
import { useSdk } from "@get-bb/plugin-sdk/app";
import type { Environment } from "../../core/comparison-base";
import type { WorktreePath } from "../../core/worktree";
import { validWorkspacePath } from "../../core/worktree";

export function useWorktree(environmentId: string, enabled: boolean, revision: number, query: string) {
  const sdk = useSdk();
  const [state, setState] = useState<{ key: string; paths: WorktreePath[]; truncated: boolean; error?: string }>();
  const key = JSON.stringify([environmentId, query]);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      sdk.environments.paths({ environmentId, query: query.trim() || undefined, includeFiles: "true", includeDirectories: "true", limit: "10000", signal: controller.signal })
        .then(result => { if (!controller.signal.aborted) setState({ key, ...result }); })
        .catch(cause => { if (!controller.signal.aborted) setState({ key, paths: [], truncated: false, error: cause instanceof Error ? cause.message : String(cause) }); });
    }, query.trim() ? 150 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [sdk, environmentId, enabled, revision, query, key]);
  return state?.key === key ? state : undefined;
}

export function useWorktreeFile(environment: Environment, path: string, revision: number) {
  const sdk = useSdk();
  const key = JSON.stringify([environment.id, environment.hostId, environment.path, path]);
  const [state, setState] = useState<{ key: string; content?: string; notice?: string; error?: string }>();
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      if (!environment.path || !validWorkspacePath(path)) throw new Error("Invalid workspace file path.");
      const rootPath = environment.path;
      const absolute = `${rootPath.replace(/[\\/]+$/, "")}/${path}`;
      const result = await sdk.files.read({ hostId: environment.hostId, rootPath, path: absolute, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (result.sizeBytes > 512 * 1024) setState({ key, notice: "This file exceeds the 512 KiB source preview limit. Open it in BB to view it." });
      else if (result.contentEncoding !== "utf8" || result.content.includes("\0")) setState({ key, notice: "Binary file — no source preview available." });
      else setState({ key, content: result.content });
    })().catch(cause => { if (!controller.signal.aborted) setState({ key, error: cause instanceof Error ? cause.message : String(cause) }); });
    return () => controller.abort();
  }, [sdk, environment.id, environment.hostId, environment.path, path, revision, key]);
  return state?.key === key ? state : undefined;
}
