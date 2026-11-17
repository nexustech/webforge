import { t } from "@webforge/i18n/components";
import { createContext, type ReactNode, useContext } from "react";
import { defineComponent } from "../define.js";
import { Disclosure } from "../disclosure.js";
import { MARGIN_FIELD, marginClasses } from "../frame.js";
import type { ComponentDef } from "../library.js";
import {
  ENTRANCE_FIELDS,
  entranceAttributes,
  entranceBehaviours,
  entranceClasses,
} from "../motion.js";

/** The `<details name>` its items share while only one may be open at a time, else none. */
const AccordionGroupContext = createContext<string | undefined>(undefined);

/**
 * An Accordion (6.16a, CC-10): items that open and close, each a title over its text, inside any
 * section. Each is a native `<details>`, as the FAQ's "Questions that open" draws its questions
 * (`Disclosure`), so it opens with the keyboard and a pointer, and says so to screen readers, with
 * no script. With "One open at a time", its items share a `<details name>` unique on the page,
 * which closes the others as one opens; in a browser without it, each opens on its own.
 */
const accordion = defineComponent({
  label: t("element.accordion"),
  category: t("category.layout"),
  fields: {
    items: { kind: "slot", label: t("field.accordionItems"), allow: ["AccordionItem"] },
    oneOpen: {
      kind: "toggle",
      label: t("field.accordionOneOpen"),
      help: t("field.accordionOneOpen.help"),
    },
    margin: MARGIN_FIELD,
    ...ENTRANCE_FIELDS,
  },
  // Three sample items, so a new Accordion is edited rather than built (as the FAQ's, #1012).
  defaults: {
    oneOpen: false,
    items: [1, 2, 3].map((number) => ({
      type: "AccordionItem",
      props: {
        // Placing the element gives every item an id of its own.
        id: `accordion-item-${number}`,
        title: t("starter.accordionItemTitle", { number }),
        text: `<p>${t("starter.accordionItemText")}</p>`,
      },
    })),
  },
  behaviours: (values) => entranceBehaviours(values),
  render: ({ id, values, slots }) => {
    const Items = slots.items;
    return (
      <div
        className={`site-accordion${marginClasses(values.margin)}${entranceClasses(values)}`}
        {...entranceAttributes(values)}
      >
        <AccordionGroupContext value={values.oneOpen ? `accordion-${id}` : undefined}>
          <Items className="space-y-2" />
        </AccordionGroupContext>
      </div>
    );
  },
});

/** One item of an Accordion: a title, and the text it opens to show. */
const accordionItem = defineComponent({
  label: t("element.accordionItem"),
  place: "child",
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    text: { kind: "richtext", label: t("field.text"), inline: true },
  },
  defaults: {
    title: t("starter.accordionItemTitle", { number: 1 }),
    text: `<p>${t("starter.accordionItemText")}</p>`,
  },
  render: ({ values }) => <AccordionItemView title={values.title} text={values.text} />,
});

/** An item, in its Accordion's group when only one may be open. */
function AccordionItemView({
  title,
  text,
}: {
  readonly title: ReactNode;
  readonly text: ReactNode;
}) {
  return (
    <Disclosure
      className="site-accordion-item"
      title={title}
      group={useContext(AccordionGroupContext)}
    >
      {text}
    </Disclosure>
  );
}

/** The accordion family (6.16a): items that open and close. */
export const accordionComponents: Readonly<Record<string, ComponentDef>> = {
  Accordion: accordion,
  AccordionItem: accordionItem,
};
