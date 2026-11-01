import { type PublishApi, publishEvents } from "../../shared/ipc/publish.js";
import type { Call, Subscribe } from "./call.js";

/** `window.webforge.publish`. */
export const publishApi = (call: Call, subscribe: Subscribe): PublishApi => ({
  testConnection: (destination, signIn, trust) =>
    call("publishTestConnection", destination, signIn, trust),
  readHostKey: (host, port) => call("publishReadHostKey", host, port),
  chooseKeyFile: () => call("publishChooseKeyFile"),
  destinations: (sessionId) => call("publishDestinations", sessionId),
  saveDestination: (sessionId, draft, signIn, trust) =>
    call("publishSaveDestination", sessionId, draft, signIn, trust),
  removeDestination: (sessionId, id) => call("publishRemoveDestination", sessionId, id),
  testSavedDestination: (sessionId, id, settings, trust) =>
    call("publishTestSavedDestination", sessionId, id, settings, trust),
  publish: (sessionId, destinationId, operationId, options) =>
    call("publishSite", sessionId, destinationId, operationId, options),
  cancel: (operationId) => call("publishCancel", operationId),
  onProgress: (listener) =>
    subscribe(publishEvents.progress.channel, (...args) => {
      const parsed = publishEvents.progress.args.safeParse(args);
      if (parsed.success) listener(...parsed.data);
    }),
});
