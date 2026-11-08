import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { fileLogSink } from "./log-file.js";

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

describe("the log file (standards §4, #655)", () => {
  it("writes main.log in the folder it's given, each line with its time and level", () => {
    const dir = mkdtempSync(join(tmpdir(), "webforge-logs-"));
    folders.push(dir);

    fileLogSink(true, dir)("warn", "export.failed code=EACCES");

    expect(readFileSync(join(dir, "main.log"), "utf8")).toMatch(
      /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\] \[warn\] +export\.failed code=EACCES\r?\n$/,
    );
  });
});
