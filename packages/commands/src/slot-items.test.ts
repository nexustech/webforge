import type { NodeDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { createCommandApi } from "./api.js";
import { app, content, home, setup } from "./api.test-helper.js";

// A section's items given as it's added (#1249): one plan builds a page, the section and what is
// in it, and the app's items take the place of the samples.

/** The home page's sections, as the test site has them now. */
const sections = (history: ReturnType<typeof setup>["history"]) => content(history);

/** The items in `node`'s `slot`, none when there's no node. */
const itemsOf = (node: NodeDoc | undefined, slot: string) => (node?.props[slot] ?? []) as NodeDoc[];

describe("addNode with its slots' items (#1249)", () => {
  it("builds a page in one plan: Features, an FAQ and a Table in a Section, with no samples", async () => {
    const { host, history, confirm } = setup();
    const api = createCommandApi(host);
    const location = home(history);
    const steps = history.state.getState().entries.length;

    const result = await api.run(
      "plan",
      {
        title: "Build the home page",
        commands: [
          {
            name: "addNode",
            input: {
              location,
              type: "Features",
              values: {
                title: "Why Rapidfix",
                items: [
                  { type: "Feature", values: { icon: "wrench", title: "Same-day repairs" } },
                  { type: "Feature", values: { icon: "shield", title: "Guaranteed work" } },
                ],
              },
            },
          },
          {
            name: "addNode",
            input: {
              location,
              type: "Faq",
              values: {
                items: [{ type: "FaqItem", values: { question: "Do you charge for a quote?" } }],
              },
            },
          },
          {
            name: "addNode",
            input: {
              location,
              type: "Section",
              values: {
                content: [
                  { type: "Heading", values: { text: "Prices" } },
                  {
                    type: "Table",
                    values: {
                      heading1: "Job",
                      rows: [
                        { type: "TableRow", values: { cell1: "Tap washer", cell2: "£40" } },
                        { type: "TableRow", values: { cell1: "Boiler service", cell2: "£80" } },
                      ],
                    },
                  },
                ],
              },
            },
          },
        ],
      },
      app,
    );

    expect(result).toMatchObject({ status: "done" });
    // One question, one undo step.
    expect(confirm).toHaveBeenCalledOnce();
    expect(history.state.getState().entries).toHaveLength(steps + 1);
    const added = sections(history).slice(-3);
    const [features, faq, section] = added;
    expect(features?.type).toBe("Features");
    expect(itemsOf(features, "items").map((item) => item.props.title)).toEqual([
      "Same-day repairs",
      "Guaranteed work",
    ]);
    expect(itemsOf(faq, "items").map((item) => item.props.question)).toEqual([
      "Do you charge for a quote?",
    ]);
    const [heading, table] = itemsOf(section, "content");
    expect(heading?.props.text).toBe("Prices");
    expect(itemsOf(table, "rows").map((row) => row.props.cell1)).toEqual([
      "Tap washer",
      "Boiler service",
    ]);
    // Every item a new id of its own, none the samples'.
    const ids = JSON.stringify(added).match(/"id":"[^"]+"/g) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
    expect(JSON.stringify(added)).not.toMatch(/feature-0|table-row-1|A good reason/);
  });

  it("keeps a slot's samples when its items aren't given", async () => {
    const { host, history } = setup();
    const api = createCommandApi(host);

    await api.run(
      "addNode",
      { location: home(history), type: "Features", values: { title: "Why us" } },
      app,
    );

    const features = sections(history).at(-1);
    expect(itemsOf(features, "items").length).toBeGreaterThan(0);
  });

  it("refuses an item its slot doesn't take, a field an item doesn't have, and items too deep", async () => {
    const { host, history } = setup();
    const api = createCommandApi(host);
    const location = home(history);
    const before = history.document.getState();

    const wrongType = await api.run(
      "addNode",
      { location, type: "Features", values: { items: [{ type: "FaqItem", values: {} }] } },
      app,
    );
    expect(wrongType).toMatchObject({
      status: "invalid",
      message: expect.stringContaining('Item 1 of "items": FaqItem can\'t go in'),
    });
    const wrongField = await api.run(
      "addNode",
      {
        location,
        type: "Features",
        values: { items: [{ type: "Feature", values: { colour: "red" } }] },
      },
      app,
    );
    expect(wrongField).toMatchObject({
      status: "invalid",
      message: expect.stringContaining('Item 1 of "items": Feature has no field "colour"'),
    });
    const notAList = await api.run(
      "addNode",
      { location, type: "Features", values: { items: "three features" } },
      app,
    );
    expect(notAList).toMatchObject({
      status: "invalid",
      message: expect.stringContaining('"items" takes a list of items'),
    });
    // A Section's Columns' Column's List's items: past the levels one command fills.
    const tooDeep = await api.run(
      "addNode",
      {
        location,
        type: "Section",
        values: {
          content: [
            {
              type: "Table",
              values: { rows: [{ type: "TableRow", values: {} }] },
            },
            {
              type: "Columns",
              values: {
                columns: [
                  {
                    type: "Column",
                    values: {
                      content: [
                        {
                          type: "List",
                          values: { items: [{ type: "ListItem", values: {} }] },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      app,
    );
    expect(tooDeep).toMatchObject({
      status: "invalid",
      message: expect.stringContaining("too deep"),
    });
    expect(history.document.getState()).toBe(before);
  });

  it("fills four levels in one command, and no more than 200 elements and items in all", async () => {
    const { host, history } = setup();
    const api = createCommandApi(host);
    const location = home(history);

    const twoColumns = await api.run(
      "addNode",
      {
        location,
        type: "Section",
        values: {
          content: [
            {
              type: "Columns",
              values: {
                columns: [
                  {
                    type: "Column",
                    values: { content: [{ type: "Heading", values: { text: "Left" } }] },
                  },
                  {
                    type: "Column",
                    values: { content: [{ type: "Heading", values: { text: "Right" } }] },
                  },
                ],
              },
            },
          ],
        },
      },
      app,
    );
    expect(twoColumns).toMatchObject({ status: "done" });
    const [columns] = itemsOf(sections(history).at(-1), "content");
    expect(
      itemsOf(columns, "columns").map(
        (column) => (column.props.content as NodeDoc[])[0]?.props.text,
      ),
    ).toEqual(["Left", "Right"]);

    const table = {
      type: "Table",
      values: { rows: Array(4).fill({ type: "TableRow", values: {} }) },
    };
    const tooMany = await api.run(
      "addNode",
      { location, type: "Section", values: { content: Array(50).fill(table) } },
      app,
    );
    expect(tooMany).toMatchObject({
      status: "invalid",
      message: expect.stringContaining("200 elements and items at most"),
    });
  });

  it("asks first when an item sets where visitors' money goes, as adding it alone would (S18)", async () => {
    const { host, history, confirm } = setup();
    const api = createCommandApi(host);

    const result = await api.run(
      "addNode",
      {
        location: home(history),
        type: "Section",
        values: {
          content: [
            {
              type: "BuyButton",
              values: { label: "Buy", link: "https://pay.example.com/rapidfix" },
            },
          ],
        },
      },
      app,
    );

    expect(result).toMatchObject({ status: "done" });
    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm.mock.calls[0]?.[0]?.description).toContain("pay.example.com");
  });
});
