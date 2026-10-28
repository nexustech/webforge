import { FormDialog, type FormField, type FormSchema, type FormSpec } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import {
  anchorIdSchema,
  EMAIL_SUBJECT_MAX,
  type LinkValue,
  linkValueSchema,
  MENU_LABEL_MAX,
  pageIdSchema,
  type SiteDoc,
} from "@webforge/model";
import { z } from "zod";
import "../shell/form-messages.js";
import type { LinkFieldChange } from "../editor/link-change.js";
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

/** What the form holds as the person edits: every kind's values, kept while they switch kinds. */
type LinkValues = {
  readonly label: string;
  readonly kind: Kind;
  readonly pageId: string;
  /** The section's node id, or "" for the top of the page. */
  readonly section: string;
  readonly newTab: boolean;
  readonly address: string;
  readonly subject: string;
  readonly number: string;
  readonly href: string;
  readonly fileId: string;
  readonly fileNewTab: boolean;
  readonly download: boolean;
};

/** What the form saves: the link, its label, and the anchor a section gets (F-ED-18). */
type LinkOutput = { readonly label: string } & LinkFieldChange & { readonly link: LinkValue };

/** A web address as typed, with `https://` added when it has no scheme ("example.com"). */
const withScheme = (address: string) =>
  /^[a-z][a-z0-9+.-]*:/i.test(address) ? address : `https://${address}`;

/**
 * The dialog's own wording for a value the model's link schema refuses (#391), by the path it
 * checks: an address, a number or a web address not in the form it should be, a page or document
 * not chosen. Too long or empty says so in the editor's general words (`form.error.*`).
 */
const MESSAGES: Readonly<Record<string, Parameters<typeof t>[0]>> = {
  "link.address": "link.error.email",
  "link.number": "link.error.phone",
  "link.href": "link.error.url",
  "link.pageId": "link.error.page",
  "link.mediaId": "link.error.file",
  label: "link.error.label",
};

/**
 * The section's anchor, whether the link's or the one it's given (`anchor.*`), as one path: the
 * Section field's, which says it can't be linked to however it fails, since it isn't typed here.
 */
const SECTION = ["link", "anchor"] as const;

/** Whether an issue's path is about the section's anchor, given or kept. */
const aboutSection = (path: readonly PropertyKey[]) =>
  path[0] === "anchor" || (path[0] === SECTION[0] && path[1] === SECTION[1]);

/** The link schema the form checks against, with a label when the dialog asks for one. */
function linkSchema(asksLabel: boolean): FormSchema<LinkOutput> {
  const schema = z.strictObject({
    label: asksLabel ? z.string().min(1) : z.string(),
    link: linkValueSchema,
    anchor: z
      .strictObject({ pageId: pageIdSchema, nodeId: z.string().min(1), anchorId: anchorIdSchema })
      .optional(),
  });
  return {
    "~standard": {
      validate: (value) => {
        const parsed = schema.safeParse(value);
        if (parsed.success) return { value: parsed.data as LinkOutput };
        return {
          issues: parsed.error.issues.map((issue) => {
            if (aboutSection(issue.path)) {
              return { path: SECTION, message: t("link.error.section") };
            }
            const own = MESSAGES[issue.path.map(String).join(".")];
            const tooLong = issue.code === "too_big";
            return {
              path: issue.path,
              message: own === undefined || tooLong ? issue.message : t(own),
            };
          }),
        };
      },
    },
  };
}

/** The values a link starts the form from, with the first page and document as the defaults. */
function initialValues(
  link: LinkValue | undefined,
  label: string | undefined,
  targets: readonly PageTarget[],
  documents: readonly { readonly id: string }[],
): LinkValues {
  const pageId = link?.kind === "page" ? link.pageId : (targets[0]?.id ?? "");
  const page = targets.find((target) => target.id === pageId);
  return {
    label: label ?? "",
    kind: link === undefined ? "page" : link.kind,
    pageId,
    section:
      link?.kind === "page" && link.anchor !== undefined
        ? (page?.sections.find((target) => target.anchorId === link.anchor)?.nodeId ?? "")
        : "",
    newTab: link?.newTab === true,
    address: link?.kind === "email" ? link.address : "",
    subject: link?.kind === "email" ? (link.subject ?? "") : "",
    number: link?.kind === "phone" ? link.number : "",
    href: link?.kind === "url" ? link.href : "",
    fileId: link?.kind === "file" ? link.mediaId : (documents[0]?.id ?? ""),
    // A link to a document opens in a new tab unless told otherwise.
    fileNewTab: link?.kind !== "file" || link.newTab === true,
    download: link?.kind === "file" && link.download === true,
  };
}

/**
 * The link dialog's form (#391): the label when asked, what the link goes to, and that kind's
 * fields as the values ask. The model's link schema checks it, so it keeps no state of its own.
 */
