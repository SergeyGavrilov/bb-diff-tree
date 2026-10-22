import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import type { SelectedLineRange } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { experimental_Diff as NativeDiff, experimental_useCodeTheme, useComposer } from "@get-bb/plugin-sdk/app";
import { ActionIcon } from "./action-icon";
import { selectedDiffQuote } from "../../core/diff-selection";
import { contextualDiff } from "../../core/diff-context";
import type { DiffContents } from "../../core/diff-context";

export function InteractiveDiff({ patch, path, oldPath, revision, view, contents, contextError }: { patch: string; path: string; oldPath?: string; revision: string; view: "split" | "unified"; contents?: DiffContents; contextError?: string }) {
  const { file, error: hydrationError } = useMemo(() => contextualDiff(patch, contents), [patch, contents]);
  const composer = useComposer();
  const codeTheme = experimental_useCodeTheme();
  const root = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 60, y: 8 });
  const [range, setRange] = useState<SelectedLineRange | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const clear = useCallback(() => { setRange(null); setMenu(null); setError(""); setFeedback(""); }, []);
  useEffect(() => { clear(); }, [patch, path, revision, view, clear]);
  useEffect(() => {
    const dismiss = (event: globalThis.PointerEvent) => { if (!root.current?.contains(event.target as Node)) clear(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") clear(); };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [clear]);
  const capture = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest?.("[data-quote-action]")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const viewport = event.currentTarget.parentElement?.getBoundingClientRect();
    pointer.current = { x: Math.max(4, Math.min(event.clientX - rect.left + 12, rect.width - 165)), y: Math.max(0, event.clientY - rect.top + (viewport && event.clientY > viewport.bottom - 48 ? -42 : 8)) };
  };
  const show = useCallback((selected: SelectedLineRange | null) => {
    setRange(selected); setError(""); setFeedback("");
    setMenu(selected ? { ...pointer.current } : null);
  }, []);
  const startSelection = useCallback((selected: SelectedLineRange | null) => { setRange(selected); setMenu(null); setFeedback(""); }, []);
  const themeName = codeTheme.theme?.name ?? codeTheme.name;
  const options = useMemo(() => ({
    diffStyle: view, overflow: "scroll" as const, disableFileHeader: true, disableLineNumbers: false,
    theme: themeName, themeType: codeTheme.mode,
    enableLineSelection: true, enableGutterUtility: true, lineHoverHighlight: "number" as const,
    hunkSeparators: "line-info" as const, expansionLineCount: 30,
    onLineSelectionStart: startSelection, onLineSelectionChange: setRange, onLineSelectionEnd: show, onGutterUtilityClick: show,
  }), [view, themeName, codeTheme.mode, startSelection, show]);
  const add = () => {
    if (!file || !range) return;
    try {
      composer.insert(selectedDiffQuote(file, range, view, path, oldPath ?? path, revision), { at: "end", block: true });
      clear(); setFeedback("Added to draft"); composer.focus();
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  if (!file || !file.hunks.length) return <NativeDiff patch={patch} path={path} view={view} />;
  return <div className="dt-interactive-diff" ref={root} onPointerDownCapture={capture} onPointerMoveCapture={capture} onPointerUpCapture={capture} style={{ "--diffs-font-size": "12px", "--diffs-line-height": "18px" } as CSSProperties}>
    {(contextError || hydrationError) && <div className="dt-context" role="status">Unchanged lines unavailable: {contextError || hydrationError}</div>}
    <FileDiff fileDiff={file} selectedLines={range} options={options} />
    {menu && range && <div className="dt-line-menu" data-quote-action="" style={{ left: menu.x, top: menu.y }}>
      <button type="button" className="dt-action dt-text-action" onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.preventDefault()} onClick={add}><ActionIcon kind="quote" />Add to chat</button>
      {error && <span role="alert" className="dt-error">{error}</span>}
    </div>}
    {feedback && <span role="status" className="dt-line-feedback">{feedback}</span>}
  </div>;
}
