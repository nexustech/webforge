import type { IpcMain } from "electron";
import type { AssistantApi } from "../shared/ipc/assistant.js";
import { registerIpcHandler } from "./ipc.js";

/** What main does for the `assistant` domain (ADR 0026 §7): the panel's calls, without its events. */
export type AssistantService = Omit<AssistantApi, "onEvent">;

/** Registers the `assistant` IPC calls (6.9a, ADR 0026 §7), each answered by `service`. */
export function registerAssistantHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  service: AssistantService,
): void {
  registerIpcHandler(ipc, "assistantStatus", isTrustedSender, () => service.status());
  registerIpcHandler(ipc, "assistantSetEnabled", isTrustedSender, (enabled, version) =>
    service.setEnabled(enabled, version),
  );
  registerIpcHandler(ipc, "assistantUpdate", isTrustedSender, (settings) =>
    service.update(settings),
  );
  registerIpcHandler(ipc, "assistantSignIn", isTrustedSender, (mode) => service.signIn(mode));
  registerIpcHandler(ipc, "assistantFinishSignIn", isTrustedSender, (code) =>
    service.finishSignIn(code),
  );
  registerIpcHandler(ipc, "assistantCancelSignIn", isTrustedSender, async () => {
    await service.cancelSignIn();
    return null;
  });
  registerIpcHandler(ipc, "assistantSetKey", isTrustedSender, (key) => service.setKey(key));
  registerIpcHandler(ipc, "assistantModels", isTrustedSender, () => service.models());
  registerIpcHandler(ipc, "assistantSiteConsent", isTrustedSender, (session) =>
    service.siteConsent(session),
  );
  registerIpcHandler(ipc, "assistantSetSiteConsent", isTrustedSender, async (session, allowed) => {
    await service.setSiteConsent(session, allowed);
    return null;
  });
  registerIpcHandler(ipc, "assistantSend", isTrustedSender, (session, text, context) =>
    service.send(session, text, context),
  );
  registerIpcHandler(ipc, "assistantDraft", isTrustedSender, (session, request) =>
    service.draft(session, request),
  );
  registerIpcHandler(ipc, "assistantStop", isTrustedSender, async (replyId) => {
    await service.stop(replyId);
    return null;
  });
  registerIpcHandler(ipc, "assistantNewConversation", isTrustedSender, async (session) => {
    await service.newConversation(session);
    return null;
  });
  registerIpcHandler(ipc, "assistantConversation", isTrustedSender, (session) =>
    service.conversation(session),
  );
  registerIpcHandler(ipc, "assistantOpenLink", isTrustedSender, (session, replyId, href) =>
    service.openLink(session, replyId, href),
  );
}
