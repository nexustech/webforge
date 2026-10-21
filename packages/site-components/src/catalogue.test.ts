import { describe, expect, it } from "vitest";
import { BEHAVIOUR_SCRIPTS } from "./behaviours.js";
import { siteLibrary, starterLayout, starterNotFoundPage, starterPage } from "./catalogue.js";

describe("siteLibrary", () => {
  it("names components with glossary terms", () => {
    const labels = Object.fromEntries(
      Object.entries(siteLibrary.components).map(([type, def]) => [type, def.label]),
    );

    expect(labels).toEqual({
      Header: "Header",
      Footer: "Footer",
      Section: "Section",
      Hero: "Hero",
      Faq: "FAQ",
      FaqItem: "Question",
      Heading: "Heading",
      Text: "Text",
    });
  });

  it("only lets slots hold components that exist", () => {
    for (const def of Object.values(siteLibrary.components)) {
      for (const field of Object.values(def.fields)) {
        if (field.kind === "slot") {
          for (const type of field.allow ?? []) {
            expect(siteLibrary.components[type]).toBeDefined();
          }
        }
      }
    }
  });

  it("has a script for every behaviour a component declares", () => {
    for (const def of Object.values(siteLibrary.components)) {
      for (const name of def.behaviours ?? []) {
        expect(BEHAVIOUR_SCRIPTS[name]).toContain("(() => {");
      }
    }
  });
});

describe("starter content", () => {
  it("starts with a section holding a heading and text", () => {
    const page = starterPage();

    expect(page.content.map((node) => node.type)).toEqual(["Section"]);
    expect(
      (page.content[0]?.props.content as { type: string }[] | undefined)?.map((n) => n.type),
    ).toEqual(["Heading", "Text"]);
  });

  it("gives the 'Page not found' page a heading and a message, with no links (F-ED-20)", () => {
    const page = starterNotFoundPage();
    const section = page.content[0]?.props.content as { type: string; props: { text: string } }[];

    expect(section.map((node) => node.type)).toEqual(["Heading", "Text"]);
    expect(JSON.stringify(page)).not.toContain("href");
    expect(section[0]?.props.text).toBe("Sorry, this page doesn't exist");
  });

  it("puts the site name in the header, bound to Site Settings' name", () => {
    expect(starterLayout("Rosa's Bakery")).toEqual({
      header: [
        {
          type: "Header",
          props: {
            id: "header",
            siteName: "Rosa's Bakery",
            bindings: { siteName: "general.name" },
          },
        },
      ],
      footer: [{ type: "Footer", props: { id: "footer", text: "Thanks for visiting." } }],
    });
  });
});
