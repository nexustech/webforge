import { t } from "@webforge/i18n";
import { defineComponent } from "../define.js";
import { MARGIN_FIELD, marginClasses } from "../frame.js";
import type { ComponentDef } from "../library.js";
import type { RenderContext } from "../schema.js";

/**
 * Where each network shares an address (6.17b, CC-11): its own share page, or an email, with the
 * address as its one parameter. Plain links, so nothing loads from them until a visitor follows
 * one, and nothing about the visitor goes with it but the address. The networks' names are their
 * own, never translated; Email is the site's label.
 */
const NETWORKS = [
  {
    name: (context: RenderContext) => context.siteText("siteText.shareEmail"),
    share: "mailto:?body=",
  },
  { name: () => "WhatsApp", share: "https://wa.me/?text=" },
  { name: () => "Facebook", share: "https://www.facebook.com/sharer/sharer.php?u=" },
  { name: () => "X", share: "https://x.com/intent/post?url=" },
  { name: () => "LinkedIn", share: "https://www.linkedin.com/sharing/share-offsite/?url=" },
] as const;

/**
 * Share buttons (6.17b, CC-11): links that share the post the page is by email, WhatsApp,
 * Facebook, X or LinkedIn, under "Share this post". Each carries the post's whole address, encoded,
 * and nothing else: no script, no tracker. For a Blog's design: on a page that isn't a post it
 * draws nothing. A site without its web address has no address to share, so it draws nothing
 * either, and on the canvas a hint says where to add one.
 */
const shareButtons = defineComponent({
  label: t("element.shareButtons"),
  category: t("category.blog"),
  fields: {
    margin: MARGIN_FIELD,
  },
  defaults: {},
  render: ({ values, context }) => {
    if (context.item === undefined) return null;
    const address = context.pageAddress;
    if (address === undefined) {
      const hint = context.elementHint?.("webAddress");
      return hint === undefined ? null : (
        <p className={marginClasses(values.margin).trim()}>{hint}</p>
      );
    }
    const encoded = encodeURIComponent(address);
    return (
      <div className={`site-share-buttons${marginClasses(values.margin)}`}>
        <p className="mb-2 font-semibold text-body">{context.siteText("siteText.shareButtons")}</p>
        <ul className="flex flex-wrap gap-2">
          {NETWORKS.map((network) => (
            <li key={network.share}>
              <a href={`${network.share}${encoded}`} className="btn btn-outline btn-sm">
                {network.name(context)}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  },
});

/** The Share buttons family. */
export const shareButtonsComponents: Readonly<Record<string, ComponentDef>> = {
  ShareButtons: shareButtons,
};
