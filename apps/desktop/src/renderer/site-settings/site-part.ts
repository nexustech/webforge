import { t } from "@webforge/i18n";
import {
  type ImageMeta,
  isImageMeta,
  pageFile,
  type SiteDoc,
  type SiteSettings,
} from "@webforge/model";
import { mediaImageUrl } from "../../shared/ipc/media.js";
import type { EditorSession } from "../editor/editor-session.js";
import {
  type OpenSettings,
  type SettingsRegistry,
  settingsPart,
} from "../editor/settings-registry.js";
import { saveSiteSettings, toSettingsForm } from "./settings-form.js";
import { siteSettingsSpec } from "./settings-sections.js";

/** Media thumbnails, by default. */
const thumbnailUrl = (item: ImageMeta) => mediaImageUrl(item, "thumbnail");

/**
 * Site Settings as a part of Settings (F-SET-1, LF-12): `site`'s settings in their sections under
 * *This site*, checked by the model's schema; `save` keeps what Save gives. *Netlify Forms* is
 * offered when the site has a Netlify destination (`onNetlify`, 4.2).
 */
export function siteSettingsPart(
  site: SiteDoc,
  save: (settings: SiteSettings) => void,
  imageUrl: (item: ImageMeta) => string = thumbnailUrl,
  onNetlify = false,
): OpenSettings {
  const images = Object.values(site.media).filter(isImageMeta);
  // The pages an old address can go to, in the Pages panel's order (#862).
  const pages = site.pageOrder.flatMap((id) => {
    const page = site.pages[id];
    const file = pageFile(site, id);
    return page === undefined || file === undefined
      ? []
      : [{ id, title: page.title, file, target: page.kind === "page" }];
  });
  return settingsPart({
    id: "site",
    heading: "site",
    label: t("site.settings.title"),
    spec: siteSettingsSpec(site.settings, { images, imageUrl, onNetlify, pages }),
    initial: toSettingsForm(site.settings),
    save,
  });
}

/**
 * The open site's part of Settings: its settings as the dialog opens (R9), saved as one undo step
 * named for the sections changed, or none if nothing did. `onNetlify`: whether the site has a
 * Netlify destination as the dialog opens (4.2).
 */
export function registerSiteSettings(
  registry: SettingsRegistry,
  session: EditorSession,
  onNetlify: () => boolean = () => false,
): () => void {
  return registry.register({
    id: "site",
    heading: "site",
    open: () =>
      siteSettingsPart(
        session.history.document.getState(),
        (settings) => {
          saveSiteSettings(session, settings);
        },
        thumbnailUrl,
        onNetlify(),
      ),
  });
}
