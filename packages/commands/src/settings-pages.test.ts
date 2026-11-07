import { describe, expect, it } from "vitest";
import { createCommandApi } from "./api.js";
import { app, home, setup } from "./api.test-helper.js";
import { catalogueResourceText } from "./catalogue.js";

describe("the catalogue, offered (4.11, AIB-1)", () => {
  it("lists the types AI apps may add, by place, never the Header, Footer or Custom Code", () => {
    const api = createCommandApi(setup().host);

    const all = api.query("components", {});
    const sections = api.query("components", { place: "section" });

    expect(all.status).toBe("done");
    const types = (all as { data: { type: string; place: string }[] }).data;
    expect(types).toContainEqual(expect.objectContaining({ type: "Hero", place: "section" }));
    expect(types).toContainEqual(expect.objectContaining({ type: "Heading", place: "element" }));
    expect(types.map(({ type }) => type)).not.toContain("Header");
    expect(types.map(({ type }) => type)).not.toContain("CustomCode");
    const placed = (sections as { data: { place: string }[] }).data;
    expect(placed.length).toBeGreaterThan(0);
    expect(placed.every(({ place }) => place === "section")).toBe(true);
  });

  it("gives one type in full: its fields with their schemas, presets and defaults", () => {
    const api = createCommandApi(setup().host);

    const hero = api.query("components", { type: "Hero" });
    const section = api.query("components", { type: "Section" });

    expect(hero).toMatchObject({
      status: "done",
      data: {
        type: "Hero",
        label: "Hero",
        place: "section",
        fields: { title: { kind: "text", schema: expect.anything() } },
        defaults: expect.any(Object),
      },
    });
    // A slot says what it takes, not a value schema: never Custom Code.
    const slot = (section as { data: { fields: { content: { kind: string; takes: string[] } } } })
      .data.fields.content;
    expect(slot.kind).toBe("slot");
    expect(slot.takes).toContain("Heading");
    expect(slot.takes).not.toContain("CustomCode");
  });

  it("names the types there are when asked for one there isn't, or one AI apps can't add", () => {
    const api = createCommandApi(setup().host);

    for (const type of ["Carousel3000", "Header", "CustomCode"]) {
      const answer = api.query("components", { type });
      expect(answer).toMatchObject({ status: "invalid" });
      expect((answer as { message: string }).message).toMatch(
        new RegExp(`^There is no component "${type}"\\. There are: .*\\bHero\\b`),
      );
    }
  });

  it("says which types go there when addNode is given one there isn't", async () => {
    const { host, history } = setup();
    const api = createCommandApi(host);

    const atTop = await api.run(
      "addNode",
      { location: home(history), type: "Banner", values: {} },
      app,
    );
    const inSlot = await api.run(
      "addNode",
      { location: home(history), type: "Paragraph", parentId: "section", slot: "content" },
      app,
    );

    expect(atTop).toMatchObject({ status: "invalid" });
    const sections = (atTop as { message: string }).message;
    expect(sections).toMatch(/^There is no component "Banner"\. These go there: .*\bHero\b/);
    // Only sections go at the top of a page.
    expect(sections).not.toMatch(/\bHeading\b/);
    const elements = (inSlot as { message: string }).message;
    expect(elements).toMatch(/These go there: .*\bHeading\b/);
    expect(elements).not.toMatch(/\bHero\b/);
  });

  it("holds every type in full as a resource, the same as the query gives", () => {
    const api = createCommandApi(setup().host);
    const resource = JSON.parse(catalogueResourceText()) as Record<string, unknown>;

    expect(Object.keys(resource)).toEqual(
      (api.query("components", {}) as { data: { type: string }[] }).data.map(({ type }) => type),
    );
    expect(resource.Hero).toEqual(
      (api.query("components", { type: "Hero" }) as { data: unknown }).data,
    );
  });
});
