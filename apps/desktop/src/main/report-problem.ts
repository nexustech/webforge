import { writeFile } from "node:fs/promises";
import { release } from "node:os";
import { t } from "@webforge/i18n";
import type { IpcMain, NativeImage, WebContents } from "electron";
import { REPORT_TEXT_MAX } from "../shared/ipc/app.js";
import { registerIpcHandler } from "./ipc.js";

/**
 * Help › Report a Problem (5.23, OL-10). Webforge has no server and sends nothing: a report is
 * opened for the person to send themself, as a new issue on the repository's beta form (5.7 part
 * 1) in their browser, or, once the beta has an address (Q7), an email in their mail app. Main
 * builds the address, so the renderer names where to, never a URL. A screenshot of the editor's
 * window is taken only when the person asks, and saved as a file for them to attach.
 */

/** The repository's form for beta problems (5.7 part 1, `.github/ISSUE_TEMPLATE/beta-bug.yml`). */
export const ISSUE_FORM = "https://github.com/nexustech/webforge/issues/new";

/** The beta form's template, and its fields by id. */
const ISSUE_TEMPLATE = "beta-bug.yml";

/** Where reports are emailed: none yet, until the beta has an address (Q7). */
export const REPORT_EMAIL: string | undefined = undefined;

/** How wide the screenshot's preview is, in pixels: the dialog shows it small. */
const PREVIEW_WIDTH = 640;

/** What Report a Problem works with; fakes in tests. */
export type ReportParts = {
  readonly version: string;
  /** The computer's system, as the report gives it: "Windows 10.0.26300 (x64)". */
  readonly system: string;
  /** Where reports are emailed, if anywhere: {@link REPORT_EMAIL} unless a test gives another. */
  readonly email?: string | undefined;
  readonly openExternal: (url: string) => Promise<void>;
  /** A screenshot of the editor's window, or none when it isn't open. */
  readonly capture: () => Promise<NativeImage | undefined>;
  /** Where the person chooses to save the screenshot, or none if they cancel. */
  readonly chooseFile: () => Promise<string | undefined>;
  readonly writeFile: (path: string, data: Uint8Array) => Promise<void>;
};

/** The computer's system as a report gives it, from Node's `os`: "Windows 10.0.26300 (x64)". */
export function systemName(platform: NodeJS.Platform, release: string, arch: string): string {
  const name = platform === "win32" ? "Windows" : platform === "darwin" ? "macOS" : "Linux";
  return `${name} ${release} (${arch})`;
}

/**
 * Report a Problem's parts on this computer: its system, the editor's window to take, and the Save
 * dialog. The editor's window only: never the Help window, nor anything else on the screen.
 */
export function reportParts(
  editorWindow: () => { readonly webContents: Pick<WebContents, "capturePage"> } | undefined,
  dialogs: { chooseScreenshotToSave(): Promise<string | undefined> },
): Pick<ReportParts, "system" | "capture" | "chooseFile" | "writeFile"> {
  return {
    system: systemName(process.platform, release(), process.arch),
    capture: async () => editorWindow()?.webContents.capturePage(),
    chooseFile: () => dialogs.chooseScreenshotToSave(),
    writeFile: (path, data) => writeFile(path, data),
  };
}

/** The report's text: the person's message, then the version and the system. */
function reportBody(text: string, version: string, system: string): string {
  return `${text.trim()}\n\n${t("help.report.details", { version, system })}`;
}

/**
 * The address that opens the report: the beta form with its fields filled in, or an email. Only
 * the message, the version and the system go in it: nothing of the site, no file path, no account.
 */
export function reportAddress(
  route: "issue" | "mail",
  text: string,
  parts: Pick<ReportParts, "version" | "system" | "email">,
): string | undefined {
  const message = text.slice(0, REPORT_TEXT_MAX);
  if (route === "issue") {
    const query = new URLSearchParams({
      template: ISSUE_TEMPLATE,
      version: `${parts.version}, ${parts.system}`,
      happened: reportBody(message, parts.version, parts.system),
    });
    return `${ISSUE_FORM}?${query.toString()}`;
  }
  if (parts.email === undefined) return undefined;
  const subject = encodeURIComponent(t("help.report.subject"));
  const body = encodeURIComponent(reportBody(message, parts.version, parts.system));
  return `mailto:${parts.email}?subject=${subject}&body=${body}`;
}

/** Registers Report a Problem's calls (`app:*report*`, `app:*window-capture`). */
export function registerReportHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  parts: ReportParts,
): void {
  /** The screenshot the person took, until they save it or close the dialog. */
  let taken: NativeImage | undefined;

  registerIpcHandler(ipc, "getReportInfo", isTrustedSender, () => ({
    version: parts.version,
    system: parts.system,
    mail: parts.email !== undefined,
  }));
  registerIpcHandler(ipc, "openReport", isTrustedSender, async (route, text) => {
    const address = reportAddress(route, text, parts);
    if (address === undefined) return "unavailable";
    try {
      await parts.openExternal(address);
      return "opened";
    } catch {
      return "failed";
    }
  });
  registerIpcHandler(ipc, "captureWindow", isTrustedSender, async () => {
    try {
      const image = await parts.capture();
      if (image === undefined || image.isEmpty()) return { status: "failed" };
      taken = image;
      const { width } = image.getSize();
      const small = width > PREVIEW_WIDTH ? image.resize({ width: PREVIEW_WIDTH }) : image;
      const preview = `data:image/jpeg;base64,${small.toJPEG(80).toString("base64")}`;
      return { status: "captured", preview };
    } catch {
      return { status: "failed" };
    }
  });
  registerIpcHandler(ipc, "saveWindowCapture", isTrustedSender, async () => {
    const image = taken;
    if (image === undefined) return "none";
    const path = await parts.chooseFile();
    if (path === undefined) return "cancelled";
    try {
      await parts.writeFile(path, image.toPNG());
      return "saved";
    } catch {
      return "failed";
    }
  });
  registerIpcHandler(ipc, "discardWindowCapture", isTrustedSender, () => {
    taken = undefined;
    return null;
  });
}
