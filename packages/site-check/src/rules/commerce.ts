import { eachElement, httpsAddress, type NodeDoc, type SiteDoc } from "@webforge/model";
import { elementPlace, exportedPlaces } from "../fields.js";
import type { CheckRule, Finding } from "../types.js";

/**
 * A finding at each Buy button the export draws (shown, and on a page or in a shared section a
 * page holds) whose trimmed payment link `keep` picks.
 */
function buyButtons(site: SiteDoc, keep: (link: string) => boolean): Finding[] {
  const found: Finding[] = [];
  const exported = exportedPlaces(site);
  eachElement(
    site,
    (node: NodeDoc, on) => {
      if (node.type !== "BuyButton" || !exported(on)) return;
      const link = typeof node.props.link === "string" ? node.props.link.trim() : "";
      if (keep(link))
        found.push({ key: `${on}/${node.props.id}/link`, place: elementPlace({ on, node }) });
    },
    { skipHidden: true },
  );
  return found;
}

/**
 * A Buy button with no payment link (M1, F-CM-2, #858): the export leaves the button out, so
 * nothing can be bought. *Should fix* for an export, *Must fix* for publishing, as a form with
 * nowhere to send is. Jumping to it selects it, with its link in the Edit panel.
 */
export const buyButtonLinksRule: CheckRule = {
  id: "buyButtonLinks",
  level: "should",
  strictOnPublish: true,
  check: ({ site }) => buyButtons(site, (link) => link === ""),
};

/**
 * A Buy button whose payment link isn't a secure `https://` address (M1, #858): the export leaves
 * it out too, as a visitor's payment shouldn't go over an unencrypted link. *Should fix*.
 */
export const buyButtonHttpsRule: CheckRule = {
  id: "buyButtonHttps",
  level: "should",
  check: ({ site }) => buyButtons(site, (link) => link !== "" && httpsAddress(link) === undefined),
};
