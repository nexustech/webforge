import type { PostsApi } from "../../shared/ipc/posts.js";
import type { Call } from "./call.js";

/** `window.webforge.posts`. */
export const postsApi = (call: Call): PostsApi => ({
  chooseFiles: () => call("postsChooseFiles"),
});
