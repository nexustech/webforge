import { eachElement, formServiceUnset, newsletterUnset } from "@webforge/model";
import { elementPlace, exportedPlaces } from "../fields.js";
import type { CheckRule, Finding } from "../types.js";

/** The elements that post to Site Settings' form service; a Newsletter posts to its own address. */
const SERVICE_FORMS = new Set(["ContactForm", "Form"]);

/**
 * A form with nowhere to send its messages (F-CM-1, 3.7, X5): no form service in Site Settings,
 * Netlify Forms before its publisher (4.2), an address that isn't `https://`, or a Newsletter
 * without its form address. The export draws it without an `action` and a disabled button, so a
 * visitor's message can't be lost: *Should fix* for an export, *Must fix* for publishing. Each
 * finding says whether Site Settings (`form: "service"`) or the Newsletter itself is where to fix it.
 */
export const formsRule: CheckRule = {
  id: "forms",
  level: "should",
  strictOnPublish: true,
  check: ({ site }) => {
    const found: Finding[] = [];
    const exported = exportedPlaces(site);
    const service = formServiceUnset(site.settings.forms.service);
    eachElement(
      site,
      (node, on) => {
        if (!exported(on)) return;
        const usesService = SERVICE_FORMS.has(node.type);
        const unset = usesService
          ? service
          : node.type === "Newsletter"
            ? newsletterUnset(node.props.action)
            : undefined;
        if (unset === undefined) return;
        found.push({
          key: `${on}/${node.props.id}/form`,
          place: elementPlace({ on, node }),
          values: { reason: unset, form: usesService ? "service" : "newsletter" },
        });
      },
      { skipHidden: true },
    );
    return found;
  },
};
