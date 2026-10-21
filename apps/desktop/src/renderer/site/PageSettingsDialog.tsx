import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  fieldControlClass,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { isImageMeta, type MediaId, type PageEntry, type SiteDoc } from "@webforge/model";
import { type ReactNode, useId, useState } from "react";
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
      <DialogContent className="sm:max-w-lg">
        {page !== undefined && (
          <PageSettingsForm site={site} page={page} onSave={onSave} onCancel={onCancel} />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** A labelled field; `hint` goes under it and describes it. */
function Field({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly children: (ids: { id: string; hintId: string | undefined }) => ReactNode;
}) {
  const id = useId();
  const hintId = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      {children({ id, hintId: hint === undefined ? undefined : hintId })}
      {hint !== undefined && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/** A checkbox with its label to the right. */
function Check({
  label,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="size-4 accent-primary"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      {label}
    </label>
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
        });
      }}
    >
      <DialogHeader>
        <DialogTitle>{t("pageSettings.title", { name: page.title })}</DialogTitle>
        <DialogDescription>{t("pageSettings.description")}</DialogDescription>
      </DialogHeader>

      <Field label={t("pageSettings.pageTitle")}>
        {({ id }) => (
          <input
            id={id}
            className={fieldControlClass}
            value={title}
            maxLength={200}
            required
            onChange={(event) => setTitle(event.currentTarget.value)}
          />
        )}
      </Field>

      <Field
        label={t("pageSettings.fileName")}
        hint={
          fixedFile ??
          t("pages.fileName", {
            path: fileNameFor(site, slug.trim() === "" ? page.slug : slug, page.folder, page.id),
          })
        }
      >
        {({ id, hintId }) => (
          <input
            id={id}
            className={fieldControlClass}
            value={fixedFile === undefined ? slug : fileNameFor(site, slug, undefined, page.id)}
            maxLength={80}
            disabled={fixedFile !== undefined}
            aria-describedby={hintId}
            onChange={(event) => setSlug(event.currentTarget.value)}
          />
        )}
      </Field>

      <Field label={t("pageSettings.metaDescription")} hint={t("pageSettings.metaDescriptionHint")}>
        {({ id, hintId }) => (
          <textarea
            id={id}
            className={cn(fieldControlClass, "h-16 resize-none py-1")}
            value={description}
            maxLength={300}
            placeholder={site.settings.general.description}
            aria-describedby={hintId}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
        )}
      </Field>

      <fieldset className="grid gap-1">
        <legend className="mb-1 text-xs text-muted-foreground">
          {t("pageSettings.shareImage")}
        </legend>
        <div className="flex flex-wrap gap-2">
          <ImageChoice
            label={t("pageSettings.siteShareImage")}
            selected={shareImage === undefined}
            onSelect={() => setShareImage(undefined)}
          />
          {images.map((image) => (
            <ImageChoice
              key={image.id}
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

/** One choice of share image: a radio button showing the image, or the site's default. */
function ImageChoice({
  label,
  thumbnail,
  selected,
  onSelect,
}: {
  readonly label: string;
  readonly thumbnail?: string;
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "flex w-20 cursor-pointer flex-col items-center gap-1 rounded-sm border border-border p-1 text-center text-xs",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        selected && "border-primary bg-accent text-accent-foreground",
      )}
    >
      <input
        type="radio"
        name="share-image"
        className="sr-only"
        checked={selected}
        onChange={onSelect}
      />
      {thumbnail === undefined ? (
        <span
          className="flex size-12 items-center justify-center rounded-sm bg-input"
          aria-hidden
        />
      ) : (
        <img src={thumbnail} alt="" className="size-12 rounded-sm object-cover" />
      )}
      <span className="line-clamp-2 break-all">{label}</span>
    </label>
  );
}
