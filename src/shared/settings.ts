import type { PluginSettingDescriptors } from "@get-bb/plugin-sdk";
import { z } from "zod";

export const settingDescriptors = {
  chatFileLinks: {
    type: "select", label: "File links in chat", default: "default",
    options: ["default", "icon", "diff-tree"],
    experimental_optionLabels: { default: "BB default", icon: "Show a Diff Tree button beside links", "diff-tree": "Open in Diff Tree" },
    description: "Applies to workspace file links and Open buttons in chat Changes cards. Modified clicks keep BB behavior. Files outside this workspace are unaffected.",
  },
  fileIcons: { type: "boolean", label: "Show file type icons", default: true },
  smoothTransitions: {
    type: "boolean", label: "Smooth diff transitions", default: true,
    description: "Show a quiet skeleton instead of loading text and fade in the diff. Respects reduced-motion preferences. Disable for immediate transitions with loading text.",
  },
  defaultView: {
    type: "select", label: "Default diff layout", options: ["unified", "split"], default: "unified",
    experimental_optionLabels: { unified: "Unified", split: "Split" },
    description: "The initial layout when opening a viewer. You can still switch it in the toolbar.",
  },
  fontSize: {
    type: "number", label: "Code font size (px)", default: 12,
    experimental_schema: z.number().int().min(10).max(24),
    description: "An integer from 10 to 24.",
  },
  contextLines: {
    type: "number", label: "Unchanged lines per expansion", default: 30,
    experimental_schema: z.number().int().min(1).max(200),
    description: "An integer from 1 to 200. Expand all remains available.",
  },
  refreshOnReturn: { type: "boolean", label: "Refresh when returning to BB", default: true },
} satisfies PluginSettingDescriptors;

export type ChatFileLinks = "default" | "icon" | "diff-tree";
export function readSettings(values: Record<string, unknown> = {}) {
  const integer = (value: unknown, min: number, max: number, fallback: number) =>
    typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : fallback;
  return {
    chatFileLinks: (["default", "icon", "diff-tree"].includes(String(values.chatFileLinks)) ? values.chatFileLinks : "default") as ChatFileLinks,
    fileIcons: typeof values.fileIcons === "boolean" ? values.fileIcons : true,
    smoothTransitions: typeof values.smoothTransitions === "boolean" ? values.smoothTransitions : true,
    defaultView: values.defaultView === "split" ? "split" as const : "unified" as const,
    fontSize: integer(values.fontSize, 10, 24, 12),
    contextLines: integer(values.contextLines, 1, 200, 30),
    refreshOnReturn: typeof values.refreshOnReturn === "boolean" ? values.refreshOnReturn : true,
  };
}
