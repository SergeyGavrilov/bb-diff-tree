import { expect, it } from "vitest";
import { readSettings, settingDescriptors } from "../../src/shared/settings";

it("uses compatible defaults and ignores invalid persisted settings", () => {
  expect(readSettings()).toEqual({ chatFileLinks: "default", fileIcons: true, smoothTransitions: true, defaultView: "unified", fontSize: 12, contextLines: 30, refreshOnReturn: true });
  expect(readSettings({ chatFileLinks: "bad", fileIcons: "false", fontSize: Infinity, contextLines: -1, defaultView: "bad" })).toEqual(readSettings());
  expect(readSettings({ chatFileLinks: "icon", fileIcons: false, smoothTransitions: false, defaultView: "split", fontSize: 16, contextLines: 10, refreshOnReturn: false })).toEqual({ chatFileLinks: "icon", fileIcons: false, smoothTransitions: false, defaultView: "split", fontSize: 16, contextLines: 10, refreshOnReturn: false });
});

it("validates number settings before BB saves them", () => {
  expect(settingDescriptors.fontSize.experimental_schema.safeParse(9).success).toBe(false);
  expect(settingDescriptors.fontSize.experimental_schema.safeParse(14.5).success).toBe(false);
  expect(settingDescriptors.fontSize.experimental_schema.safeParse(16).success).toBe(true);
  expect(settingDescriptors.contextLines.experimental_schema.safeParse(0).success).toBe(false);
  expect(settingDescriptors.contextLines.experimental_schema.safeParse(201).success).toBe(false);
});
