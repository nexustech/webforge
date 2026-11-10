import { eachElement, type SiteDoc } from "@webforge/model";
import { type UsedSelectors, unusedCssRules } from "../css-rules.js";
import type { CheckRule, Finding } from "../types.js";

/**
 * `used` with every word of the site's own code (Custom Code elements, `custom.js`, the HTML of
 * every page) as a class and an id too: a script may add the class, or the HTML have the id.
 */
export function withCodeWords(site: SiteDoc, used: UsedSelectors): UsedSelectors {
  const code = [site.code.js, site.code.head, site.code.bodyEnd];
  eachElement(site, (node) => {
    if (node.type === "CustomCode" && typeof node.props.code === "string") {
      code.push(node.props.code);
    }
  });
  const words = code.join("\n").match(/[\w-]+/g) ?? [];
  return {
    classes: new Set([...used.classes, ...words]),
    ids: new Set([...used.ids, ...words]),
  };
}

/**
 * A rule in the site's own `custom.css` that nothing on the site matches (CT-8, 6.8): one of its
 * classes or ids is on no page, in the Header or Footer. Often a typing slip, or a rule left for a
 * section since deleted. A *Tip*: the CSS still works, and a script of the site's own may add the
 * class later, so a class or id its code names (Custom Code, `custom.js`) counts as used. Checked
 * only with the classes and ids the pages have (`usedSelectors`), which take rendering to know.
 * Each finding names the rule's selector.
 */
export const unusedCssRulesRule: CheckRule = {
  id: "unusedCssRules",
  level: "tip",
  check: ({ site, usedSelectors }) => {
    if (usedSelectors === undefined || site.code.css.trim() === "") return [];
    const used = withCodeWords(site, usedSelectors);
    return unusedCssRules(site.code.css, used).map(
      (rule): Finding => ({
        key: `code/css/${rule.selector}`,
        place: { kind: "code", part: "css" },
        values: { selector: rule.selector },
      }),
    );
  },
};
