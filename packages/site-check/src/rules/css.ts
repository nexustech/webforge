import { eachElement } from "@webforge/model";
import { unusedCssRules } from "../css-rules.js";
import type { CheckRule, Finding } from "../types.js";

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
    const code = [site.code.js, site.code.head, site.code.bodyEnd];
    eachElement(site, (node) => {
      if (node.type === "CustomCode" && typeof node.props.code === "string") {
        code.push(node.props.code);
      }
    });
    const words = new Set(code.join("\n").match(/[\w-]+/g));
    const used = {
      classes: new Set([...usedSelectors.classes, ...words]),
      ids: new Set([...usedSelectors.ids, ...words]),
    };
    return unusedCssRules(site.code.css, used).map(
      (rule): Finding => ({
        key: `code/css/${rule.selector}`,
        place: { kind: "code", part: "css" },
        values: { selector: rule.selector },
      }),
    );
  },
};
