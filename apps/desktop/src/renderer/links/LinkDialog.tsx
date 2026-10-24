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
  ToggleGroup,
  ToggleGroupItem,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import {
  EMAIL_SUBJECT_MAX,
  type LinkValue,
  linkValueSchema,
  MENU_LABEL_MAX,
  type PageId,
  type SiteDoc,
} from "@webforge/model";
import { type ReactNode, useId, useState } from "react";
import type { LinkFieldChange } from "./link-change.js";
import { type PageTarget, sectionAnchor } from "./link-targets.js";

/** The kinds of link the dialog makes; a file is a document in Media (1.28). */
const KINDS = ["page", "email", "phone", "url", "file"] as const;
type Kind = (typeof KINDS)[number];

/** Props of {@link LinkDialog}. */
export type LinkDialogProps = {
  readonly open: boolean;
  /** The link being edited, if any. */
  readonly link: LinkValue | undefined;
  readonly site: SiteDoc;
  readonly targets: readonly PageTarget[];
  /**
   * For a link that shows a label of its own (a menu item, F-ED-17): the label to start from. The
   * dialog then asks for it too, and saves only with one.
   */
  readonly label?: string | undefined;
  /** The dialog's title, "Link" by default. */
  readonly title?: string | undefined;
  /** Called with the link and, when the dialog asks for one, its trimmed label. */
  readonly onSave: (change: LinkFieldChange, label: string) => void;
  readonly onCancel: () => void;
};

/**
 * The link dialog (F-ED-18): a page of the site, or a section on it; an e-mail address; a phone
 * number; a web address, optionally opened in a new tab; or a document in Media (1.28), in a new
 * tab by default or saved as a download. Linking to a section that has no anchor yet gives it one,
 * named after the section.
 */
export function LinkDialog({ open, onCancel, ...form }: LinkDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      {/* The content mounts with each opening, so the form starts from the link every time. */}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <LinkForm {...form} onCancel={onCancel} />
      </DialogContent>
    </Dialog>
  );
}

/** A labelled control. */
function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

/** A web address as typed, with `https://` added when it has no scheme ("example.com"). */
const withScheme = (address: string) =>
  /^[a-z][a-z0-9+.-]*:/i.test(address) ? address : `https://${address}`;

