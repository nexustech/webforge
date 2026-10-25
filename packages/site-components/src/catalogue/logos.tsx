import { t } from "@webforge/i18n";
import type { ImageValue, LinkValue } from "@webforge/model";
import { createContext, useContext } from "react";
import { defineComponent } from "../define.js";
import { defineSection } from "../frame.js";
import { type ComponentDef, linkAttributes, linkValue } from "../library.js";
import { Picture } from "../picture.js";
import type { RenderContext } from "../schema.js";
import { SectionTitle } from "../typography.js";

const LOGOS_LAYOUTS = ["row", "grid"] as const;
type LogosLayout = (typeof LOGOS_LAYOUTS)[number];

/** The layout of the Logos section a logo is in, which draws it. */
const LogosLayoutContext = createContext<LogosLayout>("row");

/**
 * Logos of customers, partners or where the business has been featured (the spec's Logos / "As
 * seen in"): a title and logos, each an image from Media, the company's name and an optional link,
 * edited as a list in the Edit panel. Laid out in a row that wraps, or in a grid of tiles. A logo's
 * name for screen readers is its alt text, else the company's name; a linked logo without either is
 * named by where it goes, so the link always has a name.
 */
const logos = defineSection({
  label: t("section.logos"),
  name: "logos",
  category: t("category.logos"),
  variants: LOGOS_LAYOUTS.map((value) => ({ label: t(`field.logosLayout.${value}`), value })),
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    items: { kind: "slot", label: t("field.logos"), allow: ["Logo"] },
  },
  defaults: {
    title: t("starter.logosTitle"),
    items: [0, 1, 2, 3].map((index) => ({
      type: "Logo",
      // Placing the section gives every logo an id of its own.
      props: { id: `logo-${index}` },
    })),
  },
  frame: () => "bg-base-100",
  render: ({ values, slots }) => {
    const Items = slots.items;
    return (
      <div className="mx-auto max-w-6xl space-y-8 text-center">
        <SectionTitle>{values.title}</SectionTitle>
        <LogosLayoutContext value={values.variant}>
          <Items
            className={
              values.variant === "grid"
                ? "grid grid-cols-2 gap-4 md:grid-cols-4"
                : "flex flex-wrap items-center justify-center gap-x-12 gap-y-8"
            }
          />
        </LogosLayoutContext>
      </div>
    );
  },
});

/**
 * Where `link` goes, as a name: a web address's host ("example.com"), the email address or phone
 * number, or the page's name in the menu; undefined for a file or a page not in the menu.
 */
function destinationOf(link: LinkValue, href: string, context: RenderContext): string | undefined {
  switch (link.kind) {
    case "url":
      return URL.parse(link.href)?.hostname.replace(/^www\./, "");
    case "email":
      return link.address;
    case "phone":
      return link.number;
    case "page":
      return context.navigation
        .flatMap((item) => ("children" in item ? item.children : [item]))
        .find((item) => item.href === href)?.label;
    case "file":
      return undefined;
  }
}

/** A logo as its section's layout draws it: its image, linked if it has a link. */
function LogoView({
  image: placed,
  name,
  link,
  context,
}: {
  readonly image: ImageValue | undefined;
  readonly name: string;
  readonly link: unknown;
  readonly context: RenderContext;
}) {
  const layout = useContext(LogosLayoutContext);
  const image = placed === undefined ? null : context.image(placed.mediaId);
  const linked = linkValue(link);
  const attributes = linked === undefined ? undefined : linkAttributes(linked, context);
  // Its name for screen readers: the alt text, else the company's name. A linked logo is the
  // link's only content, so without either it is named by where it goes: a link must have a name.
  const described = [placed?.alt, image?.alt, name].map((text) => text?.trim() ?? "");
  const own = described.find((text) => text !== "") ?? "";
  const alt =
    own !== "" || linked === undefined || attributes === undefined
      ? own
      : destinationOf(linked, attributes.href, context) || t("siteText.logo");
  const picture =
    image === null ? (
      // Until an image is chosen: a space to see and select on the canvas, as the Gallery's.
      <span className="block h-12 w-32 rounded-box bg-base-200">
        {alt !== "" && <span className="sr-only">{alt}</span>}
      </span>
    ) : (
      <Picture
        image={image}
        alt={alt}
        sizes="160px"
        className="h-12 w-auto max-w-40 object-contain"
      />
    );
  const tile =
    layout === "grid"
      ? "site-logo flex items-center justify-center rounded-box border border-base-300 p-6"
      : "site-logo flex items-center justify-center";
  if (attributes === undefined) return <div className={tile}>{picture}</div>;
  return (
    <a className={tile} {...attributes}>
      {picture}
    </a>
  );
}

/** One logo of a Logos section: an image, the company's name and an optional link. */
const logo = defineComponent({
  label: t("element.logo"),
  place: "child",
  fields: {
    image: { kind: "media", label: t("field.image") },
    name: { kind: "text", label: t("field.logoName"), help: t("field.logoName.help") },
    link: { kind: "link", label: t("field.logoLink"), help: t("field.logoLink.help") },
  },
  defaults: {},
  render: ({ values, context }) => (
    <LogoView image={values.image} name={values.name} link={values.link} context={context} />
  ),
});

/** The Logos section and its logos. */
export const logosComponents: Readonly<Record<string, ComponentDef>> = {
  Logos: logos,
  Logo: logo,
};
