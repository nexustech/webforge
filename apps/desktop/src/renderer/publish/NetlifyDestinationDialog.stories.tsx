import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  type NetlifyDestinationApi,
  NetlifyDestinationDialog,
} from "./NetlifyDestinationDialog.js";

/** A Netlify account with two sites, the second with visitor access on. */
const netlify: NetlifyDestinationApi = {
  canSignIn: true,
  connect: async () => ({ status: "connected", handle: "8d2c1f0e-1111-4222-8333-444455556666" }),
  sites: async () => ({
    status: "listed",
    sites: [
      {
        id: "3d3f0a5e-1111-4222-8333-444455556666",
        name: "rosas-bakery",
        url: "https://rosas-bakery.netlify.app",
        protected: false,
      },
      {
        id: "7a1b2c3d-1111-4222-8333-444455556666",
        name: "rosas-staging",
        url: "https://rosas-staging.netlify.app",
        protected: true,
      },
    ],
  }),
};

const meta = {
  title: "Dialogs/Netlify destination",
  component: NetlifyDestinationDialog,
  tags: ["full-window"],
  args: { open: true, netlify, onSave: () => undefined, onCancel: () => undefined },
} satisfies Meta<typeof NetlifyDestinationDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A new destination: sign in, or paste a token and connect. */
export const New: Story = {};

/** Before the app has its Netlify client ID: a pasted token is the only sign-in (4.4b). */
export const TokenOnly: Story = { args: { netlify: { ...netlify, canSignIn: false } } };

/** Editing one this computer has the sign-in for: its sites listed, its own chosen. */
export const Editing: Story = {
  args: {
    editing: {
      id: "c0ffee00-1111-4222-8333-444455556666",
      name: "Rosa's Bakery on Netlify",
      siteId: "3d3f0a5e-1111-4222-8333-444455556666",
      signedIn: true,
    },
  },
};

/** A site with visitor access on, chosen: the warning that visitors must log in (ADR 0006). */
export const VisitorAccess: Story = {
  args: {
    editing: {
      id: "c0ffee00-1111-4222-8333-444455556666",
      name: "Staging",
      siteId: "7a1b2c3d-1111-4222-8333-444455556666",
      signedIn: true,
    },
  },
};
