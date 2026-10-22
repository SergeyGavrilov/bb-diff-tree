import type { Environment } from "../../src/core/comparison-base";

export function environmentFixture(overrides: Partial<Environment> = {}): Environment {
  return {
    id: "env-1", hostId: "host-1", projectId: "project-1", name: null,
    path: "/workspace", isGitRepo: true, isWorktree: false, branchName: "feature",
    baseBranch: null, defaultBranch: "main", mergeBaseBranch: null, status: "ready",
    environmentProviderId: "project-checkout", environmentProviderInstanceKey: null,
    environmentProviderSelection: { machine: { type: "existing", hostId: "host-1" }, inputs: {} },
    lifecycle: { phase: "active", retireAt: null, teardown: null }, hostLifecycle: "active",
    managed: false, workspaceProvisionType: "unmanaged", createdAt: 0, updatedAt: 0,
    ...overrides,
  };
}
