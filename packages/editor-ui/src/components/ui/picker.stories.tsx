import type { Meta, StoryObj } from "@storybook/react-vite";
import { ImagePlusIcon } from "lucide-react";
import type { ReactNode } from "react";
import { userEvent, within } from "storybook/test";
import { Button } from "./button.js";
import { Picker, type PickerItem } from "./picker.js";

const noop = () => undefined;

/** Images as tiles of one colour each, so screenshots don't depend on files. */
const IMAGES: readonly (PickerItem & { readonly colour: string })[] = [
  { id: "cake", label: "birthday-cake.jpg", colour: "#d97757", keywords: ["cake"] },
  { id: "bread", label: "sourdough.jpg", colour: "#c9a46b" },
  { id: "shop", label: "shop-front.jpg", colour: "#5b7fa6" },
  { id: "team", label: "our-team.jpg", colour: "#7a9a6b" },
  { id: "oven", label: "oven.jpg", colour: "#8c6a9e" },
  { id: "flour", label: "flour.jpg", colour: "#d8d2c4" },
];

/** Fonts in a list, each with its category, as the font picker (2.2) will show them. */
const FONTS: readonly PickerItem[] = [
  { id: "inter", label: "Inter", category: "Sans serif" },
  { id: "lora", label: "Lora", category: "Serif" },
  { id: "merriweather", label: "Merriweather", category: "Serif" },
  { id: "jetbrains", label: "JetBrains Mono", category: "Monospace" },
];

const meta = {
  title: "Base/Picker",
  component: Picker,
  args: {
    open: true,
    onOpenChange: noop,
    title: "Choose an image",
    description: "Double-click an image, or press Enter, to place it here.",
    items: IMAGES,
    renderItem: (item: PickerItem): ReactNode => (
      <span
        className="block aspect-square w-full rounded-sm"
        style={{ background: IMAGES.find((image) => image.id === item.id)?.colour }}
      />
    ),
    onChoose: noop,
    emptyText: "Media has no images yet.",
  },
} satisfies Meta<typeof Picker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Images in a grid, on the one placed now, with *Add new…* and a preview. */
export const Images: Story = {
  args: {
    value: "shop",
    actions: (
      <Button type="button" size="sm" variant="outline">
        <ImagePlusIcon />
        Add a new image…
      </Button>
    ),
    renderPreview: (item: PickerItem) => (
      <>
        <span
          className="block aspect-[4/3] w-full rounded-sm"
          style={{ background: IMAGES.find((image) => image.id === item.id)?.colour }}
        />
        <p className="m-0 text-xs">{item.label}</p>
      </>
    ),
  },
};

/** Fonts as a list with categories, each previewed with sample text. */
export const Fonts: Story = {
  args: {
    title: "Choose a font",
    description: "Double-click a font, or press Enter, to use it.",
    items: FONTS,
    categories: ["Sans serif", "Serif", "Monospace"],
    layout: "list",
    value: "lora",
    renderItem: () => null,
    renderPreview: (item: PickerItem) => (
      <p className="m-0 text-2xl">The quick brown fox, in {item.label}.</p>
    ),
    emptyText: "No fonts.",
  },
};

/** A search that finds nothing. */
export const NoMatch: Story = {
  play: async () => {
    // The dialog is in a portal, outside the story's own element.
    await userEvent.type(within(document.body).getByRole("searchbox"), "pricing");
  },
};

/** Nothing to choose yet; *Add new…* still there. */
export const Empty: Story = {
  args: {
    items: [],
    actions: (
      <Button type="button" size="sm" variant="outline">
        <ImagePlusIcon />
        Add a new image…
      </Button>
    ),
  },
};
