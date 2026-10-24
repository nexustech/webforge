import { t } from "@webforge/i18n";
import { bindingOf } from "@webforge/model";
import type { ReactNode } from "react";
import { type Embed, mapEmbed, videoEmbed } from "../embed.js";
import { EmbedFrame, type EmbedKind } from "../embed-frame.js";
import { defineSection } from "../frame.js";
import type { ComponentDef } from "../library.js";
import type { RenderContext } from "../schema.js";
import { BodyText, SectionTitle } from "../typography.js";

const EMBED_LAYOUTS = ["stacked", "split"] as const;
const layoutVariants = EMBED_LAYOUTS.map((value) => ({
  label: t(`field.embedLayout.${value}`),
  value,
}));

/** `value` as text, if it is some: what a plain text field holds in the export. */
const plainText = (value: unknown) =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;

/**
 * A section's title and text, and its embed: above it, centred (`stacked`), or beside it on wide
 * screens (`split`). Without an embed yet, the title and text alone.
 */
function EmbedSection({
  layout,
  title,
  text,
  embed,
  kind,
  frameTitle,
}: {
  readonly layout: (typeof EMBED_LAYOUTS)[number];
  readonly title: ReactNode;
  readonly text: ReactNode;
  readonly embed: Embed | null;
  readonly kind: EmbedKind;
  readonly frameTitle: string;
}) {
  const frame = embed === null ? null : <EmbedFrame embed={embed} kind={kind} title={frameTitle} />;
  if (layout === "split" && frame !== null) {
    return (
      <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2">
        <div>
          <SectionTitle>{title}</SectionTitle>
          <BodyText className="mt-4">{text}</BodyText>
        </div>
        {frame}
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="text-center">
        <SectionTitle>{title}</SectionTitle>
        <BodyText className="mt-4">{text}</BodyText>
      </div>
      {frame}
    </div>
  );
}

/**
 * A YouTube or Vimeo video with a title and text (F-CM-4). The video loads only when the visitor
 * plays it, in YouTube's privacy-enhanced player or Vimeo's with Do Not Track; until then the page
 * asks nothing of either (C8, B7). An address that isn't a YouTube or Vimeo video shows no video.
 */
const video = defineSection({
  label: t("section.video"),
  name: "video",
  category: t("category.media"),
  variants: layoutVariants,
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    text: { kind: "richtext", label: t("field.text"), inline: true },
    address: {
      kind: "text",
      label: t("field.videoAddress"),
      help: t("field.videoAddress.help"),
    },
  },
  defaults: {
    title: t("starter.videoTitle"),
    text: `<p>${t("starter.videoText")}</p>`,
    address: "",
  },
  frame: () => "bg-base-100",
  behaviours: ["embed"],
  render: ({ values }) => (
    <EmbedSection
      layout={values.variant}
      title={values.title}
      text={values.text}
      embed={videoEmbed(plainText(values.address) ?? "")}
      kind="video"
      frameTitle={plainText(values.title) ?? t("siteText.embed.videoTitle")}
    />
  ),
});

/** The address a Map shows: its Site Settings value when bound (1.17), else its own text. */
function mapAddress(values: Readonly<Record<string, unknown>>, context: RenderContext): string {
  const key = bindingOf(values.bindings, "address");
  return (key === undefined ? plainText(values.address) : context.setting(key)) ?? "";
}

/**
 * A map of the business's address, with a title and text (F-CM-4): Google Maps' map of the
 * address, or OpenStreetMap's from a link to it. The address can be the one in Site Settings, so
 * it changes with it on every page (1.17). The map loads only when the visitor asks for it; until
 * then the page asks nothing of the map's site (C8, B7).
 */
const map = defineSection({
  label: t("section.map"),
  name: "map",
  category: t("category.contact"),
  variants: layoutVariants,
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    text: { kind: "richtext", label: t("field.text"), inline: true },
    address: {
      kind: "text",
      label: t("field.mapAddress"),
      help: t("field.mapAddress.help"),
      bindable: ["contact.address"],
    },
  },
  defaults: {
    title: t("starter.mapTitle"),
    text: `<p>${t("starter.mapText")}</p>`,
    address: "",
  },
  frame: () => "bg-base-100",
  behaviours: ["embed"],
  render: ({ values, context }) => (
    <EmbedSection
      layout={values.variant}
      title={values.title}
      text={values.text}
      embed={mapEmbed(mapAddress(values, context))}
      kind="map"
      frameTitle={plainText(values.title) ?? t("siteText.embed.mapTitle")}
    />
  ),
});

/** The embeds family: sections showing a video or a map from another site. */
export const embedsComponents: Readonly<Record<string, ComponentDef>> = {
  Video: video,
  Map: map,
};