function linkSpec(
  site: SiteDoc,
  targets: readonly PageTarget[],
  documents: readonly { readonly id: string; readonly fileName: string }[],
  asksLabel: boolean,
): FormSpec<LinkValues, LinkOutput> {
  const newTab: FormField = { kind: "toggle", name: "newTab", label: t("link.newTab") };
  return {
    fields: (values) => {
      const page = targets.find((target) => target.id === values.pageId);
      const kindFields: Record<Kind, readonly FormField[]> = {
        page: [
          {
            kind: "select",
            name: "pageId",
            path: "link.pageId",
            label: t("link.page"),
            options: targets.map((target) => ({ label: target.title, value: target.id })),
          },
          {
            kind: "select",
            name: "section",
            path: SECTION.join("."),
            label: t("link.section"),
            options: [
              { label: t("link.top"), value: "" },
              ...(page?.sections ?? []).map((target) => ({
                label: target.label,
                value: target.nodeId,
              })),
            ],
          },
          newTab,
        ],
        email: [
          {
            kind: "text",
            name: "address",
            path: "link.address",
            label: t("link.address"),
            inputType: "email",
            placeholder: t("link.addressPlaceholder"),
          },
          {
            kind: "text",
            name: "subject",
            path: "link.subject",
            label: t("link.subject"),
            maxLength: EMAIL_SUBJECT_MAX,
          },
        ],
        phone: [
          {
            kind: "text",
            name: "number",
            path: "link.number",
            label: t("link.number"),
            inputType: "tel",
            placeholder: t("link.numberPlaceholder"),
          },
        ],
        url: [
          {
            kind: "text",
            name: "href",
            path: "link.href",
            label: t("link.url"),
            inputType: "url",
            placeholder: t("link.urlPlaceholder"),
          },
          newTab,
        ],
        file:
          documents.length === 0
            ? []
            : [
                {
                  kind: "select",
                  name: "fileId",
                  path: "link.mediaId",
                  label: t("link.document"),
                  options: documents.map((document) => ({
                    label: document.fileName,
                    value: document.id,
                  })),
                },
                { kind: "toggle", name: "fileNewTab", label: t("link.newTab") },
                { kind: "toggle", name: "download", label: t("link.download") },
              ],
      };
      return [
        ...(asksLabel
          ? [
              {
                kind: "text",
                name: "label",
                label: t("link.label"),
                maxLength: MENU_LABEL_MAX,
              } as const,
            ]
          : []),
        {
          kind: "choice",
          name: "kind",
          label: t("link.kind"),
          options: KINDS.map((kind) => ({ label: t(`link.kind.${kind}`), value: kind })),
        },
        ...kindFields[values.kind],
      ];
    },
    schema: linkSchema(asksLabel),
    toModel: (values) => {
      const label = values.label.trim();
      switch (values.kind) {
        case "page": {
          const tab = values.newTab ? { newTab: true } : {};
          const page = targets.find((target) => target.id === values.pageId);
          const target = page?.sections.find((each) => each.nodeId === values.section);
          if (page === undefined || target === undefined) {
            return { label, link: { kind: "page", pageId: values.pageId, ...tab } };
          }
          const { anchor, given } = sectionAnchor(site, page.id, target);
          return {
            label,
            link: { kind: "page", pageId: page.id, anchor, ...tab },
            ...(given === undefined
              ? {}
              : { anchor: { pageId: page.id, nodeId: target.nodeId, anchorId: given } }),
          };
        }
        case "email": {
          const subject = values.subject.trim();
          return {
            label,
            link: {
              kind: "email",
              address: values.address.trim(),
              ...(subject === "" ? {} : { subject }),
            },
          };
        }
        case "phone":
          return { label, link: { kind: "phone", number: values.number.trim() } };
        case "url":
          return {
            label,
            link: {
              kind: "url",
              href: withScheme(values.href.trim()),
              ...(values.newTab ? { newTab: true } : {}),
            },
          };
        case "file":
          return {
            label,
            link: {
              kind: "file",
              mediaId: values.fileId,
              ...(values.fileNewTab ? { newTab: true } : {}),
              ...(values.download ? { download: true } : {}),
            },
          };
      }
    },
    // With no documents in Media there's nothing to link to: said on the kind, once it's chosen.
    check: (values) =>
      values.kind === "file" && documents.length === 0
        ? [{ path: ["kind"], message: t("link.error.file") }]
        : [],
    // Another page has other sections: its top first.
    adjust: (next, previous) => (next.pageId === previous.pageId ? next : { ...next, section: "" }),
    validateOn: "change",
  };
}

/**
 * The link dialog (F-ED-18): a page of the site, or a section on it; an e-mail address; a phone
 * number; a web address, optionally opened in a new tab; or a document in Media (1.28), in a new
 * tab by default or saved as a download. Linking to a section that has no anchor yet gives it one,
 * named after the section. A form (#391): the model's link schema checks what's typed.
 */
export function LinkDialog({
  open,
  link,
  site,
  targets,
  label,
  title,
  onSave,
  onCancel,
}: LinkDialogProps) {
  // The documents in Media, by file name.
  const documents = Object.values(site.media)
    .filter((item) => item.kind === "file")
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
  return (
    <FormDialog
      open={open}
      title={title ?? t("link.title")}
      description={t("link.description")}
      confirm={t("link.save")}
      spec={linkSpec(site, targets, documents, label !== undefined)}
      initial={initialValues(link, label, targets, documents)}
      onSave={({ label: text, link: saved, anchor }) =>
        onSave({ link: saved, ...(anchor === undefined ? {} : { anchor }) }, text)
      }
      onCancel={onCancel}
    />
  );
}
