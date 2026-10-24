import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ImageMeta, MediaId } from "@webforge/model";
import { sessionWith } from "../testing/fixtures.js";
import { ImageField } from "./ImageField.js";
import { addMedia } from "./media-commands.js";

const image = (id: string, fileName: string, alt: string): ImageMeta => ({
  id: id as MediaId,
  hash: id.padEnd(64, "0"),
  name: id,
  fileName,
  kind: "image",
  mimeType: "image/jpeg",
  width: 1600,
  height: 1000,
  alt,
});

const IMAGES = [
  image("a1", "Shop front.jpg", "The shop front on a sunny morning"),
  image("b2", "Cakes.jpg", ""),
  image("c3", "Team.jpg", "The team behind the counter"),
];

/** A soft gradient in place of a photo; Storybook has no `webforge-media:` scheme. */
const placeholder = () =>
  `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 10"><defs><linearGradient id="g"><stop offset="0" stop-color="#e8a87c"/><stop offset="1" stop-color="#85cdca"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>',
  )}`;

function sessionWithImages() {
  const session = sessionWith();
  addMedia(session, IMAGES);
  return session;
}

const meta = {
  title: "Edit/ImageField",
  component: ImageField,
  args: {
    id: "field-image",
    labelId: "field-image-label",
    field: { kind: "image", label: "Image" },
    value: undefined,
    onChange: () => undefined,
    onCommit: () => undefined,
    session: sessionWithImages(),
    media: { choose: async () => ({ status: "canceled" }) as const },
    notify: () => undefined,
    imageUrl: placeholder,
  },
  // As in the Edit panel: its label above, in the right column's width.
  render: (args) => (
    <div className="flex w-60 flex-col gap-1 border border-border-strong bg-panel p-2">
      <span id="field-image-label" className="text-xs text-muted-foreground">
        Image
      </span>
      <ImageField {...args} />
    </div>
  ),
} satisfies Meta<typeof ImageField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No image placed yet. */
export const Empty: Story = {};

/** An image placed, using its own alt text from Media. */
export const Placed: Story = { args: { value: { mediaId: "a1" } } };

/** Choosing from Media's images. */
export const Choosing: Story = {
  args: { value: { mediaId: "a1", alt: "Our shop" } },
  play: ({ canvasElement }) => {
    const change = canvasElement.querySelector<HTMLButtonElement>("#field-image");
    if (change === null) throw new Error("No image field");
    change.click();
  },
};
