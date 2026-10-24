import type { EditorSession } from "../editor/editor-session.js";
import type { ImagePickRequests } from "../media/index.js";
import type { PreferencesStore } from "../shell/preferences-store.js";

/** What the app's field renderers draw from (2.20, B5). */
export type FieldRendererContext = {
  readonly session: EditorSession;
  /** The person's preferences: the colour field follows the editor level (R9). */
  readonly preferences: PreferencesStore;
  /** Requests to open the image picker from the canvas (*Edit* on an image, F-ED-25). */
  readonly imagePicks: ImagePickRequests;
};
