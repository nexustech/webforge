import type { Meta, StoryObj } from "@storybook/react-vite";
import type { SiteDoc } from "@webforge/model";
import { starterSite } from "../../shared/starter-site.js";
import { SiteSettingsDialog } from "./SiteSettingsDialog.js";

/** A bakery's site with some settings filled in. */
function bakery(): SiteDoc {
  const site = starterSite();
  site.settings.general = {
    name: "Rosa's Bakery",
    description: "Fresh bread in Hightown",
    language: "en-GB",
    // A bakery, more precisely than food and drink (3.15, SEO-1).
    businessType: "food",
    businessKind: "Bakery",
  };
  site.settings.contact = {
    email: "hello@rosasbakery.co.uk",
    phone: "+44 1234 567890",
    address: "1 High Street, Hightown",
    openingHours: [{ days: ["tue", "wed", "thu", "fri"], opens: "07:00", closes: "15:00" }],
    openingHoursNote: "Closed on bank holidays",
  };
  site.settings.social.profiles = [{ network: "instagram", url: "https://instagram.com/rosas" }];
  return site;
}

const meta = {
  title: "Dialogs/SiteSettings",
  component: SiteSettingsDialog,
  tags: ["full-window"],
  args: { open: true, site: bakery(), onSave: () => undefined, onCancel: () => undefined },
} satisfies Meta<typeof SiteSettingsDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** General: name, description, language, icon and the business type. */
export const General: Story = {};

/** Contact details and opening hours. */
export const Contact: Story = { args: { initialSection: "contact" } };

/** Social profiles and the share image. */
export const Social: Story = { args: { initialSection: "social" } };

/** Search engines: the switches and the verification codes (3.15). */
export const SearchEngines: Story = {
  args: {
    initialSection: "search",
    site: (() => {
      const site = bakery();
      site.settings.search.verification = { google: "abcDEF123_-xyzVerification" };
      return site;
    })(),
  },
};
