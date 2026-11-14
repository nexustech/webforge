import type { Meta, StoryObj } from "@storybook/react-vite";
import { AppConsentDialog, type ConsentReach, SiteConsent } from "./Consent.js";

// The assistant's consent (product/14 §5.3, AIA-6): the app's, once, as it's turned on, for each
// place requests can go; and a site's, in the panel, the first time it's used there.
const meta = { title: "Assistant/Consent", tags: ["full-window"] } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The app's consent for `reach`. */
const app = (reach: ConsentReach): Story => ({
  render: () => (
    <AppConsentDialog open reach={reach} onAgree={() => undefined} onCancel={() => undefined} />
  ),
});

/** Through OpenRouter, to a model by Anthropic. */
export const OpenRouter: Story = app({ kind: "openrouter", maker: "Anthropic" });

/** To a server the person named. */
export const Server: Story = app({ kind: "server", host: "ai.example.org" });

/** To a model on this computer: nothing leaves it. */
export const ThisComputer: Story = app({ kind: "this-computer" });

/** A site's yes, asked in the panel the first time. */
export const Site: Story = {
  render: () => (
    <div className="w-80 rounded-md border border-border bg-panel">
      <SiteConsent
        site="Rosie's Bakery"
        reach={{ kind: "openrouter", maker: "Anthropic" }}
        onAnswer={() => undefined}
      />
    </div>
  ),
};
