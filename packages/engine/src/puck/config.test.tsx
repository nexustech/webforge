import type { ComponentConfig } from "@puckeditor/core";
import {
  type ComponentLibrary,
  EDITOR_RENDER_CONTEXT,
  type RenderContext,
  slotComponent,
  textValue,
} from "@webforge/site-components";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
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

  it("gives an element with bindable text a field for its bindings, so Puck leaves them as they are", () => {
    const bound = toPuckConfig({
      components: {
        Heading: {
          label: "Heading",
          fields: {
            text: { kind: "text", label: "Text", inline: true, bindable: ["contact.phone"] },
          },
          defaults: {},
          render: () => null,
        },
      },
    }).components.Heading as ComponentConfig;

    expect(bound.fields?.bindings).toEqual({ type: "object", objectFields: {} });
    expect(component("Text").fields).not.toHaveProperty("bindings");
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

describe("toPuckConfig render context", () => {
  it("renders with the context as it is at render time: no images until the app gives some", () => {
    const withImage: ComponentLibrary = {
      components: {
        Photo: {
          label: "Photo",
          fields: { image: { kind: "media", label: "Image" } },
          defaults: {},
          render: ({ context }) => <img alt="" src={context.image("shop")?.src ?? "none"} />,
        },
      },
    };
    let context: RenderContext = EDITOR_RENDER_CONTEXT;
    const config = toPuckConfig(
      withImage,
      () => 0,
      () => context,
    );
    const Photo = config.components.Photo?.render as (props: Record<string, unknown>) => ReactNode;

    expect(renderToStaticMarkup(<Photo id="p" />)).toContain('<img alt="" src="none"/>');
    context = {
      ...EDITOR_RENDER_CONTEXT,
      image: (id) => ({
        sources: [],
        src: `webforge-media://original/${id}`,
        fallback: { type: "image/jpeg", srcset: "" },
        width: 1,
        height: 1,
        alt: "",
      }),
    };
    expect(renderToStaticMarkup(<Photo id="p" />)).toContain(
      '<img alt="" src="webforge-media://original/shop"/>',
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
