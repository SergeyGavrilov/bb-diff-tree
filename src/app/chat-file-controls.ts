export type ChatFileControl = HTMLAnchorElement | HTMLButtonElement;

export const chatFileControlSelector = '[data-message-column] a[href], [data-message-column] ul[aria-label="Changed files"] > li > div > button[title][aria-label]';

// GenUI 0.1.0 Changes/Commits uses an Open button beside an expandable
// filename, rather than a semantic anchor. Match its accessible structure and
// confirm the full path against the adjacent filename; never guess from text.
// Source: ComicBit/bb-plugin-genui, ui/components/changes.tsx (FileRow).
function changesButtonPath(button: HTMLButtonElement): string | null {
  if (button.classList.contains("dt-chat-open") || button.disabled) return null;
  const label = button.getAttribute("aria-label");
  if (!label?.startsWith("Open ") || button.title !== label) return null;
  const row = button.parentElement;
  if (!row?.parentElement?.matches('ul[aria-label="Changed files"] > li')) return null;
  const path = label.slice(5);
  const expander = Array.from(row.children).find(child => child.matches("button[aria-controls][aria-expanded]"));
  if (!expander || !Array.from(expander.querySelectorAll("span[title]")).some(span => span.getAttribute("title") === path)) return null;
  if (!path || path.startsWith("/") || /^[A-Za-z]:|^[a-z][a-z\d+.-]*:/i.test(path) || /[\u0000-\u001f\u007f]/u.test(path)) return null;
  if (path.split(/[\\/]/).some(part => !part || part === "." || part === "..")) return null;
  return path;
}

export function workspaceLink(href: string, workspace: string): string | null {
  try {
    const url = new URL(href);
    if (url.protocol !== "file:" || url.host || url.search || url.pathname.endsWith("/")) return null;
    const normalize = (path: string) => {
      const parts: string[] = [];
      for (const part of path.replace(/\\/g, "/").split("/")) {
        if (part === "..") parts.pop();
        else if (part && part !== ".") parts.push(part);
      }
      return parts.join("/");
    };
    const path = normalize(decodeURIComponent(url.pathname));
    const root = normalize(workspace);
    if (!root || !path.startsWith(`${root}/`) || /[\u0000-\u001f\u007f]/u.test(path)) return null;
    return path.slice(root.length + 1) || null;
  } catch { return null; }
}

export function chatFilePath(control: ChatFileControl, workspace: string) {
  return control instanceof HTMLAnchorElement
    ? workspaceLink(control.getAttribute("href") ?? "", workspace)
    : changesButtonPath(control);
}
