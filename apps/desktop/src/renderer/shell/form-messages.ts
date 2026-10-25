import { t } from "@webforge/i18n";
import { z } from "zod";

/** What a zod issue tells a message: its kind, and what it found or wanted. */
type Issue = Parameters<z.core.$ZodErrorMap>[0];

/**
 * The editor's words for a problem a schema found that it doesn't word itself (2.21, B3): too long,
 * empty, out of range, not an email or web address. A schema's own message (the model's wording)
 * wins over these; anything else keeps zod's.
 */
function formMessage(issue: Issue): string | undefined {
  const empty = issue.input === undefined || issue.input === "";
  switch (issue.code) {
    case "invalid_type":
      return empty
        ? t("form.error.empty")
        : issue.expected === "number" || issue.expected === "int"
          ? t("form.error.number")
          : undefined;
    case "too_small":
      if (issue.origin === "string") {
        return Number(issue.minimum) <= 1
          ? t("form.error.empty")
          : t("form.error.tooShort", { min: Number(issue.minimum) });
      }
      return issue.origin === "number"
        ? t("form.error.atLeast", { min: Number(issue.minimum) })
        : undefined;
    case "too_big":
      if (issue.origin === "string") return t("form.error.tooLong", { max: Number(issue.maximum) });
      return issue.origin === "number"
        ? t("form.error.atMost", { max: Number(issue.maximum) })
        : undefined;
    case "invalid_format":
      return issue.format === "email"
        ? t("form.error.email")
        : issue.format === "url"
          ? t("form.error.url")
          : undefined;
    default:
      return undefined;
  }
}

// Every schema the renderer checks forms with uses these words: set once, when a form dialog (or the
// renderer's entry) first imports this module.
z.config({ customError: formMessage });