function LinkForm({
  link,
  site,
  targets,
  label,
  title,
  onSave,
  onCancel,
}: Omit<LinkDialogProps, "open">) {
  // The documents in Media, by file name; a link to one opens in a new tab unless told otherwise.
  const documents = Object.values(site.media)
    .filter((item) => item.kind === "file")
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
  const [fileId, setFileId] = useState<string | undefined>(
    link?.kind === "file" ? link.mediaId : documents[0]?.id,
  );
  const [fileNewTab, setFileNewTab] = useState(link?.kind !== "file" || link.newTab === true);
  const [download, setDownload] = useState(link?.kind === "file" && link.download === true);
  const [labelText, setLabelText] = useState(label ?? "");
  // Said only once the label has been typed in and emptied again, not while it waits to be filled.
  const [labelTouched, setLabelTouched] = useState(false);
  const labelMissing = label !== undefined && labelText.trim() === "";
  const [kind, setKind] = useState<Kind>(link === undefined ? "page" : link.kind);
  const [pageId, setPageId] = useState<PageId | undefined>(
    link?.kind === "page" ? link.pageId : targets[0]?.id,
  );
  const page = targets.find((target) => target.id === pageId);
  const [section, setSection] = useState<string>(() =>
    link?.kind === "page" && link.anchor !== undefined
      ? (page?.sections.find((target) => target.anchorId === link.anchor)?.nodeId ?? "")
      : "",
  );
  const [address, setAddress] = useState(link?.kind === "email" ? link.address : "");
  const [subject, setSubject] = useState(link?.kind === "email" ? (link.subject ?? "") : "");
  const [number, setNumber] = useState(link?.kind === "phone" ? link.number : "");
  const [href, setHref] = useState(link?.kind === "url" ? link.href : "");
  const [newTab, setNewTab] = useState(link?.newTab === true);

  /** The change the form describes, or a message saying what's missing. */
  const result = ((): { change: LinkFieldChange } | { error: string } => {
    const tab = newTab && (kind === "page" || kind === "url") ? { newTab: true } : {};
    if (kind === "page") {
      if (page === undefined) return { error: t("link.error.page") };
      const target = page.sections.find((candidate) => candidate.nodeId === section);
      if (target === undefined) {
        return { change: { link: { kind: "page", pageId: page.id, ...tab } } };
      }
      const { anchor, given } = sectionAnchor(site, page.id, target);
      return {
        change: {
          link: { kind: "page", pageId: page.id, anchor, ...tab },
          ...(given === undefined
            ? {}
            : { anchor: { pageId: page.id, nodeId: target.nodeId, anchorId: given } }),
        },
      };
    }
    if (kind === "file") {
      const document = documents.find((item) => item.id === fileId);
      if (document === undefined) return { error: t("link.error.file") };
      return {
        change: {
          link: {
            kind: "file",
            mediaId: document.id,
            ...(fileNewTab ? { newTab: true } : {}),
            ...(download ? { download: true } : {}),
          },
        },
      };
    }
    const candidate: unknown =
      kind === "email"
        ? {
            kind,
            address: address.trim(),
            ...(subject.trim() === "" ? {} : { subject: subject.trim() }),
          }
        : kind === "phone"
          ? { kind, number: number.trim() }
          : { kind, href: withScheme(href.trim()), ...tab };
    const parsed = linkValueSchema.safeParse(candidate);
    return parsed.success ? { change: { link: parsed.data } } : { error: t(`link.error.${kind}`) };
  })();
  const typed =
    kind === "page" ||
    kind === "file" ||
    (kind === "email" ? address : kind === "phone" ? number : href).trim() !== "";

  return (
    <form
      className="grid gap-3"
      // The form checks links itself: the browser's own check would refuse "example.com" (no
      // https://, which the form adds) before it could.
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if ("change" in result && !labelMissing) onSave(result.change, labelText.trim());
      }}
    >
      <DialogHeader>
        <DialogTitle>{title ?? t("link.title")}</DialogTitle>
        <DialogDescription>{t("link.description")}</DialogDescription>
      </DialogHeader>

      {label !== undefined && (
        <Field label={t("link.label")}>
          {(id) => (
            <input
              id={id}
              className={fieldControlClass}
              value={labelText}
              maxLength={MENU_LABEL_MAX}
              onChange={(event) => {
                setLabelText(event.currentTarget.value);
                setLabelTouched(true);
              }}
            />
          )}
        </Field>
      )}

      <ToggleGroup
        type="single"
        value={kind}
        aria-label={t("link.kind")}
        className="justify-self-start"
        onValueChange={(value) => {
          const next = KINDS.find((candidate) => candidate === value);
          if (next !== undefined) setKind(next);
        }}
      >
        {KINDS.map((option) => (
          <ToggleGroupItem key={option} value={option}>
            {t(`link.kind.${option}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {kind === "page" && (
        <>
          <Field label={t("link.page")}>
            {(id) => (
              <select
                id={id}
                className={fieldControlClass}
                value={pageId ?? ""}
                onChange={(event) => {
                  setPageId(event.currentTarget.value as PageId);
                  setSection("");
                }}
              >
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.title}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t("link.section")}>
            {(id) => (
              <select
                id={id}
                className={fieldControlClass}
                value={section}
                onChange={(event) => setSection(event.currentTarget.value)}
              >
                <option value="">{t("link.top")}</option>
                {page?.sections.map((target) => (
                  <option key={target.nodeId} value={target.nodeId}>
                    {target.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </>
      )}
      {kind === "email" && (
        <>
          <Field label={t("link.address")}>
            {(id) => (
              <input
                id={id}
                type="email"
                className={fieldControlClass}
                value={address}
                placeholder={t("link.addressPlaceholder")}
                onChange={(event) => setAddress(event.currentTarget.value)}
              />
            )}
          </Field>
          <Field label={t("link.subject")}>
            {(id) => (
              <input
                id={id}
                className={fieldControlClass}
                value={subject}
                maxLength={EMAIL_SUBJECT_MAX}
                onChange={(event) => setSubject(event.currentTarget.value)}
              />
            )}
          </Field>
        </>
      )}
      {kind === "phone" && (
        <Field label={t("link.number")}>
          {(id) => (
            <input
              id={id}
              type="tel"
              className={fieldControlClass}
              value={number}
              placeholder={t("link.numberPlaceholder")}
              onChange={(event) => setNumber(event.currentTarget.value)}
            />
          )}
        </Field>
      )}
      {kind === "url" && (
        <Field label={t("link.url")}>
          {(id) => (
            <input
              id={id}
              type="url"
              className={fieldControlClass}
              value={href}
              placeholder={t("link.urlPlaceholder")}
              onChange={(event) => setHref(event.currentTarget.value)}
            />
          )}
        </Field>
      )}
      {kind === "file" && documents.length > 0 && (
        <>
          <Field label={t("link.document")}>
            {(id) => (
              <select
                id={id}
                className={fieldControlClass}
                value={fileId ?? ""}
                onChange={(event) => setFileId(event.currentTarget.value)}
              >
                {documents.map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.fileName}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={fileNewTab}
              onChange={(event) => setFileNewTab(event.currentTarget.checked)}
            />
            {t("link.newTab")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={download}
              onChange={(event) => setDownload(event.currentTarget.checked)}
            />
            {t("link.download")}
          </label>
        </>
      )}
      {(kind === "page" || kind === "url") && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={newTab}
            onChange={(event) => setNewTab(event.currentTarget.checked)}
          />
          {t("link.newTab")}
        </label>
      )}

      <p
        role="status"
        className={cn("min-h-4 text-xs text-destructive", !typed && !labelTouched && "invisible")}
      >
        {"error" in result && typed
          ? result.error
          : labelMissing && labelTouched
            ? t("link.error.label")
            : ""}
      </p>

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("pages.cancel")}
        </Button>
        <Button type="submit" disabled={!("change" in result) || labelMissing}>
          {t("link.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
