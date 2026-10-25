import { t } from "@webforge/i18n";
import { defineComponent } from "../define.js";
import { MARGIN_FIELD, marginClasses } from "../frame.js";
import type { ComponentDef } from "../library.js";
import {
  ENTRANCE_FIELDS,
  entranceAttributes,
  entranceBehaviours,
  entranceClasses,
} from "../motion.js";
import { TITLE_CLASSES } from "../typography.js";

/**
 * Tabs (2.11, WCAG 2.1 AA): panels of elements under their labels. Without JavaScript, and on the
 * canvas, every panel shows in turn under its label as a heading, so nothing is ever hidden. The
 * `tabs` behaviour turns them into tabs (WAI-ARIA's tabs pattern): a list of tabs from the panels'
 * labels, one panel shown at a time, the arrow keys, Home and End moving between them. Its tab
 * buttons are copies of the template here, so their classes are in the site's CSS.
 */
const tabs = defineComponent({
  label: t("element.tabs"),
  category: t("category.layout"),
  fields: {
    tabs: { kind: "slot", label: t("field.tabs"), allow: ["Tab"] },
    margin: MARGIN_FIELD,
    ...ENTRANCE_FIELDS,
  },
  defaults: {
    tabs: [1, 2].map((number) => ({
      type: "Tab",
      props: {
        id: `tab-${number}`,
        label: t("starter.tabLabel", { number }),
        content: [
          {
            type: "Text",
            props: { id: `tab-${number}-text`, text: `<p>${t("starter.tabText")}</p>` },
          },
        ],
      },
    })),
  },
  behaviours: (values) => ["tabs", ...entranceBehaviours(values)],
  render: ({ values, slots }) => {
    const Panels = slots.tabs;
    return (
      <div
        className={`site-tabs${marginClasses(values.margin)}${entranceClasses(values)}`}
        data-wf-tabs=""
        {...entranceAttributes(values)}
      >
        {/* Filled and shown by the script. */}
        <div className="tabs tabs-border mb-6" role="tablist" data-wf-tabs-list="" hidden />
        <template data-wf-tab-button="">
          <button type="button" role="tab" className="tab tab-active" />
        </template>
        <Panels className="space-y-8" />
      </div>
    );
  },
});

/** One panel of Tabs: its label, and elements one under another. */
const tab = defineComponent({
  label: t("element.tab"),
  place: "child",
  fields: {
    label: { kind: "text", label: t("field.tabLabel"), inline: true },
    content: { kind: "slot", label: t("field.content"), accepts: "element" },
  },
  defaults: { label: t("starter.tabLabel", { number: 1 }), content: [] },
  render: ({ id, values, slots }) => {
    const Content = slots.content;
    return (
      <section className="site-tab space-y-4" id={`tab-${id}`} data-wf-tab="">
        <h3 className={TITLE_CLASSES.small} data-wf-tab-label="">
          {values.label}
        </h3>
        <Content className="space-y-4" />
      </section>
    );
  },
});

/** The tabs family (2.11): panels under labels, one shown at a time. */
export const tabsComponents: Readonly<Record<string, ComponentDef>> = {
  Tabs: tabs,
  Tab: tab,
};
