import type { ComponentConfig } from "@puckeditor/core";
import {
  type ComponentDef,
  type ComponentLibrary,
  EDITOR_RENDER_CONTEXT,
  type FieldDef,
  type RenderContext,
  slotComponent,
  textValue,
} from "@webforge/site-components";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { isTextField, toPuckConfig } from "./config.js";
import { FormatToolbar, RICH_TEXT_OPTIONS } from "./rich-text.js";
import { ROOT_ZONE } from "./tree.js";

const library: ComponentLibrary = {
  components: {
    Section: {
      label: "Section",
      place: "section",
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

  it("leaves the elements in a component's defaults without ids, so Puck gives each copy its own (2.9)", () => {
    const withChildren = toPuckConfig({
      components: {
        ...library.components,
        Pair: {
          ...(library.components.Section as ComponentDef),
          place: "element",
          defaults: {
            content: [{ type: "Text", props: { id: "default-text", title: "One" } }],
          },
        },
      },
    });

    expect((withChildren.components.Pair as ComponentConfig).defaultProps).toEqual({
      content: [{ type: "Text", props: { title: "One" } }],
    });
  });

  it("maps every field kind to a Puck field", () => {
    expect(component("Text").fields).toEqual({
      title: { type: "text", label: "Title", contentEditable: false },
      body: {
        type: "richtext",
        label: "Body",
        contentEditable: true,
        options: RICH_TEXT_OPTIONS,
        renderInlineMenu: FormatToolbar,
        // The editor's name (#465), and the theme's highlight and text colour (2.25, ST-3).
        tiptap: {
          extensions: [
            expect.objectContaining({ name: "webforgeEditorName" }),
            expect.objectContaining({ name: "themeHighlight" }),
            expect.objectContaining({ name: "themeColor" }),
          ],
        },
      },
      size: { type: "select", label: "Size", options: [{ label: "Large", value: "large" }] },
      any: { type: "slot", label: "Anything" },
    });
    expect(component("Section").fields).toEqual({
      content: { type: "slot", label: "Content", allow: ["Text"] },
    });
  });

  it("gives every kind of field a Puck field (2.20, B5)", () => {
    // One field of each kind: a new kind fails the type check here until it has one, and then
    // this test until toPuckField maps it.
    const fields = {
      text: { kind: "text", label: "Text" },
      richtext: { kind: "richtext", label: "Rich text" },
      select: { kind: "select", label: "Select", options: [{ label: "A", value: "a" }] },
      toggle: { kind: "toggle", label: "Toggle" },
      slider: { kind: "slider", label: "Slider", steps: [{ label: "A", value: "a" }] },
      color: { kind: "color", label: "Colour", options: [{ label: "A", value: "a" }] },
      spacing: { kind: "spacing", label: "Spacing", options: [{ label: "A", value: "a" }] },
      box: { kind: "box", label: "Padding", property: "padding" },
      slot: { kind: "slot", label: "Slot" },
      media: { kind: "media", label: "Image" },
      link: { kind: "link", label: "Link" },
      icon: { kind: "icon", label: "Icon" },
      code: { kind: "code", label: "Code" },
      list: { kind: "list", label: "List", itemLabel: "Item", fields: {}, defaults: {} },
    } satisfies { readonly [K in FieldDef["kind"]]: Extract<FieldDef, { readonly kind: K }> };
    const every = toPuckConfig({
      components: {
        Every: { label: "Every", fields, defaults: {}, render: () => null },
      },
    });

    const mapped = (every.components.Every as ComponentConfig).fields ?? {};
    expect(Object.keys(fields).filter((kind) => mapped[kind]?.type === undefined)).toEqual([]);
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

  it("allows only the site's rich-text formatting and safe link addresses (F-ED-3)", () => {
    const { heading, underline, strike, code, codeBlock, blockquote, link } = RICH_TEXT_OPTIONS;
    expect([heading, strike, code, codeBlock, blockquote]).toEqual(Array(5).fill(false));
    // Underline, with Mod+U (2.25, ST-3).
    expect(underline).toEqual({});
    const allowed = link === false ? undefined : link?.isAllowedUri;
    const check = (url: string) =>
      allowed?.(url, { defaultValidate: () => true, protocols: [], defaultProtocol: "https" });
    expect(
      ["https://a.example", "mailto:a@b.c", "tel:+44", "webforge:page/p", "webforge:file/m"].map(
        check,
      ),
    ).toEqual([true, true, true, true, true]);
    expect(["javascript:alert(1)", "file:///c:/x", "data:text/html,x"].map(check)).toEqual([
      false,
      false,
      false,
    ]);
  });

  it("keeps labels and defaults and hides Puck's default page fields", () => {
    expect(component("Text").label).toBe("Text");
    expect(component("Text").defaultProps).toEqual({ title: "Title" });
    expect(config.root?.fields).toEqual({});
  });

  it("lets only sections go at the page's top level while editing (F-ED-1)", () => {
    const renderDropZone = vi.fn(() => null);
    const render = config.root?.render as unknown as (props: {
      puck: { isEditing: boolean; renderDropZone: typeof renderDropZone };
      children: ReactNode;
    }) => ReactNode;

    renderToStaticMarkup(
      <>{render({ puck: { isEditing: true, renderDropZone }, children: null })}</>,
    );
    // Marked, so a theme's sections can alternate on the canvas as on the page (2.13d).
    expect(renderDropZone).toHaveBeenCalledWith({
      zone: ROOT_ZONE,
      allow: ["Section"],
      className: "wf-sections",
    });

    // Static HTML has Puck's own top level.
    const html = renderToStaticMarkup(
      <>{render({ puck: { isEditing: false, renderDropZone }, children: <p>page</p> })}</>,
    );
    expect(html).toBe("<p>page</p>");
    expect(renderDropZone).toHaveBeenCalledTimes(1);
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
