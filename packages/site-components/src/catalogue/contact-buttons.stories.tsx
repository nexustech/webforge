import type { Meta, StoryObj } from "@storybook/react-vite";
import { siteTextFor } from "@webforge/i18n/site-text";
import { backToTopHtml } from "../back-to-top.js";
import { consentBannerHtml } from "../consent-banner.js";
import { SiteNodes } from "../stories/site-nodes.js";
import { siteLibrary } from "./index.js";

const meta = {
  title: "Site components/Contact buttons",
  component: SiteNodes,
} satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Call, WhatsApp and Email, as the exported site pins them to the screen's bottom left. */
export const OnTheSite: Story = {
  args: {
    nodes: [
      {
        type: "ContactButtons",
        props: {
          id: "contact-buttons",
          ...siteLibrary.components.ContactButtons?.defaults,
          whatsapp: true,
          whatsappNumber: "+44 7700 900123",
        },
      },
    ],
    context: { pinned: true },
  },
};

/** A story's args, with `html` from the export drawn after the buttons. */
const besideThe = (html: string): Story => ({
  args: OnTheSite.args,
  decorators: [
    (Story) => (
      <>
        <Story />
        {/* The export's own HTML. */}
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </>
    ),
  ],
});

/** At the bottom left, clear of the back-to-top button at the bottom right. */
export const WithBackToTop: Story = besideThe(backToTopHtml(siteTextFor("en")));

/**
 * Under the cookie banner, as a visitor first sees it (its script shows it): it covers them until
 * the visitor chooses, and they never cover it.
 */
export const UnderTheCookieBanner: Story = besideThe(
  consentBannerHtml(
    { measurementId: "G-ABC123DEF4", consentBanner: true },
    siteTextFor("en"),
  ).replace(' hidden=""', ""),
);

/** As the canvas draws them: where they are on the page, after the Footer, to be selected. */
export const OnTheCanvas: Story = {
  args: {
    nodes: [
      {
        type: "ContactButtons",
        props: { id: "contact-buttons", ...siteLibrary.components.ContactButtons?.defaults },
      },
    ],
  },
};
