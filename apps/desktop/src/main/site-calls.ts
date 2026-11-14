import type { Net } from "electron";
import type { AppFeature } from "./app-feature.js";
import { bundleNetworkFor, resolveHost } from "./bundle-download.js";
import { registerBundleHandlers } from "./bundle-ipc.js";
import { electronBundleFetch } from "./bundle-net.js";
import type { ElementClipboard } from "./clipboard.js";
import { registerClipboardHandlers } from "./clipboard-ipc.js";
import { filePostsParts, registerPostsHandlers } from "./posts-ipc.js";
import { type ProjectDialogs, registerProjectHandlers } from "./project-ipc.js";
import type { ProjectSession } from "./project-session.js";

/** What the open site's own calls work with (#985). */
export type SiteCallsDeps = {
  readonly session: ProjectSession;
  readonly dialogs: ProjectDialogs;
  /** Damaged sites' recovery, the Recent list, and what runs before another site replaces one. */
  readonly options: Parameters<typeof registerProjectHandlers>[4];
  /** Download and bundle (3.9): the only download besides fonts, on the person's click. */
  readonly net: Pick<Net, "request">;
  readonly packaged: boolean;
  readonly clipboard: ElementClipboard;
  /** Puts text on the system clipboard (`clipboard.writeText`). */
  readonly writeText: (text: string) => void;
  /** Puts an AI app's key on the system clipboard, out of its history, for a minute (4.9). */
  readonly copySecret: (secret: string) => Promise<void>;
  /** *Import Posts…*'s dialog (6.10b). */
  readonly choosePostFiles: () => Promise<readonly string[] | undefined>;
};

/**
 * The open site's calls (#985): opening, saving and closing sites, the Recent list, copying and
 * pasting elements, downloading a file into the site, and importing posts.
 */
export function siteCallsFeature(deps: SiteCallsDeps): AppFeature {
  return {
    register(ipc, isTrustedSender) {
      registerProjectHandlers(ipc, isTrustedSender, deps.session, deps.dialogs, deps.options);
      registerBundleHandlers(
        ipc,
        isTrustedSender,
        deps.session,
        bundleNetworkFor(
          { fetch: electronBundleFetch(deps.net), resolve: resolveHost },
          deps.packaged,
        ),
      );
      registerClipboardHandlers(
        ipc,
        isTrustedSender,
        deps.clipboard,
        deps.session,
        deps.writeText,
        deps.copySecret,
      );
      registerPostsHandlers(ipc, isTrustedSender, filePostsParts(deps.choosePostFiles));
    },
  };
}
