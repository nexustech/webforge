import type { Meta, StoryObj } from "@storybook/react-vite";
import type { NodeDoc } from "@webforge/model";
import { SiteNodes } from "../stories/site-nodes.js";

const meta = {
  title: "Site components/Elements",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

/** `content` in a Section, as elements are placed. */
const inSection = (content: readonly NodeDoc[]): readonly NodeDoc[] => [
  { type: "Section", props: { id: "section", content } },
];

const text: NodeDoc = {
  type: "Text",
  props: { id: "text", text: "<p>Sourdough, cakes and pastries, baked every morning.</p>" },
};

/** An image as wide as its section, then a smaller one on the left with rounded corners and a caption. */
export const Images: Story = {
  args: {
    nodes: inSection([
      { type: "Image", props: { id: "wide", image: { mediaId: "photo" } } },
      {
        type: "Image",
        props: {
          id: "small",
          image: { mediaId: "photo", alt: "Our shop window" },
          width: "small",
          alignment: "left",
          rounded: true,
          caption: "The shop on Mill Street",
        },
      },
      text,
    ]),
  },
};

/** The three button styles, each size, and the alignments. */
export const Buttons: Story = {
  args: {
    nodes: inSection(
      [
        ["primary", "small", "left"],
        ["secondary", "medium", "centre"],
        ["outline", "large", "right"],
      ].map(([style, size, alignment]) => ({
        type: "Button",
        props: {
          id: `button-${style}`,
          label: "Order a cake",
          link: { kind: "url", href: "https://example.com" },
          style,
          size,
          alignment,
        },
      })),
    ),
  },
};

/** Space between two texts, then a plain line and one with a word on it. */
export const SpacersAndDividers: Story = {
  args: {
    nodes: inSection([
      text,
      { type: "Spacer", props: { id: "spacer", height: "large" } },
      { type: "Text", props: { id: "after-spacer", text: "<p>After a large space.</p>" } },
      { type: "Divider", props: { id: "line" } },
      { type: "Text", props: { id: "after-line", text: "<p>After a line.</p>" } },
      { type: "Divider", props: { id: "or", text: "or" } },
      { type: "Text", props: { id: "after-or", text: "<p>After a line with a word.</p>" } },
    ]),
  },
};

const column = (id: string, content: readonly NodeDoc[]): NodeDoc => ({
  type: "Column",
  props: { id, content },
});
const paragraph = (id: string, text: string): NodeDoc => ({
  type: "Text",
  props: { id, text: `<p>${text}</p>` },
});

/** Two equal columns, then three with the first one wider; one under another on Mobile. */
export const Columns: Story = {
  args: {
    nodes: inSection([
      {
        type: "Columns",
        props: {
          id: "two",
          layout: { $responsive: { desktop: "equal", mobile: "stacked" } },
          columns: [
            column("a", [paragraph("a-text", "Sourdough, rye and spelt, baked overnight.")]),
            column("b", [{ type: "Image", props: { id: "b-image", image: { mediaId: "photo" } } }]),
          ],
        },
      },
      {
        type: "Columns",
        props: {
          id: "three",
          layout: { $responsive: { desktop: "wideFirst", mobile: "stacked" } },
          gap: "small",
          columns: [
            column("c", [paragraph("c-text", "The wide column: our story in a few lines.")]),
            column("d", [paragraph("d-text", "Open daily.")]),
            column("e", [paragraph("e-text", "Mill Street.")]),
          ],
        },
      },
    ]),
  },
};

const items = ["Sourdough", "Cinnamon buns", "Birthday cakes"].map(
  (text, index): NodeDoc => ({ type: "ListItem", props: { id: `item-${index}`, text } }),
);

/** The three list styles: bullets, numbers, and no markers. */
export const Lists: Story = {
  args: {
    nodes: inSection(
      (["bullets", "numbers", "plain"] as const).map((style) => ({
        type: "List",
        props: {
          id: `list-${style}`,
          style,
          items: items.map((item) => ({
            ...item,
            props: { ...item.props, id: `${style}-${item.props.id}` },
          })),
        },
      })),
    ),
  },
};
