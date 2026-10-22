import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { mountChatFileLinks, registerChatLinks } from "../../src/app/chat-file-links";
import { workspaceLink } from "../../src/app/chat-file-controls";
import { changesRow } from "../fixtures/chat-changes";

const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.reverse().splice(0).forEach(fn => fn()); document.body.replaceChildren(); });
function pane(id = "one") {
  const root = document.createElement("section"); root.dataset.splitPaneId = id;
  const header = document.createElement("button"); root.append(header);
  const message = document.createElement("p"); message.dataset.messageColumn = "";
  const anchor = document.createElement("a"); anchor.href = "file:///work/repo/src/a.ts#L4-L8"; anchor.textContent = "a.ts"; anchor.target = "_blank";
  message.append(anchor); root.append(message); document.body.append(root);
  return { root, header, message, anchor };
}
function enable(item: ReturnType<typeof pane>, mode: "icon" | "diff-tree", open = vi.fn(() => true)) {
  cleanups.push(registerChatLinks({ element: item.header, workspace: "/work/repo", mode, open }));
  return open;
}

describe("chat link adapter", () => {
  it.each(["icon", "diff-tree"] as const)("supports the Changes card's Open buttons in %s mode without changing the row expander", async mode => {
    const item = pane(); item.anchor.remove();
    const nativeOpen = vi.fn(), expand = vi.fn();
    const card = changesRow(item.message, "src/a.ts", nativeOpen);
    card.expander.addEventListener("click", expand);
    const open = enable(item, mode); cleanups.push(mountChatFileLinks());
    fireEvent.click(card.filename); expect(expand).toHaveBeenCalledOnce(); expect(open).not.toHaveBeenCalled();
    if (mode === "icon") {
      await waitFor(() => expect(card.row.querySelector(".dt-chat-open")).toBeTruthy());
      fireEvent.click(card.icon); expect(nativeOpen).toHaveBeenCalledOnce(); expect(open).not.toHaveBeenCalled();
      fireEvent.click(card.row.querySelector(".dt-chat-open")!);
    } else {
      expect(fireEvent.click(card.icon)).toBe(false); expect(nativeOpen).not.toHaveBeenCalled();
      fireEvent.click(card.button, { metaKey: true }); expect(nativeOpen).toHaveBeenCalledOnce();
    }
    expect(open).toHaveBeenCalledExactlyOnceWith("src/a.ts");
    const streamed = changesRow(item.message, "docs/with spaces, and commas.md");
    if (mode === "icon") {
      await waitFor(() => expect(streamed.row.querySelector(".dt-chat-open")).toBeTruthy());
      fireEvent.click(streamed.row.querySelector(".dt-chat-open")!);
    } else fireEvent.click(streamed.icon);
    expect(open).toHaveBeenLastCalledWith("docs/with spaces, and commas.md");
    streamed.row.remove();
    await waitFor(() => expect(item.message.querySelectorAll(".dt-chat-open")).toHaveLength(mode === "icon" ? 1 : 0));
  });

  it("leaves unrelated buttons intact and validates Changes row paths", async () => {
    const item = pane(); item.anchor.remove();
    const open = enable(item, "icon"); cleanups.push(mountChatFileLinks());
    const unrelated = document.createElement("button"); unrelated.title = "Open src/a.ts"; unrelated.setAttribute("aria-label", unrelated.title); item.message.append(unrelated);
    const unsafe = changesRow(item.message, "../other/project.ts");
    const mismatch = changesRow(item.message, "src/a.ts"); mismatch.filename.title = "src/b.ts";
    const disabled = changesRow(item.message, "src/disabled.ts"); disabled.button.disabled = true;
    await Promise.resolve();
    expect(item.message.querySelector(".dt-chat-open")).toBeNull();
    fireEvent.click(unrelated); fireEvent.click(unsafe.icon); fireEvent.click(mismatch.icon);
    expect(open).not.toHaveBeenCalled();
  });

  it("preserves Changes buttons when the host declines and removes card icons on teardown", async () => {
    const item = pane(); item.anchor.remove(); const nativeOpen = vi.fn();
    const card = changesRow(item.message, "a.ts", nativeOpen);
    const stopOwner = registerChatLinks({ element: item.header, workspace: "/work/repo", mode: "diff-tree", open: () => false }); cleanups.push(stopOwner);
    const stop = mountChatFileLinks(); cleanups.push(stop);
    expect(fireEvent.click(card.icon)).toBe(true); expect(nativeOpen).toHaveBeenCalledOnce();
    stopOwner(); enable(item, "icon", vi.fn(() => false));
    await waitFor(() => expect(card.row.querySelector(".dt-chat-open")).toBeTruthy());
    fireEvent.click(card.row.querySelector(".dt-chat-open")!); expect(nativeOpen).toHaveBeenCalledTimes(2);
    stop(); expect(card.row.querySelector(".dt-chat-open")).toBeNull();
    fireEvent.click(card.icon); expect(nativeOpen).toHaveBeenCalledTimes(3);
  });

  it("decodes workspace paths and rejects unrelated or malformed targets", () => {
    expect(workspaceLink("file:///work/repo/src/a%20b.py#L3", "/work/repo/")).toBe("src/a b.py");
    expect(workspaceLink("file:///C:/work/repo/a.ts", "C:\\work\\repo")).toBe("a.ts");
    for (const href of ["https://example.com/a.ts", "file://other/work/repo/a.ts", "file:///work/repo-other/a.ts", "file:///work/repo/../secret", "file:///work/repo/%2e%2e/secret", "file:///work/repo/a%00.ts", "file:///work/repo/bad%ZZ", "file:///work/repo/a.ts?ref=abc"]) {
      expect(workspaceLink(href, "/work/repo"), href).toBeNull();
    }
  });

  it("leaves default behavior intact with no enabled owners", async () => {
    const item = pane(); cleanups.push(mountChatFileLinks());
    expect(fireEvent.click(item.anchor)).toBe(true);
    await Promise.resolve();
    expect(document.querySelector(".dt-chat-open")).toBeNull();
  });

  it("adds accessible sibling buttons to existing and streamed links, preserving the original click", async () => {
    const item = pane(); const open = enable(item, "icon"); cleanups.push(mountChatFileLinks());
    await waitFor(() => expect(item.message.querySelector("button")).toBeTruthy());
    expect(fireEvent.click(item.anchor)).toBe(true); expect(open).not.toHaveBeenCalled();
    fireEvent.click(item.message.querySelector("button")!); expect(open).toHaveBeenCalledWith("src/a.ts");
    const next = item.anchor.cloneNode(true) as HTMLAnchorElement; next.href = "file:///work/repo/b.py"; item.message.append(next);
    await waitFor(() => expect(item.message.querySelectorAll("button")).toHaveLength(2));
    next.href = "https://example.com";
    await waitFor(() => expect(item.message.querySelectorAll("button")).toHaveLength(1));
    expect(item.message.querySelector("button")?.getAttribute("aria-label")).toBe("Open in Diff Tree");
  });

  it("routes ordinary clicks only in the owning split pane, falling back when the host declines", () => {
    const first = pane("one"), second = pane("two");
    const openFirst = enable(first, "diff-tree"), openSecond = enable(second, "diff-tree", vi.fn(() => false));
    cleanups.push(mountChatFileLinks());
    expect(fireEvent.click(first.anchor)).toBe(false);
    expect(openFirst).toHaveBeenCalledExactlyOnceWith("src/a.ts"); expect(openSecond).not.toHaveBeenCalled();
    expect(fireEvent.click(second.anchor)).toBe(true); expect(openSecond).toHaveBeenCalledOnce();
    for (const modifiers of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) expect(fireEvent.click(first.anchor, modifiers)).toBe(true);
    expect(openFirst).toHaveBeenCalledOnce();
    first.anchor.href = "file:///work/elsewhere/a.ts";
    expect(fireEvent.click(first.anchor)).toBe(true);
  });

  it("disposes decorations and listeners, including across settings changes", async () => {
    const item = pane(); const stopOwner = registerChatLinks({ element: item.header, workspace: "/work/repo", mode: "icon", open: () => true });
    cleanups.push(stopOwner);
    const stop = mountChatFileLinks(); cleanups.push(stop);
    await waitFor(() => expect(item.message.querySelector("button")).toBeTruthy());
    stopOwner(); expect(item.message.querySelector("button")).toBeNull();
    const open = enable(item, "diff-tree");
    expect(fireEvent.click(item.anchor)).toBe(false);
    stop(); expect(fireEvent.click(item.anchor)).toBe(true); expect(open).toHaveBeenCalledOnce();
  });
});
