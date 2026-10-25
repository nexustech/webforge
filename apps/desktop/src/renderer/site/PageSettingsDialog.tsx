import {
  Button,
  Check,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ImageChoice,
  TextInput,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import {
  isImageMeta,
  type MediaId,
  PAGE_DESCRIPTION_MAX,
  PAGE_SLUG_MAX,
  PAGE_TITLE_MAX,
  type PageEntry,
  type SiteDoc,
} from "@webforge/model";
import { useState } from "react";
import { MEDIA_SCHEME } from "../../shared/ipc/media.js";
import { fileNameFor, type PageSettingsChange } from "./page-actions.js";

/** Props of {@link PageSettingsDialog}. */
export type PageSettingsDialogProps = {
  readonly open: boolean;
  readonly site: SiteDoc;
  /** The page whose settings are shown; the dialog keeps the last one while it fades out. */
  readonly page: PageEntry | undefined;
  readonly onSave: (change: PageSettingsChange) => void;
  readonly onCancel: () => void;
};

/**
 * Page Settings (F-SET-2): the title and description search engines and browser tabs show, the
 * file name, the image shown when the page is shared, and whether the page shows the Header and
 * Footer and is in navigation. Saved as one undo step. The Home page is always `index.html` and
 * "Page not found" always `404.html`, so their file names can't be changed here.
 */
export function PageSettingsDialog({
  open,
  site,
  page,
  onSave,
  onCancel,
}: PageSettingsDialogProps) {
  return (
    <Dialog
      open={open && page !== undefined}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      {/* The content mounts with each opening, so the form starts from the page every time. */}
      {/* Taller than a small window can show, so it scrolls instead of hiding Save. */}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        {page !== undefined && (
          <PageSettingsForm site={site} page={page} onSave={onSave} onCancel={onCancel} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PageSettingsForm({
  site,
  page,
  onSave,
  onCancel,
}: Omit<PageSettingsDialogProps, "open" | "page"> & { readonly page: PageEntry }) {
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [description, setDescription] = useState(page.settings.description ?? "");
  const [shareImage, setShareImage] = useState<MediaId | undefined>(page.settings.shareImage);
  const [hideHeader, setHideHeader] = useState(page.settings.hideHeader);
  const [hideFooter, setHideFooter] = useState(page.settings.hideFooter);
  const [hideFromNavigation, setHideFromNavigation] = useState(page.settings.hideFromNavigation);
  const [hideBackToTop, setHideBackToTop] = useState(page.settings.hideBackToTop === true);
  const fixedFile =
    page.id === site.homePageId
      ? t("pageSettings.homeFile")
      : page.kind === "not-found"
        ? t("pageSettings.notFoundFile")
        : undefined;
  const images = Object.values(site.media).filter(isImageMeta);

  return (
    <form
      className="grid gap-3"
      // Save says what's missing in the editor's own words, never the browser's bubble.
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          title,
          slug,
          description,
          shareImage,
          hideHeader,
          hideFooter,
          hideFromNavigation,
          hideBackToTop,
        });
      }}
    >
      <DialogHeader>
        <DialogTitle>{t("pageSettings.title", { name: page.title })}</DialogTitle>
        <DialogDescription>{t("pageSettings.description")}</DialogDescription>
      </DialogHeader>

      <TextInput
        label={t("pageSettings.pageTitle")}
        value={title}
        maxLength={PAGE_TITLE_MAX}
        required
        onChange={setTitle}
      />

      <TextInput
        label={t("pageSettings.fileName")}
        hint={
          fixedFile ??
          t("pages.fileName", {
            path: fileNameFor(site, slug.trim() === "" ? page.slug : slug, page.folder, page.id),
          })
        }
        value={fixedFile === undefined ? slug : fileNameFor(site, slug, undefined, page.id)}
        maxLength={PAGE_SLUG_MAX}
        disabled={fixedFile !== undefined}
        onChange={setSlug}
      />

      <TextInput
        label={t("pageSettings.metaDescription")}
        hint={t("pageSettings.metaDescriptionHint")}
        multiline
        value={description}
        maxLength={PAGE_DESCRIPTION_MAX}
        {...(site.settings.general.description === undefined
          ? {}
          : { placeholder: site.settings.general.description })}
        onChange={setDescription}
      />

      <fieldset className="grid gap-1">
        <legend className="mb-1 text-xs text-muted-foreground">
          {t("pageSettings.shareImage")}
        </legend>
        <div className="flex flex-wrap gap-2">
          <ImageChoice
            name="share-image"
            label={t("pageSettings.siteShareImage")}
            selected={shareImage === undefined}
            onSelect={() => setShareImage(undefined)}
          />
          {images.map((image) => (
            <ImageChoice
              key={image.id}
              name="share-image"
              label={image.name}
              thumbnail={`${MEDIA_SCHEME}://thumbnail/${image.hash}`}
              selected={shareImage === image.id}
              onSelect={() => setShareImage(image.id)}
            />
          ))}
        </div>
        {images.length === 0 && (
          <p className="text-xs text-muted-foreground">{t("pageSettings.noImages")}</p>
        )}
      </fieldset>

      <div className="grid gap-1.5">
        <Check label={t("pageSettings.hideHeader")} checked={hideHeader} onChange={setHideHeader} />
        <Check label={t("pageSettings.hideFooter")} checked={hideFooter} onChange={setHideFooter} />
        {page.kind === "page" && (
          <Check
            label={t("pageSettings.hideFromNavigation")}
            checked={hideFromNavigation}
            onChange={setHideFromNavigation}
          />
        )}
        {/* Only while the site shows one (Site Settings → General). */}
        {site.settings.general.backToTop === true && (
          <Check
            label={t("pageSettings.hideBackToTop")}
            checked={hideBackToTop}
            onChange={setHideBackToTop}
          />
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("pages.cancel")}
        </Button>
        <Button type="submit" disabled={title.trim() === ""}>
          {t("pageSettings.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
