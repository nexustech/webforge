import type { ComponentConfig } from "@puckeditor/core";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { type ComponentLibrary, slotComponent, textValue } from "../library.js";
import { isTextField, toPuckConfig } from "./config.js";

const library: ComponentLibrary = {
  components: {
    Section: {
      label: "Section",
      fields: { content: { kind: "slot", label: "Content", allow: ["Text"] } },
      defaults: { content: [] },
      render: (props) => {
        const Content = slotComponent(props, "content");
        return (
          <section data-id={props.id}>
            <Content />
          </section>
        );
      },
    },
    Text: {
      label: "Text",
      fields: {
        title: { kind: "text", label: "Title" },
        body: { kind: "richtext", label: "Body" },
        size: { kind: "select", label: "Size", options: [{ label: "Large", value: "large" }] },
        any: { kind: "slot", label: "Anything" },
      },
      defaults: { title: "Title" },
      render: ({ values }) => (
        <p>
          {textValue(values.title)}|{textValue(values.size)}
        </p>
      ),
    },
  },
};

describe("toPuckConfig", () => {
  const config = toPuckConfig(library);
  const component = (type: string) => config.components[type] as ComponentConfig;

  it("maps every field kind to a Puck field", () => {
    expect(component("Text").fields).toEqual({
      title: { type: "text", label: "Title", contentEditable: false },
      body: { type: "richtext", label: "Body", contentEditable: true },
      size: { type: "select", label: "Size", options: [{ label: "Large", value: "large" }] },
      any: { type: "slot", label: "Anything" },
    });
    expect(component("Section").fields).toEqual({
      content: { type: "slot", label: "Content", allow: ["Text"] },
    });
  });

  it("keeps labels and defaults and hides Puck's default page fields", () => {
    expect(component("Text").label).toBe("Text");
    expect(component("Text").defaultProps).toEqual({ title: "Title" });
    expect(config.root).toEqual({ fields: {} });
  });

  it("passes field values, the id and slot components to render", () => {
    const Section = component("Section").render as (props: Record<string, unknown>) => ReactNode;
    const Text = component("Text").render as (props: Record<string, unknown>) => ReactNode;
    const Slot = () => <i>slot</i>;

    expect(renderToStaticMarkup(<Section id="s1" content={Slot} puck={{}} />)).toBe(
      '<section data-id="s1"><i>slot</i></section>',
    );
    expect(renderToStaticMarkup(<Section content={[]} />)).toBe('<section data-id=""></section>');
    expect(renderToStaticMarkup(<Text id="t" title="Hi" size="large" body="x" />)).toBe(
      "<p>Hi|large</p>",
    );
  });
});

describe("isTextField", () => {
  it("is true for text and rich-text fields only", () => {
    expect(isTextField(library, "Text", "title")).toBe(true);
    expect(isTextField(library, "Text", "body")).toBe(true);
    expect(isTextField(library, "Text", "size")).toBe(false);
    expect(isTextField(library, "Missing", "title")).toBe(false);
  });
});
