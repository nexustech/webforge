import type { Meta, StoryObj } from "@storybook/react-vite";
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

/**
 * With the back-to-top button at the bottom right, and the cookie banner as a visitor first sees
 * it (its script shows it): the buttons cover neither, and the banner covers them until the
 * visitor chooses.
 */
const NEIGHBOURS = `${backToTopHtml()}${consentBannerHtml({
  measurementId: "G-ABC123DEF4",
  consentBanner: true,
}).replace(' hidden=""', "")}`;

/** Beside the back-to-top button, and under the cookie banner. */
export const WithBackToTopAndCookieBanner: Story = {
  args: OnTheSite.args,
  decorators: [
    (Story) => (
      <>
        <Story />
        <div
          // biome-ignore lint/security/noDangerouslySetInnerHtml: the export's own HTML for both.
          dangerouslySetInnerHTML={{ __html: NEIGHBOURS }}
        />
      </>
    ),
  ],
};

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
