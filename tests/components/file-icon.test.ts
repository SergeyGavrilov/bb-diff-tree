import { expect, it } from "vitest";
import { fileIcon } from "../../src/app/components/file-icon";

it("resolves basenames, extension case and special filenames with a generic fallback", () => {
  expect(fileIcon("src/main.PY")).toEqual(fileIcon("main.py"));
  expect(fileIcon("src\\main.py")).toEqual(fileIcon("main.py"));
  expect(fileIcon("main.py").svg).not.toBe(fileIcon("unknown.extension").svg);
  expect(fileIcon("src/Dockerfile").svg).not.toBe(fileIcon("unknown.extension").svg);
  expect(fileIcon("tsconfig.json").svg).not.toBe(fileIcon("data.json").svg);
  expect(fileIcon("README.md")).toEqual(fileIcon("docs/README.md"));
  expect(fileIcon("<img src=x onerror=alert(1)>")).toEqual(fileIcon("unknown.extension"));
});
