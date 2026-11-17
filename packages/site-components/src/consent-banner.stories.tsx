import type { Meta, StoryObj } from "@storybook/react-vite";
import { siteTextFor } from "@webforge/i18n/site-text";
import type { SiteAnalytics } from "@webforge/model";
import { consentBannerHtml } from "./consent-banner.js";

/**
 * Google Analytics' consent banner (3.8) as a visitor first sees it: the export writes it hidden,
 * and its script shows it until they choose, so the story shows it as the script leaves it.
 */
function ConsentBannerStory({
  analytics,
  labels,
}: {
  readonly analytics: SiteAnalytics;
  /** The site's labels in the owner's words (6.12): its own message. */
  readonly labels?: Readonly<Record<string, string>>;
}) {
  return (
    <div
      className="min-h-64 bg-base-100 text-base-content"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: the export's own HTML, made from React.
      dangerouslySetInnerHTML={{
        __html: consentBannerHtml(analytics, siteTextFor("en", labels)).replace(' hidden=""', ""),
      }}
    />
  );
}

const meta = {
  title: "Site components/Consent banner",
  component: ConsentBannerStory,
} satisfies Meta<typeof ConsentBannerStory>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The standard text, with Accept all and Decline, in the theme's page colours. */
export const Standard: Story = {
  args: { analytics: { measurementId: "G-ABC123DEF4", consentBanner: true } },
};

/** The site's own text from Site Settings. */
export const OwnText: Story = {
  args: {
    analytics: { measurementId: "G-ABC123DEF4", consentBanner: true },
    labels: {
      "siteText.consent.message":
        "Rosa's Bakery counts visits to see which cakes people look at. We'd like to set a cookie for that.",
    },
  },
};
