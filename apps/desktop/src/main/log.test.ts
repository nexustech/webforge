import { afterEach, describe, expect, it, vi } from "vitest";
import { type LogLevel, log, logFailure, logLine, setLogSink } from "./log.js";

const lines: [LogLevel, string][] = [];

afterEach(() => {
  lines.length = 0;
  setLogSink();
});

function capture(): void {
  setLogSink((level, line) => {
    lines.push([level, line]);
  });
}

describe("log (standards §4)", () => {
  it("writes the event with its codes and counts, at its level", () => {
    capture();

    log.error("Webforge could not save the site", { code: "SQLITE_BUSY", tries: 3, read: false });
    log.warn("Webforge refused IPC call", { channel: "project:commit" });
    log.info("Webforge started");

    expect(lines).toEqual([
      ["error", "Webforge could not save the site (code=SQLITE_BUSY, tries=3, read=false)"],
      ["warn", "Webforge refused IPC call (channel=project:commit)"],
      ["info", "Webforge started"],
    ]);
  });

  it("never writes a path, site content or a URL", () => {
    const leaks = [
      "C:\\Users\\Ana\\Documents\\Bakery.wforge",
      "/home/ana/sites/Bakery.wforge",
      "Fresh bread daily, open from 7",
      "https://api.netlify.com/sites?token=abc",
      "a".repeat(81),
      "two words here",
      // Personal data: an e-mail address, as a site's contact details or a sign-in hold one.
      "jane@example.com",
    ];

    for (const leak of leaks) {
      expect(logLine("Webforge could not open a site", { detail: leak })).toBe(
        "Webforge could not open a site (detail=[redacted])",
      );
    }
    // An error's name and code keep their one space.
    expect(logLine("Failed", { code: "ProjectFileError corrupt" })).toBe(
      "Failed (code=ProjectFileError corrupt)",
    );
  });

  it("logs a failure's name and code, never its message", () => {
    capture();
    const error = Object.assign(new Error("EACCES: permission denied, open '/home/ana/x'"), {
      code: "EACCES",
    });

    logFailure("Webforge could not back up the site", error, { attempt: 2 });

    expect(lines).toEqual([
      ["error", "Webforge could not back up the site (attempt=2, code=Error EACCES)"],
    ]);
  });

  it("writes to the console until the app sets its log file", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    log.error("Webforge failed to start", { code: "TypeError" });

    expect(error).toHaveBeenCalledWith("Webforge failed to start (code=TypeError)");
    error.mockRestore();
  });
});
