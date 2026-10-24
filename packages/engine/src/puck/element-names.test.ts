import type { NodeDoc } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { elementNames } from "./element-names.js";

describe("elementNames (F-ED-25, R8)", () => {
  const library = {
    components: { Heading: { label: "Heading", fields: {}, defaults: {}, render: () => null } },
  } as ComponentLibrary;
  const node = (id: string, type: string, layerName?: string): NodeDoc => ({
    type,
    props: { id, ...(layerName === undefined ? {} : { layerName }) },
  });

  it("names each element by its Layers name, else its component's, else its type", () => {
    const names = elementNames(
      {
        page: {
          root: { props: {} },
          content: [node("a", "Heading", " Welcome "), node("b", "Heading")],
        },
        layout: { header: [node("h", "Mystery")], footer: [] },
        shared: {},
      },
      library,
    );

    expect(Object.fromEntries(names)).toEqual({ h: "Mystery", a: "Welcome", b: "Heading" });
  });
});
