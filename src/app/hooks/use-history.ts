import { useEffect, useState } from "react";
import { useRpc } from "@get-bb/plugin-sdk/app";
import type { Commit, rpcContract } from "../../shared/contracts";

export function useHistory(environmentId: string | undefined, revision: number) {
  const rpc = useRpc<typeof rpcContract>();
  const [state, setState] = useState<{ key: string; commits: Commit[]; hasMore: boolean; error?: string }>({ key: "", commits: [], hasMore: false });
  const key = JSON.stringify([environmentId, revision]);
  useEffect(() => {
    if (!environmentId) return;
    let active = true;
    rpc.call("history", { environmentId }).then(result => {
      if (active) setState({ key, ...result });
    }, cause => { if (active) setState({ key, commits: [], hasMore: false, error: cause instanceof Error ? cause.message : String(cause) }); });
    return () => { active = false; };
  }, [rpc, environmentId, key]);
  return state.key === key ? { ...state, loading: false } : { commits: [], hasMore: false, loading: !!environmentId, error: undefined };
}
