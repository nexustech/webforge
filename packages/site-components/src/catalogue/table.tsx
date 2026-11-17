import { t } from "@webforge/i18n";
import { createContext, type ReactNode, useContext } from "react";
import { defineComponent } from "../define.js";
import { MARGIN_FIELD, marginClasses } from "../frame.js";
import type { ShownAtLeast } from "../hidden-fields.js";
import type { ComponentDef } from "../library.js";
import {
  ENTRANCE_FIELDS,
  entranceAttributes,
  entranceBehaviours,
  entranceClasses,
} from "../motion.js";

/** The column numbers a Table offers, fewest first (6.16c). */
const COLUMN_COUNTS = [2, 3, 4, 5, 6] as const;
/** The column numbers, from 1 to the most a Table has. */
const COLUMNS = [1, 2, 3, 4, 5, 6] as const;
type Column = (typeof COLUMNS)[number];

/** The Table's field for column `n`'s heading, and a row's for its cell. */
const headingField = (n: Column) => `heading${n}` as const;
const cellField = (n: Column) => `cell${n}` as const;

/** Each field shown from column 3 on, by the column number `of` holds. */
function shownFromThird(
  name: (n: Column) => string,
  of?: "parent",
): Readonly<Record<string, ShownAtLeast>> {
  return Object.fromEntries(
    COLUMNS.filter((n) => n > 2).map((n) => [
      name(n),
      { field: "columns", atLeast: n, ...(of === undefined ? {} : { of }) },
    ]),
  );
}

/** How many columns a Table's `columns` value shows: 2 to 6. */
function columnCount(value: unknown): number {
  const count = Number(value);
  return COLUMN_COUNTS.some((each) => each === count) ? count : COLUMN_COUNTS[0];
}

/** `value` as text, if it is some: a heading, which is never edited on the canvas. */
const plainText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** What a Table tells its rows: its column headings, one for each column shown. */
const TableContext = createContext<readonly string[]>(["", ""]);

/**
 * The cell classes (6.16c). On a narrow screen a row stacks its cells, each with its column's
 * heading (`data-label`) beside its value; the heading row is then read by screen readers only.
 * The heading drawn there has empty alt text, so a screen reader reads it once, from the table's
 * own headings, not twice. A row's line under it and its space are its cells' (the last's, on a
 * narrow screen), not the `<tr>`'s, which the canvas draws through Puck's wrapper around it.
 * `max-md:` is the themes' phone width (48rem), which the canvas's rule for the wrapper repeats
 * (engine's puck/chrome.tsx): change both together.
 */
const CELL_CLASSES =
  "border-b border-base-300 px-3 py-2 align-top max-md:grid max-md:grid-cols-2 max-md:gap-4 max-md:border-b-0 max-md:px-0 max-md:py-1 max-md:first:pt-3 max-md:last:border-b max-md:last:pb-3 max-md:before:font-semibold max-md:before:content-[attr(data-label)_/_'']";

/**
 * A Table (6.16c, CC-10): prices, sizes or a timetable, as a real `<table>` with a heading for each
 * of its 2–6 columns and its rows under them. Fewer columns hide the last ones' headings and cells,
 * which keep their text. On a narrow screen each row stacks as heading and value pairs, with CSS
 * only. Its parts keep their table roles (`role="row"` and the rest), as some browsers drop them
 * from a table no longer drawn as one.
 */
