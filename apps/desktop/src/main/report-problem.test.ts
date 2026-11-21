import { t } from "@webforge/i18n";
import type { IpcMainInvokeEvent, NativeImage } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ISSUE_FORM,
  type ReportParts,
  registerReportHandlers,
  reportAddress,
  systemName,
} from "./report-problem.js";

const PARTS = { version: "0.3.0", system: "Windows 10.0.26300 (x64)" } as const;

/** A stand-in for Electron's screenshot of the window. */
function image(width = 1600): NativeImage {
  const small = {
    toJPEG: () => Buffer.from("jpeg"),
    getSize: () => ({ width: 640, height: 360 }),
  };
  return {
    isEmpty: () => false,
    getSize: () => ({ width, height: 900 }),
    resize: vi.fn(() => small),
    toJPEG: () => Buffer.from("jpeg"),
    toPNG: () => Buffer.from("png"),
  } as unknown as NativeImage;
}

function setUp(changes: Partial<ReportParts> = {}) {
  const handlers = new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>();
  const parts: ReportParts = {
    ...PARTS,
    openExternal: vi.fn(async () => undefined),
    capture: async () => image(),
    chooseFile: async () => "C:/Users/rosa/Desktop/screenshot.png",
    writeFile: vi.fn(async () => undefined),
    ...changes,
  };
  registerReportHandlers(
    { handle: (channel, handler) => handlers.set(channel, handler) },
    () => true,
    parts,
  );
  const invoke = (channel: string, ...args: unknown[]) =>
    handlers.get(channel)?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent, ...args);
  return { parts, invoke };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Report a Problem (5.23, OL-10)", () => {
  it("names the system as a report gives it", () => {
    expect(systemName("win32", "10.0.26300", "x64")).toBe("Windows 10.0.26300 (x64)");
    expect(systemName("darwin", "25.1.0", "arm64")).toBe("macOS 25.1.0 (arm64)");
    expect(systemName("linux", "6.8.0", "x64")).toBe("Linux 6.8.0 (x64)");
  });

  it("opens the beta form with the message, the version and the system, and nothing else", () => {
    const address = reportAddress("issue", "The menu won't open", PARTS);
    expect(address?.startsWith(`${ISSUE_FORM}?`)).toBe(true);
    const query = new URL(address ?? "").searchParams;
    expect(query.get("template")).toBe("beta-bug.yml");
    expect(query.get("version")).toBe("0.3.0, Windows 10.0.26300 (x64)");
    expect(query.get("happened")).toBe(
      `The menu won't open\n\n${t("help.report.details", { version: "0.3.0", system: PARTS.system })}`,
    );
    expect([...query.keys()]).toEqual(["template", "version", "happened"]);
  });

  it("emails the report only once there's an address to send it to", () => {
    expect(reportAddress("mail", "Hello", PARTS)).toBeUndefined();
    const mail = reportAddress("mail", "Hello & more", { ...PARTS, email: "beta@example.com" });
    expect(mail?.startsWith("mailto:beta@example.com?subject=")).toBe(true);
    expect(decodeURIComponent(mail?.split("&body=")[1] ?? "")).toContain("Hello & more");
  });

  it("hands the address to the browser and makes no request itself", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { parts, invoke } = setUp();

    expect(await invoke("app:open-report", "issue", "It froze")).toBe("opened");
    expect(parts.openExternal).toHaveBeenCalledOnce();
    expect(await invoke("app:open-report", "mail", "It froze")).toBe("unavailable");
    expect(fetch).not.toHaveBeenCalled();
    expect(await invoke("app:get-report-info")).toEqual({ ...PARTS, mail: false });

    const failing = setUp({ openExternal: async () => Promise.reject(new Error("no browser")) });
    expect(await failing.invoke("app:open-report", "issue", "It froze")).toBe("failed");
  });

  it("takes the window's screenshot when asked, shows it small, and saves it as PNG", async () => {
    const { parts, invoke } = setUp();
    expect(await invoke("app:save-window-capture")).toBe("none");

    const taken = (await invoke("app:capture-window")) as { status: string; preview: string };
    expect(taken.status).toBe("captured");
    expect(taken.preview.startsWith("data:image/jpeg;base64,")).toBe(true);

    expect(await invoke("app:save-window-capture")).toBe("saved");
    expect(parts.writeFile).toHaveBeenCalledWith(
      "C:/Users/rosa/Desktop/screenshot.png",
      Buffer.from("png"),
    );
    // Forgotten when the dialog closes: nothing more to save.
    await invoke("app:discard-window-capture");
    expect(await invoke("app:save-window-capture")).toBe("none");
  });

  it("says when there's no window to take, or the person cancels saving", async () => {
    const none = setUp({ capture: async () => undefined });
    expect(await none.invoke("app:capture-window")).toEqual({ status: "failed" });

    const cancelled = setUp({ chooseFile: async () => undefined });
    await cancelled.invoke("app:capture-window");
    expect(await cancelled.invoke("app:save-window-capture")).toBe("cancelled");
    expect(cancelled.parts.writeFile).not.toHaveBeenCalled();
  });
});
