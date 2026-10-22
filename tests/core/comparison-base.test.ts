import { expect, it } from "vitest";
import { automaticBase, automaticBaseHint } from "../../src/core/comparison-base";
import { environmentFixture } from "../fixtures/environment";

const status = { mergeBase: { mergeBaseBranch: "develop" }, branch: { defaultBranch: "main" } };
it("prefers the recorded creation branch over the configured comparison", () => {
  expect(automaticBase(environmentFixture({ baseBranch: "feature/parent", mergeBaseBranch: "develop" }), status)).toEqual({ branch: "feature/parent", source: "created" });
});
it("reads the named worktree creation branch when the comparison has been changed", () => {
  const environment = environmentFixture({ environmentProviderId: "git-worktree", mergeBaseBranch: "develop", environmentProviderSelection: { machine: { type: "existing", hostId: "host-1" }, inputs: { branch: { kind: "named", name: "feature/parent" } } } });
  expect(automaticBase(environment, status)).toEqual({ branch: "feature/parent", source: "created" });
});
it("reads the parent of a new branch created in a project checkout", () => {
  const environment = environmentFixture({ environmentProviderSelection: { machine: { type: "existing", hostId: "host-1" }, inputs: { branch: { kind: "new", baseBranch: "release/next" } } } });
  expect(automaticBase(environment, status)).toEqual({ branch: "release/next", source: "created" });
});
it("does not mistake an existing branch selection for its parent", () => {
  const environment = environmentFixture({ environmentProviderSelection: { machine: { type: "existing", hostId: "host-1" }, inputs: { branch: { kind: "existing", name: "feature/current" } } } });
  const base = automaticBase(environment, status);
  expect(base).toEqual({ branch: "develop", source: "configured" });
  expect(automaticBaseHint(base)).toContain("Creation branch unknown");
});
it("uses a clearly labelled default when no creation or comparison branch was recorded", () => {
  const base = automaticBase(environmentFixture(), { ...status, mergeBase: null });
  expect(base).toEqual({ branch: "main", source: "default" });
  expect(automaticBaseHint(base)).toBe("Creation branch unknown · repository default: main");
});
it("tolerates untrusted provider inputs without inventing an origin", () => {
  const environment = environmentFixture({ environmentProviderId: "git-worktree", environmentProviderSelection: { machine: { type: "existing", hostId: "host-1" }, inputs: { branch: { kind: "named", name: 42 } } } });
  expect(automaticBase(environment, status)).toEqual({ branch: "develop", source: "configured" });
});