const table = defineComponent({
  label: t("element.table"),
  category: t("category.layout"),
  fields: {
    columns: {
      kind: "select",
      label: t("field.tableColumns"),
      help: t("field.tableColumns.help"),
      options: COLUMN_COUNTS.map((count) => ({ label: String(count), value: String(count) })),
    },
    heading1: { kind: "text", label: t("field.tableHeading", { number: 1 }) },
    heading2: { kind: "text", label: t("field.tableHeading", { number: 2 }) },
    heading3: { kind: "text", label: t("field.tableHeading", { number: 3 }) },
    heading4: { kind: "text", label: t("field.tableHeading", { number: 4 }) },
    heading5: { kind: "text", label: t("field.tableHeading", { number: 5 }) },
    heading6: { kind: "text", label: t("field.tableHeading", { number: 6 }) },
    rows: { kind: "slot", label: t("field.tableRows"), allow: ["TableRow"] },
    margin: MARGIN_FIELD,
    ...ENTRANCE_FIELDS,
  },
  shownAtLeast: shownFromThird(headingField),
  defaults: {
    columns: "2",
    heading1: t("starter.tableHeading.1"),
    heading2: t("starter.tableHeading.2"),
    heading3: t("starter.tableHeading.3"),
    heading4: "",
    heading5: "",
    heading6: "",
    rows: [1, 2, 3].map((number) => ({
      type: "TableRow",
      props: {
        id: `table-row-${number}`,
        cell1: t("starter.tableCell.1"),
        cell2: t("starter.tableCell.2"),
        cell3: "",
        cell4: "",
        cell5: "",
        cell6: "",
      },
    })),
  },
  behaviours: (values) => entranceBehaviours(values),
  render: ({ values, slots }) => {
    const Rows = slots.rows;
    const headings = COLUMNS.slice(0, columnCount(values.columns)).map((n) =>
      plainText(values[headingField(n)]),
    );
    // The element is a box around its table, which its Appearance styles: a table with collapsed
    // borders takes no padding or rounded corners itself. Each part of the table says its role, as
    // a narrow screen draws it as blocks (see the Table's comment).
    return (
      <div
        className={`site-table${marginClasses(values.margin)}${entranceClasses(values)}`}
        {...entranceAttributes(values)}
      >
        <table
          className="w-full border-collapse text-left text-body max-md:block"
          // biome-ignore lint/a11y/noRedundantRoles: kept while drawn as a block
          role="table"
        >
          {/* biome-ignore lint/a11y/noRedundantRoles: kept while visually hidden */}
          <thead className="max-md:sr-only" role="rowgroup">
            {/* biome-ignore lint/a11y/noRedundantRoles: kept while visually hidden */}
            <tr className="border-b-2 border-base-300" role="row">
              {headings.map((heading, index) => (
                <th
                  // A heading's place is its column: it never moves.
                  key={index}
                  className="px-3 py-2 align-bottom font-semibold"
                  // biome-ignore lint/a11y/noRedundantRoles: kept while visually hidden
                  role="columnheader"
                  scope="col"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          {/* The slot is the table's body: on the canvas, Puck's drop zone, its rows in it. */}
          <TableContext value={headings}>
            <Rows as="tbody" className="max-md:block" />
          </TableContext>
        </table>
      </div>
    );
  },
});

/** A row's cells, one for each of its Table's columns shown, each named by its column's heading. */
function TableRowView({ cells }: { readonly cells: readonly ReactNode[] }) {
  const headings = useContext(TableContext);
  return (
    // biome-ignore lint/a11y/noRedundantRoles: kept while drawn as a block (see the Table's comment)
    <tr className="site-table-row max-md:block" role="row">
      {headings.map((heading, index) => (
        // A cell's place is its column, its key.
        // biome-ignore lint/a11y/noRedundantRoles: kept while drawn as a grid
        <td key={index} className={CELL_CLASSES} data-label={heading} role="cell">
          {cells[index]}
        </td>
      ))}
    </tr>
  );
}

/** One row of a Table: a text for each column, edited on the canvas. */
const tableRow = defineComponent({
  label: t("element.tableRow"),
  place: "child",
  fields: {
    cell1: { kind: "text", label: t("field.tableCell", { number: 1 }), inline: true },
    cell2: { kind: "text", label: t("field.tableCell", { number: 2 }), inline: true },
    cell3: { kind: "text", label: t("field.tableCell", { number: 3 }), inline: true },
    cell4: { kind: "text", label: t("field.tableCell", { number: 4 }), inline: true },
    cell5: { kind: "text", label: t("field.tableCell", { number: 5 }), inline: true },
    cell6: { kind: "text", label: t("field.tableCell", { number: 6 }), inline: true },
  },
  shownAtLeast: shownFromThird(cellField, "parent"),
  defaults: {
    cell1: t("starter.tableCell.1"),
    cell2: t("starter.tableCell.2"),
    cell3: "",
    cell4: "",
    cell5: "",
    cell6: "",
  },
  render: ({ values }) => <TableRowView cells={COLUMNS.map((n) => values[cellField(n)])} />,
});

/** The Table family (6.16c): a table of text in 2–6 columns. */
export const tableComponents: Readonly<Record<string, ComponentDef>> = {
  Table: table,
  TableRow: tableRow,
};
