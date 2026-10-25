import { FormDialog } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { type ImageMeta, isImageMeta, type SiteDoc, type SiteSettings } from "@webforge/model";
import { mediaImageUrl } from "../../shared/ipc/media.js";
import { type Section, toSettingsForm } from "./settings-form.js";
import { siteSettingsSpec } from "./settings-sections.js";

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

/** Media thumbnails, by default. */
const thumbnailUrl: NonNullable<SiteSettingsDialogProps["imageUrl"]> = (item) =>
  mediaImageUrl(item, "thumbnail");

/**
 * Site Settings (F-SET-1, X3): the details that apply to the whole site, in sections, as a form
 * (2.21). Save checks every value with the model's own schema and points at what needs fixing in
 * plain words; saved settings are one undo step. Publishing destinations are set up when
 * publishing (B1).
 */
export function SiteSettingsDialog({
  open,
  site,
  onSave,
  onCancel,
  imageUrl = thumbnailUrl,
  initialSection = "general",
}: SiteSettingsDialogProps) {
  const images = Object.values(site.media).filter(isImageMeta);
  return (
    <FormDialog
      open={open}
      title={t("site.settings.title")}
      description={t("site.settings.description")}
      confirm={t("site.settings.save")}
      spec={siteSettingsSpec(site.settings, { images, imageUrl })}
      initial={toSettingsForm(site.settings)}
      groupsLabel={t("site.settings.sections")}
      initialGroup={initialSection}
      size="lg"
      onSave={(settings) => onSave(settings)}
      onCancel={onCancel}
    />
  );
}
