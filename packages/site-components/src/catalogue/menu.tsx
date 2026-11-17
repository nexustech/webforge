import { t } from "@webforge/i18n";
import type { ReactNode } from "react";
import { defineComponent } from "../define.js";
import { contentWidthClass, defineSection } from "../frame.js";
import type { ComponentDef } from "../library.js";
import { BodyText, LEAD_TEXT_CLASSES, SectionIntro, SectionTitle } from "../typography.js";

/** The starter menu: two groups of a café's dishes and drinks. */
const STARTER_ITEMS = [
  { heading: "starter.menuGroupFood", name: "starter.menuEggs", price: "starter.menuEggsPrice" },
  { heading: undefined, name: "starter.menuPorridge", price: "starter.menuPorridgePrice" },
  {
    heading: "starter.menuGroupDrinks",
    name: "starter.menuCoffee",
    price: "starter.menuCoffeePrice",
  },
  { heading: undefined, name: "starter.menuTea", price: "starter.menuTeaPrice" },
] as const;

/** Each starter item's description, by its name's key. */
const STARTER_DESCRIPTIONS = {
  "starter.menuEggs": "starter.menuEggsText",
  "starter.menuPorridge": "starter.menuPorridgeText",
  "starter.menuCoffee": "starter.menuCoffeeText",
  "starter.menuTea": "starter.menuTeaText",
} as const;

/**
 * A menu or price list (6.17a, CC-11): a title, an introduction and items, each a name and a price
 * joined by a dotted line, with a description under them, edited on the canvas and as a list in the
 * Edit panel. An item can start a group with a heading above it ("Starters", "Drinks"), so one
 * section holds the whole menu. Pricing's plans have buttons and periods a menu doesn't need, so a
 * café's dishes are items of their own. No script.
 */
const menu = defineSection({
  label: t("section.menu"),
  name: "menu",
  category: t("category.pricing"),
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    text: { kind: "richtext", label: t("field.text"), inline: true },
    items: { kind: "slot", label: t("field.menuItems"), allow: ["MenuItem"] },
  },
  defaults: {
    // A menu reads down one column: narrow enough that the dots join a name to its price.
    contentWidth: "narrow",
    title: t("starter.menuTitle"),
    text: `<p>${t("starter.menuText")}</p>`,
    items: STARTER_ITEMS.map((item, index) => ({
      type: "MenuItem",
      // Placing the section gives every item an id of its own.
      props: {
        id: `menu-item-${index}`,
        heading: item.heading === undefined ? "" : t(item.heading),
        name: t(item.name),
        price: t(item.price),
        description: `<p>${t(STARTER_DESCRIPTIONS[item.name])}</p>`,
      },
    })),
  },
  frame: () => "bg-base-100",
  render: ({ values, slots }) => {
    const Items = slots.items;
    return (
      <div className={`mx-auto ${contentWidthClass(values.contentWidth)} space-y-8`}>
        <div className="text-center">
          <SectionTitle>{values.title}</SectionTitle>
          <SectionIntro className="mt-4">{values.text}</SectionIntro>
        </div>
        <Items className="grid gap-6" />
      </div>
    );
  },
});

/** An item as the menu draws it: its group's heading if it starts one, then the item. */
function MenuItemView({
  heading,
  name,
  price,
  description,
}: {
  /** The group's heading, or empty for an item that carries on the group above. */
  readonly heading: string;
  readonly name: ReactNode;
  readonly price: ReactNode;
  readonly description: ReactNode;
}) {
  // An empty price draws no dots on the site. On the canvas a price is always there to type in.
  const hasPrice = !(typeof price === "string" && price.trim() === "");
  return (
    <div className="site-menu-item">
      {heading !== "" && (
        // A group's heading, under the section's title: the start of the menu's next part. A rule
        // under it in the text's own colour, faint, as it only shows where the group starts.
        <div className="site-menu-heading mb-4 border-b border-current/20 pt-4 pb-2">
          <SectionTitle size="small">{heading}</SectionTitle>
        </div>
      )}
      {/* The name and the price on one line, at the text's size, joined by dots that fill the
          space between them. A long name wraps, and the dots and the price line up with its last
          line. The dots are decoration: a screen reader reads the name, then the price. */}
      <div className={`flex items-baseline-last gap-2 font-semibold ${LEAD_TEXT_CLASSES}`}>
        <span className="site-menu-name">{name}</span>{" "}
        {hasPrice && (
          <>
            <span
              aria-hidden="true"
              className="site-menu-leader min-w-6 flex-1 border-b-2 border-dotted border-current/40"
            />{" "}
            <span className="site-menu-price shrink-0 text-end">{price}</span>
          </>
        )}
      </div>
      <BodyText className="mt-1">{description}</BodyText>
    </div>
  );
}

/** A dish or drink on a menu: a name, a price and a description, and a heading if it starts a group. */
const menuItem = defineComponent({
  label: t("element.menuItem"),
  place: "child",
  fields: {
    heading: {
      kind: "text",
      label: t("field.menuGroupHeading"),
      help: t("field.menuGroupHeading.help"),
    },
    name: { kind: "text", label: t("field.menuItemName"), inline: true },
    price: { kind: "text", label: t("field.menuItemPrice"), inline: true },
    description: { kind: "richtext", label: t("field.menuItemDescription"), inline: true },
  },
  defaults: {
    heading: "",
    name: t("starter.menuItemName"),
    price: t("starter.menuItemPrice"),
    description: `<p>${t("starter.menuItemText")}</p>`,
  },
  render: ({ values }) => (
    <MenuItemView
      heading={values.heading.trim()}
      name={values.name}
      price={values.price}
      description={values.description}
    />
  ),
});

/** The Food and drink menu and its dishes and drinks. */
export const menuComponents: Readonly<Record<string, ComponentDef>> = {
  Menu: menu,
  MenuItem: menuItem,
};
