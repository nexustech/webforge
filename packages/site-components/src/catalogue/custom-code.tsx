import { t } from "@webforge/i18n";
import { sanitizeCustomCode } from "../custom-code.js";
import { defineComponent } from "../define.js";
import { MARGIN_FIELD, marginClasses } from "../frame.js";
import type { ComponentDef } from "../library.js";

/** The editor's label on Custom Code: styled inline, as the site's CSS has only its own classes. */
const LABEL_STYLE = {
  display: "inline-block",
  marginBottom: "0.25rem",
  padding: "0.125rem 0.5rem",
  borderRadius: "0.25rem",
  fontSize: "0.75rem",
  fontFamily: "ui-monospace, monospace",
  background: "rgba(127, 127, 127, 0.15)",
} as const;

/**
 * Custom Code (F-ED-15, C7; Advanced mode): HTML the person writes, written into the exported page
 * as it is, where its scripts run. Everywhere else, the canvas included, it is shown sanitised
 * (`sanitizeCustomCode`): no scripts, styles, frames, forms or anything from the web, so it can't
 * break editing or make a request; and labelled, as it isn't edited on the canvas. Only the export
 * pipeline sets `rawCustomCode`, never a stored document.
 */
const customCode = defineComponent({
  label: t("element.customCode"),
  category: t("category.advanced"),
  advancedOnly: true,
  fields: {
    code: { kind: "code", label: t("field.customCode"), help: t("field.customCode.help") },
    margin: MARGIN_FIELD,
  },
  defaults: { code: "" },
  render: ({ values, context }) => {
    const code = values.code;
    const className = `site-custom-code${marginClasses(values.margin)}`;
    if (context.rawCustomCode === true) {
      if (code.trim() === "") return null;
      // biome-ignore lint/security/noDangerouslySetInnerHtml: the person's own code, for the export.
      return <div className={className} dangerouslySetInnerHTML={{ __html: code }} />;
    }
    return (
      <div className={className}>
        <span style={LABEL_STYLE}>{t("element.customCode")}</span>
        {code.trim() === "" ? (
          <p style={{ opacity: 0.6, fontStyle: "italic" }}>{t("field.customCode.empty")}</p>
        ) : (
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised, for the editor's view.
          <div dangerouslySetInnerHTML={{ __html: sanitizeCustomCode(code) }} />
        )}
      </div>
    );
  },
});

/** The custom code family (2.11): the person's own HTML, in Advanced mode. */
export const customCodeComponents: Readonly<Record<string, ComponentDef>> = {
  CustomCode: customCode,
};
