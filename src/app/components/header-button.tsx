import { useEffect, useRef, useState } from "react";
import { experimental_Icon as Icon, useBbNavigate, useSdk } from "@get-bb/plugin-sdk/app";
import { usePreferences } from "../hooks/use-preferences";
import { registerChatLinks } from "../chat-file-links";
import { requestFile } from "../file-navigation";

export function HeaderButton({ threadId }: { threadId: string }) {
  const navigate = useBbNavigate();
  const sdk = useSdk();
  const { chatFileLinks, loading } = usePreferences();
  const button = useRef<HTMLButtonElement>(null);
  const [workspace, setWorkspace] = useState<{ threadId: string; path: string }>();
  useEffect(() => {
    if (loading || chatFileLinks === "default") return;
    const controller = new AbortController();
    const signal = controller.signal;
    (async () => {
      const thread = await sdk.threads.get({ threadId, signal });
      if (!thread.environmentId) return;
      const environment = await sdk.environments.get({ environmentId: thread.environmentId, signal });
      if (!signal.aborted && environment.isGitRepo && environment.path) setWorkspace({ threadId, path: environment.path });
    })().catch(() => { /* Missing/unavailable workspace leaves BB's links intact. */ });
    return () => controller.abort();
  }, [threadId, sdk, chatFileLinks, loading]);
  useEffect(() => {
    if (!button.current || loading || chatFileLinks === "default" || workspace?.threadId !== threadId) return;
    return registerChatLinks({ element: button.current, workspace: workspace.path, mode: chatFileLinks, open: path => {
      if (!navigate.openThreadPanel({ actionId: "changes", title: "Diff Tree" })) return false;
      requestFile(threadId, path);
      return true;
    } });
  }, [workspace, threadId, chatFileLinks, loading, navigate]);
  return <button ref={button} type="button" className="dt-launch" aria-label="Open Diff Tree" title="Diff Tree — browse changes by folder" onClick={() => navigate.openThreadPanel({ actionId: "changes", title: "Diff Tree" })}><Icon name="GitBranch" className="dt-icon" /></button>;
}
