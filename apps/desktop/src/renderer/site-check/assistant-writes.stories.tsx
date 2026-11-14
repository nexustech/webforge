import type { Meta, StoryObj } from "@storybook/react-vite";
import { DraftDialog, type DraftState } from "../assistant/index.js";
import { SearchResultCard } from "../site/index.js";

// Site Check's Write One… (G25b, SEO-10, #873): the assistant's description of a page, shown as a
// search result, and its alt text for an image, for the person to change before it's kept.
const meta = { title: "Site Check/Write One", tags: ["full-window"] } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const DESCRIPTION = "Sourdough, rye and seasonal cakes, baked every morning in Leeds since 2009.";

/** The dialog for a description at `state`. */
const description = (state: DraftState): Story => ({
  render: () => (
    <DraftDialog
      open
      title="Write a Description"
      description="The assistant's description of Menu, for search results and shares. Change it as you like: nothing changes until you use it."
      label="Description"
      maxLength={300}
      state={state}
      preview={(text) => (
        <SearchResultCard
          preview={{
            title: "Menu | Rosie's Bakery",
            address: "https://rosiesbakery.co.uk/menu",
            host: "rosiesbakery.co.uk",
            description: text,
            inherited: false,
            hidden: undefined,
            image: undefined,
          }}
        />
      )}
      onSiteAnswer={() => undefined}
      onUse={() => undefined}
      onAgain={() => undefined}
      onCancel={() => undefined}
    />
  ),
});

/** A page's description, drafted: as a search result shows it. */
export const Description: Story = description({ step: "draft", texts: [DESCRIPTION] });

/** Waiting for the assistant. */
export const Writing: Story = description({ step: "writing" });

/** An image's alt text, drafted from its file's name and the text near it. */
export const AltText: Story = {
  render: () => (
    <DraftDialog
      open
      title="Write Alt Text"
      description="The assistant's alt text for sourdough-loaf.jpg, from its file's name and the text near it. It can't see the picture, so check it says what the picture shows: nothing changes until you use it."
      label="Alt text"
      maxLength={250}
      state={{ step: "draft", texts: ["A round sourdough loaf on a floured board"] }}
      onSiteAnswer={() => undefined}
      onUse={() => undefined}
      onAgain={() => undefined}
      onCancel={() => undefined}
    />
  ),
};
