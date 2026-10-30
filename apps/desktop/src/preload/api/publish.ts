import type { PublishApi } from "../../shared/ipc/publish.js";
import type { Call } from "./call.js";

/** `window.webforge.publish`. */
export const publishApi = (call: Call): PublishApi => ({
  testConnection: (destination, signIn) => call("publishTestConnection", destination, signIn),
  readHostKey: (host, port) => call("publishReadHostKey", host, port),
  chooseKeyFile: () => call("publishChooseKeyFile"),
});
