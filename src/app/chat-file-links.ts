import type { ChatFileLinks } from "../shared/settings";
import { clearFileRequests } from "./file-navigation";
import { chatFileControlSelector, chatFilePath } from "./chat-file-controls";
import type { ChatFileControl } from "./chat-file-controls";

interface ChatLinkOwner {
  element: HTMLElement;
  workspace: string;
  mode: Exclude<ChatFileLinks, "default">;
  open(path: string): boolean;
}
const owners = new Set<ChatLinkOwner>();
const ownerListeners = new Set<() => void>();
export function registerChatLinks(owner: ChatLinkOwner) {
  owners.add(owner);
  ownerListeners.forEach(listener => listener());
  return () => { owners.delete(owner); ownerListeners.forEach(listener => listener()); };
}

function ownsLink(owner: ChatLinkOwner, anchor: Element) {
  if (!owner.element.isConnected || !anchor.closest("[data-message-column]") || anchor.closest(".dt-root")) return false;
  const pane = anchor.closest("[data-split-pane-id]");
  const ownerPane = owner.element.closest("[data-split-pane-id]");
  if (pane || ownerPane) return pane !== null && pane === ownerPane;
  // Single-pane clients: the nearest common message/header container. Never
  // guess a target if more than one thread header shares that container.
  let container = owner.element.parentElement;
  while (container && !container.querySelector("[data-message-column]")) container = container.parentElement;
  return !!container?.contains(anchor) && [...owners].filter(item => container.contains(item.element)).length === 1;
}

export function mountChatFileLinks() {
  const buttons = new Map<ChatFileControl, HTMLButtonElement>();
  let disposed = false, pending = false;
  const match = (anchor: ChatFileControl) => {
    for (const owner of owners) {
      if (!ownsLink(owner, anchor)) continue;
      const path = chatFilePath(anchor, owner.workspace);
      if (path) return { owner, path };
    }
    return null;
  };
  const removeButtons = () => { buttons.forEach(button => button.remove()); buttons.clear(); };
  const open = (target: ReturnType<typeof match>) => {
    try { return target?.owner.open(target.path) ?? false; }
    catch { return false; } // A failed adapter must leave the original link usable.
  };
  const scan = () => {
    pending = false;
    if (disposed) return;
    for (const [anchor, button] of buttons) {
      if (!anchor.isConnected || match(anchor)?.owner.mode !== "icon") { button.remove(); buttons.delete(anchor); }
    }
    for (const anchor of Array.from(document.querySelectorAll<ChatFileControl>(chatFileControlSelector))) {
      if (match(anchor)?.owner.mode !== "icon" || buttons.has(anchor)) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dt-chat-open";
      button.title = "Open in Diff Tree";
      button.setAttribute("aria-label", "Open in Diff Tree");
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
      const path = document.createElementNS(svg.namespaceURI, "path");
      path.setAttribute("d", "M6 3v12a4 4 0 0 0 4 4h8M6 9h8a4 4 0 0 0 4-4V3M3 3h6M15 3h6M15 19h6");
      svg.append(path); button.append(svg);
      // Resolve again on click: streamed messages can replace a file target.
      button.onclick = event => {
        const target = match(anchor);
        event.preventDefault(); event.stopPropagation();
        if (!open(target)) anchor.click();
      };
      anchor.after(button); buttons.set(anchor, button);
    }
  };
  const schedule = () => { if (!pending && !disposed) { pending = true; queueMicrotask(scan); } };
  const observer = new MutationObserver(schedule);
  const update = () => {
    observer.disconnect();
    if (owners.size) { observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["href", "title", "aria-label", "disabled"] }); schedule(); }
    else removeButtons();
  };
  const click = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest<ChatFileControl>(chatFileControlSelector) : null;
    if (!anchor) return;
    const target = match(anchor);
    if (target?.owner.mode === "diff-tree" && open(target)) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  };
  ownerListeners.add(update);
  document.addEventListener("click", click, true);
  update();
  return () => {
    disposed = true; observer.disconnect(); ownerListeners.delete(update);
    document.removeEventListener("click", click, true); removeButtons(); clearFileRequests();
  };
}
