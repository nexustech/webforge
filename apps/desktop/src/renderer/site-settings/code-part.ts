import { type FormField, type FormSchema, type FormSpec, sameValue } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { type SiteCode, type SiteDoc, siteCodeSchema } from "@webforge/model";
import { z } from "zod";
import type { EditorSession } from "../editor/editor-session.js";
import {
  type OpenSettings,
  type SettingsRegistry,
  settingsPart,
} from "../editor/settings-registry.js";
import type { PreferencesStore } from "../shell/preferences-store.js";

/**
 * What the Custom code section edits (F-ED-15, C7, 3.9): the site's own code as typed, and the
 * outside addresses its code may load files from (C8), each a row with an id while it's open.
 */
export type CodeForm = {
  readonly css: string;
  readonly js: string;
  readonly head: string;
  readonly bodyEnd: string;
  readonly allowed: readonly { readonly id: string; readonly url: string }[];
};

/** What the section saves: the site's code, and its allowed outside addresses. */
export type SavedCode = {
  readonly code: SiteCode;
  readonly allowedExternalUrls: readonly string[];
};

/** The section's id, as the Settings dialog lists it and a step that needs it opens it on. */
const CODE_SECTION = "code";

/** The form for `site`'s code, as the dialog opens with it. */
export function toCodeForm(site: SiteDoc): CodeForm {
  const { css, js, head, bodyEnd } = site.code;
  return {
    css,
    js,
    head,
    bodyEnd,
    allowed: site.settings.allowedExternalUrls.map((url, index) => ({
      id: `allowed-${index}`,
      url,
    })),
  };
}

/**
 * An address the site's code may load from: `https://` only, since a published site is served over
 * https, where a browser blocks an `http://` script or stylesheet as mixed content.
 */
const allowedAddressSchema = z.url({ protocol: /^https$/, hostname: z.regexes.domain });

const savedCodeSchema = z.strictObject({
  code: siteCodeSchema,
  allowedExternalUrls: z.array(allowedAddressSchema),
});

/** Checks what the form describes, an allowed address that isn't a web address in its own words. */
const codeSchema: FormSchema<SavedCode> = {
  "~standard": {
    validate: (value) => {
      const parsed = savedCodeSchema.safeParse(value);
      if (parsed.success) return { value: parsed.data };
      return {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path,
          message:
            issue.path[0] === "allowedExternalUrls" ? t("site.code.error.address") : issue.message,
        })),
      };
    },
  },
};

/** The section's fields: the four parts of the site's code, then the allowed addresses. */
function codeFields(): FormField[] {
  return [
    {
      kind: "code",
      name: "css",
      path: "code.css",
      label: t("site.code.css"),
      help: t("site.code.cssHint"),
    },
    {
      kind: "code",
      name: "js",
      path: "code.js",
      label: t("site.code.js"),
      help: t("site.code.jsHint"),
    },
    {
      kind: "code",
      name: "head",
      path: "code.head",
      label: t("site.code.head"),
      help: t("site.code.headHint"),
    },
    {
      kind: "code",
      name: "bodyEnd",
      path: "code.bodyEnd",
      label: t("site.code.bodyEnd"),
      help: t("site.code.bodyEndHint"),
    },
    {
      kind: "list",
      name: "allowed",
      path: "allowedExternalUrls",
      label: t("site.code.allowed"),
      help: t("site.code.allowedHint"),
      itemLabel: t("site.code.allowedAddress"),
      addLabel: t("site.code.allowedAdd"),
      removeLabel: t("site.code.allowedRemove"),
      // Each address is allowed or not; their order means nothing.
      orderless: true,
      itemFields: [
        {
          kind: "text",
          name: "url",
          label: t("site.code.allowedAddress"),
          inputType: "url",
          placeholder: "https://",
        },
      ],
      newItem: () => ({ url: "" }),
    },
  ];
}

/** The section's form, all of it in one group. */
export function codeSpec(): FormSpec<CodeForm, SavedCode> {
  return {
    groups: [{ id: CODE_SECTION, label: t("site.code.title") }],
    fields: () => codeFields().map((field) => ({ ...field, group: CODE_SECTION })),
    schema: codeSchema,
    toModel: (values) => ({
      code: { css: values.css, js: values.js, head: values.head, bodyEnd: values.bodyEnd },
      allowedExternalUrls: values.allowed.map((row) => row.url.trim()),
    }),
  };
}

/**
 * Saves the site's code and allowed addresses as one undo step, or nothing when neither changed.
 */
export function saveSiteCode(
  session: Pick<EditorSession, "edit"> & {
    readonly history: Pick<EditorSession["history"], "document">;
  },
  saved: SavedCode,
): boolean {
  const site = session.history.document.getState();
  const { bundled, ...code } = site.code;
  if (
    sameValue(code, saved.code) &&
    sameValue(site.settings.allowedExternalUrls, saved.allowedExternalUrls)
  ) {
    return false;
  }
  session.edit("props", t("site.code.history"), (draft) => {
    // The files kept with the site (Download and bundle) aren't the form's: they stay.
    draft.code = {
      ...saved.code,
      ...(bundled === undefined ? {} : { bundled: draft.code.bundled }),
    };
    draft.settings.allowedExternalUrls = [...saved.allowedExternalUrls];
  });
  return true;
}

/** The site's code as a part of Settings, under *This site*, saving with `save`. */
export function siteCodePart(site: SiteDoc, save: (saved: SavedCode) => void): OpenSettings {
  return settingsPart({
    id: CODE_SECTION,
    heading: "site",
    label: t("site.code.title"),
    spec: codeSpec(),
    initial: toCodeForm(site),
    save,
  });
}

/** Whether `site` has code of its own, or addresses its code may load from. */
const hasOwnCode = ({ code, settings }: SiteDoc) =>
  [code.css, code.js, code.head, code.bodyEnd].some((part) => part.trim() !== "") ||
  settings.allowedExternalUrls.length > 0;

/**
 * The open site's Custom Code in Settings, after Site Settings: shown in Advanced mode (T2), as
 * technical words are, and in Simple mode too once the site has code of its own, so a Site Check
 * finding in it can be shown and fixed (3.9). Saved as one undo step.
 */
export function registerSiteCode(
  registry: SettingsRegistry,
  session: EditorSession,
  preferences: Pick<PreferencesStore, "getState">,
): () => void {
  return registry.register({
    id: CODE_SECTION,
    heading: "site",
    order: 1,
    open: () => {
      const site = session.history.document.getState();
      return preferences.getState().preferences.editorLevel === "advanced" || hasOwnCode(site)
        ? siteCodePart(site, (saved) => {
            saveSiteCode(session, saved);
          })
        : undefined;
    },
  });
}
