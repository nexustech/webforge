import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ListedDestination } from "../../shared/ipc/publish.js";
import { PublishDialog, type PublishDialogApi } from "./PublishDialog.js";

const HOST_KEY = "SHA256:nThbg6kXUpJWGl7E1IGOCspRomTxdCARLviKw6E5SY8";

/** A site's destinations: one ready, one whose host changed since its password was saved. */
const SOME: ListedDestination[] = [
  {
    destination: {
      id: "6f1c1b6e-8a3e-4c1e-9d55-2f5c1e0a7b10",
      name: "Rosa's Bakery",
      kind: "file-transfer",
      settings: {
        protocol: "sftp",
        host: "sftp.rosasbakery.co.uk",
        user: "rosa",
        folder: "/home/rosa/public_html",
        url: "https://www.rosasbakery.co.uk",
        signIn: "password",
      },
    },
    signIn: "saved",
    trust: { hostKey: HOST_KEY },
  },
  {
    destination: {
      id: "0b9a8f6e-3c2d-4e1f-8a7b-6c5d4e3f2a10",
      name: "Old host",
      kind: "file-transfer",
      settings: {
        protocol: "ftps",
        host: "ftp.oldhost.example",
        user: "rosa",
        folder: "/httpdocs",
      },
    },
    signIn: "changed",
    trust: {},
  },
];

/** The main process's side, listing `listed`; every test connects. */
const publishWith = (listed: ListedDestination[]): PublishDialogApi => ({
  destinations: async () => ({ status: "listed", destinations: listed }),
  saveDestination: async () => ({ status: "failed", reason: "unknown" }),
  removeDestination: async () => ({ status: "removed" }),
  testSavedDestination: async () => ({ ok: true }),
  testConnection: async () => ({ ok: true }),
  readHostKey: async () => ({ status: "read", hostKey: HOST_KEY }),
  chooseKeyFile: async () => ({ status: "cancelled" }),
});

const meta = {
  title: "Dialogs/Publish",
  component: PublishDialog,
  tags: ["full-window"],
  args: {
    open: true,
    publish: publishWith(SOME),
    sessionId: () => "0c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
    notify: () => undefined,
    onSaved: () => undefined,
    onPublish: () => undefined,
    onClose: () => undefined,
  },
} satisfies Meta<typeof PublishDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two destinations: one ready to publish to, one whose password must be typed again. */
export const Destinations: Story = {};

/** A site with none yet: Add Destination is the way on. */
export const None: Story = { args: { publish: publishWith([]) } };

/** With Netlify offered (4.4b): a Netlify destination listed by its site's address. */
export const WithNetlify: Story = {
  args: {
    publish: publishWith([
      ...SOME.slice(0, 1),
      {
        destination: {
          id: "c0ffee00-1111-4222-8333-444455556666",
          name: "Rosa's Bakery on Netlify",
          kind: "netlify",
          siteId: "3d3f0a5e-1111-4222-8333-444455556666",
          url: "https://rosas-bakery.netlify.app",
        },
        signIn: "saved",
        trust: {},
      },
    ]),
    netlify: {
      canSignIn: false,
      signIn: async () => ({ status: "failed", reason: "not-set-up" }),
      cancelSignIn: () => undefined,
      forgetSignIn: () => undefined,
      signInWithToken: async () => ({ status: "failed", reason: "unauthorized" }),
      sites: async () => ({ status: "listed", sites: [] }),
      checkAccess: async () => ({ status: "checked", protected: false }),
      createSite: async () => ({ status: "failed", reason: "failed" }),
      testSaved: async () => ({ ok: true }),
      save: async () => ({ status: "failed", reason: "unknown" }),
    },
  },
};
