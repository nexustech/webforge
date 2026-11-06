import { t } from "@webforge/i18n";
import { type PublishDestination, webAddressSchema } from "@webforge/model";
import type { EditorSession } from "../editor/editor-session.js";

/**
 * The web address Site Settings can take from `destination` (4.4a): the address its site is
 * visited at, when that is a whole site's (`https://www.example.com/`), as Site Settings keeps it,
 * without the slash. None for a site in a folder of its host (`/shop/`), which Site Settings
 * can't say.
 */
export function webAddressFrom(destination: PublishDestination): string | undefined {
  const url = destination.kind === "file-transfer" ? destination.settings.url : destination.url;
  if (url === undefined) return undefined;
  const parsed = new URL(url);
  if (parsed.pathname !== "/" || parsed.search !== "" || parsed.hash !== "") return undefined;
  return webAddressSchema.safeParse(parsed.origin).success ? parsed.origin : undefined;
}

/**
 * Fills Site Settings' web address from `destination`, if the site has none yet (4.4a, F-PB-1):
 * one undo step, so the person can take it back. Whether it did.
 */
export function fillWebAddress(
  session: Pick<EditorSession, "edit"> & {
    readonly history: Pick<EditorSession["history"], "document">;
  },
  destination: PublishDestination,
): boolean {
  const address = webAddressFrom(destination);
  const current = session.history.document.getState().settings.address.url;
  if (address === undefined || (current ?? "") !== "") return false;
  session.edit("props", t("publish.destinations.addressStep"), (draft) => {
    draft.settings.address.url = address;
  });
  return true;
}
