import type { PublishApi } from "../../shared/ipc/publish.js";
import type { Call } from "./call.js";

/** `window.webforge.publish`. */
export const publishApi = (call: Call): PublishApi => ({
  testConnection: (destination, signIn, trust) =>
    call("publishTestConnection", destination, signIn, trust),
  readHostKey: (host, port) => call("publishReadHostKey", host, port),
  chooseKeyFile: () => call("publishChooseKeyFile"),
});
