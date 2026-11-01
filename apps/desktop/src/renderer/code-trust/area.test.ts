import type { SiteDoc } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { expect, it } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { describePlace } from "../site-check/index.js";
import { codeElementPlace } from "./area.js";

/** The starter site, its home page titled Home and holding a Custom Code element. */
function site(): SiteDoc {
  const base = starterSite({ name: "Rosa's" });
  const home = base.pages[base.homePageId];
  if (home === undefined) throw new Error("No home page");
  const code = { type: "CustomCode", props: { id: "code", code: "<script>count()</script>" } };
  return {
    ...base,
    layout: { ...base.layout, footer: [{ ...code, props: { ...code.props, id: "foot" } }] },
    pages: {
      ...base.pages,
      [home.id]: { ...home, title: "Home", doc: { ...home.doc, content: [code] } },
    },
  };
}

it("names a Custom Code element on a page in the prompt's own words, Site Check keeping its own (#732)", () => {
  const doc = site();
  const on = doc.homePageId;

  expect(
    codeElementPlace({ kind: "element", on, nodeId: "code", text: "" }, doc, siteLibrary),
  ).toBe("Custom Code element on Home");
  expect(
    describePlace({ key: "k", place: { kind: "element", on, nodeId: "code" } }, doc, siteLibrary),
  ).toBe("Custom Code on Home");
  // Elsewhere, as Site Check says it.
  expect(
    codeElementPlace({ kind: "element", on: "footer", nodeId: "foot", text: "" }, doc, siteLibrary),
  ).toBe("Custom Code in the Footer");
});
