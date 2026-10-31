import type { IpcMain } from "electron";
import type { CodeTrust } from "./code-trust.js";
import { registerIpcHandler } from "./ipc.js";
import { logFailure } from "./log.js";
import type { ProjectSession } from "./project-session.js";

/**
 * Registers the `trust` IPC calls (#649): which of the open site's code its owner trusts, and
 * trusting more of it. Only for the site open now (R6): a renderer loaded for another can't
 * vouch for this one's code.
 */
export function registerTrustHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  trust: Pick<CodeTrust, "trusted" | "trust">,
  session: Pick<ProjectSession, "staleReason" | "projectId">,
): void {
  const projectOf = (sessionId: string) => {
    const reason = session.staleReason(sessionId);
    const projectId = session.projectId();
    return reason !== undefined || projectId === undefined
      ? ({ status: "failed", reason: reason ?? "no-site" } as const)
      : projectId;
  };
  registerIpcHandler(ipc, "untrustedCode", isTrustedSender, async (sessionId, texts) => {
    const projectId = projectOf(sessionId);
    if (typeof projectId !== "string") return projectId;
    try {
      const trusted = await trust.trusted(projectId);
      const untrusted = texts.flatMap((text, index) => (trusted(text) ? [] : [index]));
      return { status: "checked", untrusted };
    } catch (error) {
      logFailure("Webforge could not read which code is trusted", error);
      return { status: "failed", reason: "unknown" };
    }
  });
  registerIpcHandler(ipc, "trustCode", isTrustedSender, async (sessionId, texts) => {
    const projectId = projectOf(sessionId);
    if (typeof projectId !== "string") return projectId;
    try {
      await trust.trust(projectId, texts);
      return { status: "trusted" };
    } catch (error) {
      logFailure("Webforge could not remember which code is trusted", error);
      return { status: "failed", reason: "unknown" };
    }
  });
}
