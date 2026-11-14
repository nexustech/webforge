import { t } from "@webforge/i18n";
import { contentWidthClass, defineSection } from "../frame.js";
import { type ComponentDef, linkAttributes, linkValue } from "../library.js";
import { StrokeIcon } from "../stroke-icon.js";
import { BUTTON_CLASSES } from "../typography.js";

/** Its last day, as the date field stores it, or nothing: `YYYY-MM-DD`. */
const LAST_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A thin bar of news above the Header on every page (6.4, G19): one line of text ("Closed 24–26
 * December"), a link on it if it has one, in the theme's dark colour, whose text every theme
 * keeps readable (as the Call to action's banner is), on any page's colours. Its close button and
 * last day work through the `announcement` script: the button shows only with it, and hides the
 * bar for the rest of the visit; after its last day the bar isn't shown. Without the script the
 * bar is always there. The Add panel puts it in the Header region, above the Header, so every page
 * has it; placed on a page, it's that page's.
 */
const announcementBar = defineSection({
  label: t("section.announcementBar"),
  name: "announcement-bar",
  category: t("category.basic"),
  // One line of text, no title: no Text controls for one.
  titled: false,
  fields: {
    text: { kind: "text", label: t("field.announcementText"), inline: true },
    link: { kind: "link", label: t("field.announcementLink") },
    lastDay: { kind: "text", label: t("field.announcementLastDay"), inputType: "date" },
  },
  defaults: {
    text: t("starter.announcementText"),
    lastDay: "",
    contentWidth: "full",
    // Thin: its own small padding inside, which Padding adds to.
    padding: { top: "none", bottom: "none" },
  },
  frame: () => "bg-neutral text-neutral-content",
  // A landmark of its own, so a screen reader can find it, or skip it.
  frameAttributes: (values) => ({
    "aria-label": t("siteText.announcement.label"),
    "data-wf-announcement": "",
    ...(LAST_DAY.test(values.lastDay) ? { "data-last-day": values.lastDay } : {}),
  }),
  behaviours: ["announcement"],
  render: ({ values, context }) => {
    const linked = linkValue(values.link) !== undefined;
    return (
      <div
        className={`mx-auto flex ${contentWidthClass(values.contentWidth)} items-center justify-center gap-3 py-2`}
      >
        <p className="text-center text-sm">
          {linked ? (
            <a className="link" {...linkAttributes(values.link, context)}>
              {values.text}
            </a>
          ) : (
            values.text
          )}
        </p>
        <button
          type="button"
          className={`${BUTTON_CLASSES.icon} btn-xs shrink-0`}
          aria-label={t("siteText.announcement.close")}
          title={t("siteText.announcement.close")}
          data-wf-announcement-close=""
          hidden
        >
          <StrokeIcon path="M18 6 6 18M6 6l12 12" size={16} />
        </button>
      </div>
    );
  },
});

/**
 * What goes at the top of the Header region beside the Header (6.4): the Add panel puts an
 * Announcement bar there, once, so every page has it, and the canvas deletes it like any section.
 * Everything else at the top of a region is the Header or Footer itself.
 */
export const ABOVE_THE_HEADER: ReadonlySet<string> = new Set(["AnnouncementBar"]);

/** The Announcement bar family. */
export const announcementBarComponents: Readonly<Record<string, ComponentDef>> = {
  AnnouncementBar: announcementBar,
};
