import type { PublishApi } from "../../shared/ipc/publish.js";
import type { Call } from "./call.js";

/** `window.webforge.publish`. */
export const publishApi = (call: Call): PublishApi => ({
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
});
