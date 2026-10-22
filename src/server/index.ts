import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { hostContract, rpcContract } from "../shared/contracts";
import { settingDescriptors } from "../shared/settings";

export default function plugin(bb: BbPluginApi) {
  bb.settings.define(settingDescriptors);
  const lifecycle = new AbortController();
  bb.onDispose(() => lifecycle.abort());
  const host = bb.hosts.experimental_client({ contract: hostContract });
  async function workspace(environmentId: string) {
    const environment = await bb.sdk.environments.get({ environmentId, signal: lifecycle.signal });
    if (!environment.path || !environment.isGitRepo) throw new Error("This environment has no Git workspace.");
    return { path: environment.path, hostId: environment.hostId };
  }
  bb.rpc.register(rpcContract, {
    history: async ({ environmentId }) => {
      const target = await workspace(environmentId);
      return host.call("history", { workspace: target.path }, { hostId: target.hostId, signal: lifecycle.signal });
    },
    committedChanges: async ({ environmentId, selection }) => {
      const target = await workspace(environmentId);
      return host.call("changes", { workspace: target.path, selection }, { hostId: target.hostId, signal: lifecycle.signal });
    },
    committedPatch: async ({ environmentId, ...input }) => {
      const target = await workspace(environmentId);
      return host.call("patch", { workspace: target.path, ...input }, { hostId: target.hostId, signal: lifecycle.signal });
    },
    committedContents: async ({ environmentId, ...input }) => {
      const target = await workspace(environmentId);
      return host.call("contents", { workspace: target.path, ...input }, { hostId: target.hostId, signal: lifecycle.signal });
    },
  });
}
