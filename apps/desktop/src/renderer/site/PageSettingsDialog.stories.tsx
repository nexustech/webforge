import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ImageMeta, MediaId, PageEntry, PageId, SiteDoc } from "@webforge/model";
import { starterSite } from "../../shared/starter-site.js";
import { PageSettingsDialog } from "./PageSettingsDialog.js";

const CAKES = "cakes" as PageId;
const PHOTO = "photo" as MediaId;

/** A soft gradient in place of a photo; Storybook has no `webforge-media:` scheme. */
const placeholder = (item: ImageMeta) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${item.width} ${item.height}"><defs><linearGradient id="g"><stop offset="0" stop-color="#e8a87c"/><stop offset="1" stop-color="#85cdca"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  )}`;

/**
 * A bakery's site with a Cakes page in a folder, a web address, a description of its own and a
 * photo in Media, which the site shares unless a page has its own (3.16).
 */
function bakery(
  page: Partial<PageEntry["settings"]> & { readonly title?: string } = {},
  site: {
    readonly address?: boolean;
    readonly description?: boolean;
    readonly image?: boolean;
  } = {},
): SiteDoc {
  const doc = starterSite({ name: "Rosa's Bakery" });
  const { title = "Birthday and wedding cakes", ...settings } = page;
  doc.pages[CAKES] = {
    id: CAKES,
    kind: "page",
    slug: "cakes",
    folder: "menu",
    title,
    settings: { hideHeader: false, hideFooter: false, hideFromNavigation: false, ...settings },
    doc: { root: { props: {} }, content: [] },
  };
  doc.pageOrder = [...doc.pageOrder, CAKES];
  if (site.address !== false) doc.settings.address = { url: "https://rosasbakery.co.uk" };
  if (site.description !== false) {
    doc.settings.general.description = "Fresh bread and cakes in Hightown, baked every morning.";
  }
  if (site.image !== false) {
    doc.media[PHOTO] = {
      id: PHOTO,
      kind: "image",
      hash: "c".repeat(64),
      name: "cakes",
      fileName: "cakes.jpg",
      mimeType: "image/jpeg",
      width: 1600,
      height: 900,
      alt: "",
    };
    doc.settings.social.shareImage = PHOTO;
  }
  return doc;
}

/** Page Settings for the Cakes page of `site`. */
const settingsOf = (site: SiteDoc) => ({ site, page: site.pages[CAKES] });

const meta = {
  title: "Dialogs/PageSettings",
  component: PageSettingsDialog,
  tags: ["full-window"],
  args: {
    open: true,
    ...settingsOf(
      bakery({ description: "Layer cakes, birthday cakes and wedding cakes to order." }),
    ),
    onSave: () => undefined,
    onCancel: () => undefined,
    imageUrl: placeholder,
  },
} satisfies Meta<typeof PageSettingsDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The page as a search result and as a shared link, as the export writes them (3.16): its title
 * with the site's name, its address under the web address, its own description, the site's photo.
 */
export const SearchPreview: Story = {};

/** No description of its own: the site's, said as such. */
export const InheritedDescription: Story = { args: settingsOf(bakery()) };

/** No description anywhere: search engines pick the words themselves. */
export const NoDescription: Story = {
  args: settingsOf(bakery({}, { description: false })),
};

/** A long title and description, cut where a phone's result cuts them, with no counter. */
export const LongTitleAndDescription: Story = {
  args: settingsOf(
    bakery({
      title:
        "Birthday cakes, wedding cakes, celebration cakes and cupcakes made to order in Hightown and nearby villages",
      description:
        "From a simple sponge to a three-tier wedding cake, every cake is baked to order in our kitchen on the High Street, with free delivery within five miles, gluten-free and vegan choices, and a tasting appointment for wedding couples on Saturday mornings.",
    }),
  ),
};

/** Hidden from search engines (3.15): said instead of a result. */
export const HiddenFromSearch: Story = {
  args: settingsOf(bakery({ hideFromSearch: true })),
};

/** No web address and no photo: the file name, and what a shared link misses. */
export const NoWebAddress: Story = {
  args: settingsOf(bakery({}, { address: false, image: false })),
};
