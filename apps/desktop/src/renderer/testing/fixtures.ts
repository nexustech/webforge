import type { PageId, SiteDoc } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { createEditorSession, type EditorSession } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import { type CommandRegistry, createCommandRegistry } from "../shell/commands.js";
import {
  type ContextualToolbarRegistry,
  createContextualToolbars,
} from "../shell/contextual-toolbars.js";
import { createPanelRegistry, type PanelRegistry } from "../shell/panels.js";
import { createPreferencesStore, type PreferencesStore } from "../shell/preferences-store.js";

/**
 * The renderer's own fixtures (2.20, B6), for tests and stories in every area: an editor session
 * and the registries an area registers into. The fake canvas engine is in
 * `@webforge/test-utils/renderer`; a fake preload API in `./preload.ts` (tests only).
 */

/**
 * An editor session on `site` (a new site's starter page by default), with the site library, on
 * `pageId` or the home page: what a panel, command or dialog works on.
 */
export function sessionWith(site: SiteDoc = starterSite(), pageId?: PageId): EditorSession {
  return createEditorSession(siteLibrary, site, pageId ?? site.homePageId);
}

/** The registries an area registers into, empty, and the preferences it reads. */
export type TestRegistries = {
  readonly panels: PanelRegistry;
  readonly commands: CommandRegistry;
  readonly toolbars: ContextualToolbarRegistry;
  readonly preferences: PreferencesStore;
};

/**
 * Empty registries, as the app creates them: commands with Windows' keys unless `mac`, so a test
 * doesn't depend on the machine it runs on.
 */
export function registriesForTest({
  mac = false,
}: {
  readonly mac?: boolean;
} = {}): TestRegistries {
  return {
    panels: createPanelRegistry(),
    commands: createCommandRegistry({ mac }),
    toolbars: createContextualToolbars(),
    preferences: createPreferencesStore(),
  };
}
