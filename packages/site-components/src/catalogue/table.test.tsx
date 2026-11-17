import { t } from "@webforge/i18n";
import type { NodeDoc } from "@webforge/model";
import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { CATALOGUE, hiddenFieldsOf } from "../catalogue-data.js";
import { EDITOR_RENDER_CONTEXT, fieldsHiddenBy } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import { siteLibrary } from "./index.js";

const windows: Window[] = [];
afterEach(async () => {
  for (const happy of windows.splice(0)) await happy.happyDOM.close();
});

/** A page of `nodes`, to query. */
function page(nodes: readonly NodeDoc[]) {
  const happy = new Window();
  windows.push(happy);
  happy.document.body.innerHTML = renderNodesToHtml(nodes, siteLibrary, EDITOR_RENDER_CONTEXT);
  return happy.document;
}

/** A price list of three columns, with `props` over that. */
const prices = (props: Record<string, unknown> = {}): NodeDoc => ({
  type: "Table",
  props: {
    id: "prices",
    columns: "3",
    heading1: "Cake",
    heading2: "Serves",
    heading3: "Price",
    heading4: "Kept",
    rows: [
      ["Lemon drizzle", "8", "£18", "hidden"],
      ["Chocolate", "12", "£24", "hidden"],
    ].map(([cell1, cell2, cell3, cell4], index) => ({
      type: "TableRow",
      props: { id: `row-${index}`, cell1, cell2, cell3, cell4 },
    })),
    ...props,
  },
});

/** The texts of `selector`'s matches in `doc`. */
const texts = (doc: ReturnType<typeof page>, selector: string) =>
  [...doc.querySelectorAll(selector)].map((each) => each.textContent);

describe("the Table (6.16c)", () => {
  it("starts with two columns, their headings and three rows", () => {
    const defaults = siteLibrary.components.Table?.defaults;
    const doc = page([{ type: "Table", props: { id: "table", ...defaults } }]);

    expect(texts(doc, "th")).toEqual([t("starter.tableHeading.1"), t("starter.tableHeading.2")]);
    expect(doc.querySelectorAll("tbody > tr")).toHaveLength(3);
    expect(texts(doc, "tbody > tr:first-child > td")).toEqual([
      t("starter.tableCell.1"),
      t("starter.tableCell.2"),
    ]);
  });

  it("is a real table, its rows straight in its body, each heading a column's", () => {
    const doc = page([prices()]);

    const table = doc.querySelector(".site-table > table");
    expect(table?.querySelector(":scope > thead > tr")?.children).toHaveLength(3);
    expect(table?.querySelectorAll(":scope > tbody > tr.site-table-row")).toHaveLength(2);
    expect([...doc.querySelectorAll("th")].every((th) => th.getAttribute("scope") === "col")).toBe(
      true,
    );
    // Its parts keep their roles while a narrow screen stacks them.
    expect(table?.getAttribute("role")).toBe("table");
    expect(doc.querySelector("tbody td")?.getAttribute("role")).toBe("cell");
  });

  it("names each cell by its column's heading, for a narrow screen", () => {
    const doc = page([prices()]);

    expect(
      [...doc.querySelectorAll("tbody > tr:first-child > td")].map((td) =>
        td.getAttribute("data-label"),
      ),
    ).toEqual(["Cake", "Serves", "Price"]);
  });

  it("draws only the columns it has: fewer leave the last ones' headings and cells out", () => {
    const three = page([prices()]);
    const two = page([prices({ columns: "2" })]);

    expect(texts(three, "th")).toEqual(["Cake", "Serves", "Price"]);
    expect(texts(three, "tbody > tr:first-child > td")).toEqual(["Lemon drizzle", "8", "£18"]);
    expect(texts(two, "th")).toEqual(["Cake", "Serves"]);
    expect(texts(two, "tbody > tr:first-child > td")).toEqual(["Lemon drizzle", "8"]);
    expect(two.body.textContent).not.toContain("£18");
  });

  it("hides the headings past its Columns in the Edit panel, keeping their text", () => {
    const def = siteLibrary.components.Table;
    const values = { ...def?.defaults, columns: "4" };

    const hidden = def === undefined ? [] : [...fieldsHiddenBy(def, values)];
    expect(hidden.filter((name) => name.startsWith("heading"))).toEqual(["heading5", "heading6"]);
  });

  it("hides a row's cells past its Table's Columns, from the Table holding it", () => {
    const row = siteLibrary.components.TableRow;
    const values = { ...row?.defaults };
    const parent = { type: "Table", values: { columns: "3" } };

    expect(row && [...fieldsHiddenBy(row, values, { menuLinksToSections: false, parent })]).toEqual(
      ["cell4", "cell5", "cell6"],
    );
    // Without a Table, as nowhere a row can be, nothing is hidden.
    expect(row && [...fieldsHiddenBy(row, values)]).toEqual([]);
  });

  it("hides them alike as data, as Site Check reads it", () => {
    const row = CATALOGUE.TableRow;

    expect(row && [...hiddenFieldsOf(row, { ...row.defaults }, { columns: "5" })]).toEqual([
      "cell6",
    ]);
  });
});
