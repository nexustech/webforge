import type { ImageMeta, SiteDoc, SiteSettings } from "@webforge/model";
import { SettingsDialog } from "../settings/index.js";
import type { Section } from "./settings-form.js";
import { siteSettingsPart } from "./site-part.js";

/** Props of {@link SiteSettingsDialog}. */
export type SiteSettingsDialogProps = {
  readonly open: boolean;
  readonly site: SiteDoc;
  /** Valid settings to save; the dialog has checked them. */
  readonly onSave: (settings: SiteSettings) => void;
  readonly onCancel: () => void;
  /** Where an image's thumbnail is; the `webforge-media:` scheme by default, data URLs in stories. */
  readonly imageUrl?: (item: ImageMeta) => string;
  /** The section shown first; stories show the others. */
  readonly initialSection?: Section;
};

/**
 * The Settings dialog with the site's part alone (F-SET-1, X3, LF-12): the details that apply to
 * the whole site, in sections, as a form (2.21). Save checks every value with the model's own
 * schema and points at what needs fixing in plain words. The window's Settings show the app's parts
 * too ({@link SettingsDialog}); this shows the site's on its own, for stories and tests.
 */
export function SiteSettingsDialog({
  open,
  site,
  onSave,
  onCancel,
  imageUrl,
  initialSection = "general",
}: SiteSettingsDialogProps) {
  return (
    <SettingsDialog
      open={open}
      parts={[siteSettingsPart(site, onSave, imageUrl)]}
      initialGroup={`site:${initialSection}`}
      onSaved={() => undefined}
      onCancel={onCancel}
    />
  );
}
