import type { useSdk } from "@get-bb/plugin-sdk/app";

export type Environment = Awaited<ReturnType<ReturnType<typeof useSdk>["environments"]["get"]>>;
export interface AutomaticBase {
  branch: string;
  source: "created" | "configured" | "default";
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function creationBranch(environment: Environment): string | null {
  if (environment.baseBranch) return environment.baseBranch;
  const inputs = environment.environmentProviderSelection?.inputs;
  if (!record(inputs) || !record(inputs.branch)) return null;
  const branch = inputs.branch;
  if (environment.environmentProviderId === "git-worktree" && branch.kind === "named" && typeof branch.name === "string") return branch.name.trim() || null;
  if (environment.environmentProviderId === "project-checkout" && branch.kind === "new" && typeof branch.baseBranch === "string") return branch.baseBranch.trim() || null;
  return null;
}

export function automaticBase(environment: Environment, status: { mergeBase: { mergeBaseBranch: string } | null; branch: { defaultBranch: string } }): AutomaticBase {
  const origin = creationBranch(environment);
  if (origin) return { branch: origin, source: "created" };
  const configured = environment.mergeBaseBranch ?? status.mergeBase?.mergeBaseBranch;
  if (configured) return { branch: configured, source: "configured" };
  return { branch: environment.defaultBranch ?? status.branch.defaultBranch, source: "default" };
}

export function automaticBaseHint(base: AutomaticBase): string {
  if (base.source === "created") return `Created from ${base.branch}`;
  if (base.source === "configured") return `Creation branch unknown · configured comparison: ${base.branch}`;
  return `Creation branch unknown · repository default: ${base.branch}`;
}
