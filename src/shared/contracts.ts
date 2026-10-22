import { defineRpcContract } from "@get-bb/plugin-sdk";
import { z } from "zod";

const oid = z.string().regex(/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/);
const workspace = z.string().min(1).max(16384);
const environmentId = z.string().min(1).max(200);
const path = z.string().min(1).max(16384).refine(value => !value.startsWith("/") && !value.includes("\0") && !value.split(/[\\/]/).includes(".."), "Expected a workspace-relative file path");
export const commitSchema = z.object({ sha: oid, shortSha: z.string(), subject: z.string(), author: z.string(), timestamp: z.number() }).strict();
export const selectionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("recent"), count: z.number().int().min(1).max(100) }).strict(),
  z.object({ kind: z.literal("commit"), sha: oid }).strict(),
]);
const fileSchema = z.object({ path: z.string(), previousPath: z.string().nullable(), additions: z.number(), deletions: z.number(), changeKind: z.enum(["added", "copied", "deleted", "modified", "renamed", "type_changed"]), binary: z.boolean(), loadMode: z.enum(["auto", "on_demand", "too_large"]), origin: z.enum(["tracked", "untracked"]) });
const historyOutput = z.object({ commits: z.array(commitSchema), hasMore: z.boolean() }).strict();
const changesOutput = z.object({ from: oid, to: oid, label: z.string(), files: z.array(fileSchema), truncated: z.boolean() }).strict();
const patchOutput = z.object({ path: z.string(), patch: z.string(), truncated: z.boolean() }).strict();
const patchInput = { from: oid, to: oid, path, previousPath: path.nullable() };
const contentsOutput = z.object({ old: z.string(), next: z.string() }).strict();
export const hostContract = defineRpcContract({
  history: { input: z.object({ workspace }).strict(), output: historyOutput },
  changes: { input: z.object({ workspace, selection: selectionSchema }).strict(), output: changesOutput },
  patch: { input: z.object({ workspace, ...patchInput }).strict(), output: patchOutput },
  contents: { input: z.object({ workspace, ...patchInput }).strict(), output: contentsOutput },
});
export const rpcContract = defineRpcContract({
  history: { input: z.object({ environmentId }).strict(), output: historyOutput },
  committedChanges: { input: z.object({ environmentId, selection: selectionSchema }).strict(), output: changesOutput },
  committedPatch: { input: z.object({ environmentId, ...patchInput }).strict(), output: patchOutput },
  committedContents: { input: z.object({ environmentId, ...patchInput }).strict(), output: contentsOutput },
});
export type Commit = z.infer<typeof commitSchema>;
export type CommitSelection = z.infer<typeof selectionSchema>;
