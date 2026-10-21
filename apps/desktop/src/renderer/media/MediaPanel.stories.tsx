import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ImageMeta, MediaId, MediaMeta } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { createEditorSession } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import { MediaPanel } from "./MediaPanel.js";
import { addMedia } from "./media-commands.js";

const image = (id: string, fileName: string, width: number, height: number): ImageMeta => ({
  id: id as MediaId,
  hash: id.padEnd(64, "0"),
  name: id,
  fileName,
  kind: "image",
  mimeType: "image/jpeg",
  width,
  height,
  alt: "",
});

const ITEMS: MediaMeta[] = [
  { ...image("a1", "Shop front.jpg", 1600, 1000), alt: "The shop front on a sunny morning" },
  image("b2", "Cakes.jpg", 1200, 1200),
  image("c3", "Team.jpg", 900, 1200),
  {
    id: "d4" as MediaId,
    hash: "d4".padEnd(64, "0"),
    name: "prices",
    fileName: "Price list.pdf",
    kind: "file",
    mimeType: "application/pdf",
  },
];

/** A soft gradient in place of a photo; Storybook has no `webforge-media:` scheme. */
const placeholder = (item: ImageMeta) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${item.width} ${item.height}"><defs><linearGradient id="g"><stop offset="0" stop-color="#e8a87c"/><stop offset="1" stop-color="#85cdca"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  )}`;

function sessionWith(items: readonly MediaMeta[]) {
  const session = createEditorSession(siteLibrary, starterSite());
  addMedia(session, items);
  return session;
}

const noImport = async () => ({ status: "canceled" }) as const;

const meta = {
  title: "Panels/Media",
  component: MediaPanel,
  args: {
    session: sessionWith(ITEMS),
    media: { import: noImport, choose: noImport },
    notify: () => undefined,
    imageUrl: placeholder,
  },
  // Panel-sized, as in the right column (240 px).
  render: (args) => (
    <div className="h-[460px] w-60 border border-border-strong bg-panel">
      <MediaPanel {...args} />
    </div>
  ),
} satisfies Meta<typeof MediaPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A new site: nothing in Media yet. */
export const Empty: Story = { args: { session: sessionWith([]) } };

/** Images and a PDF. */
export const WithItems: Story = {};

/** An image chosen: focal point, alt text and crop. */
export const ImageChosen: Story = {
  args: { session: sessionWith(ITEMS) },
  play: ({ canvasElement }) => {
    const item = [...canvasElement.querySelectorAll("li button")].find((button) =>
      button.textContent?.includes("Shop front.jpg"),
    );
    if (!(item instanceof HTMLButtonElement)) throw new Error("No Shop front.jpg in the list");
    item.click();
  },
};
