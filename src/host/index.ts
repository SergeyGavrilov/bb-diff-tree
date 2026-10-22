import { experimental_defineHostEntry } from "@get-bb/plugin-sdk";
import { hostContract } from "../shared/contracts";
import { history, committedChanges, committedPatch, committedContents } from "./git-history";

export default experimental_defineHostEntry({
  contract: hostContract,
  handlers: {
    history: ({ workspace }, context) => history(workspace, context.signal),
    changes: ({ workspace, selection }, context) => committedChanges(workspace, selection, context.signal),
    patch: ({ workspace, ...input }, context) => committedPatch(workspace, input, context.signal),
    contents: ({ workspace, ...input }, context) => committedContents(workspace, input, context.signal),
  },
});
