import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { Dialog, DialogContent } from "@webforge/editor-ui";
import type { PublishApi } from "../../shared/ipc/publish.js";
import { FileTransferDestinationForm } from "./FileTransferDestinationForm.js";

/** A host that answers every test: connected, with a host key to trust. */
const publish: Pick<PublishApi, "testConnection" | "readHostKey" | "chooseKeyFile"> = {
  testConnection: async () => ({ ok: true }),
  readHostKey: async () => ({
    status: "read",
    hostKey: "SHA256:nThbg6kXUpJWGl7E1IGOCspRomTxdCARLviKw6E5SY8",
  }),
  chooseKeyFile: async () => ({ status: "cancelled" }),
};

/** Drawn as Publish draws it (#1456): a step of its dialog, as wide. */
const inPublish: Decorator = (Story) => (
  <Dialog open>
    <DialogContent className="flex flex-col sm:max-w-2xl">
      <Story />
    </DialogContent>
  </Dialog>
);

const meta = {
  title: "Dialogs/Publish destination",
  component: FileTransferDestinationForm,
  tags: ["full-window"],
  decorators: [inPublish],
  args: { publish, onSave: () => undefined, onBack: () => undefined },
} satisfies Meta<typeof FileTransferDestinationForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A new destination: cPanel's usual folder, over FTPS. */
export const New: Story = {};

/**
 * In the app's smallest window, 960 × 600 (#1172): Test Connection, Back and Save are in view,
 * the rest folded under More Options.
 */
export const ShortWindow: Story = { tags: ["short-window"] };

/** More Options open in that window: the fields scroll, and Back and Save stay in view. */
export const ShortWindowMoreOptions: Story = {
  tags: ["short-window"],
  play: ({ canvasElement }) => {
    const more = [...canvasElement.ownerDocument.querySelectorAll("button")].find(
      (button) => button.textContent === "More Options",
    );
    more?.click();
  },
};

/** An SFTP destination signing in with a private key, its host key trusted. */
export const SftpWithKey: Story = {
  args: {
    destination: {
      protocol: "sftp",
      host: "sftp.rosasbakery.co.uk",
      user: "rosa",
      folder: "/home/rosa/public_html",
      url: "https://www.rosasbakery.co.uk",
      signIn: "key",
    },
    trust: { hostKey: "SHA256:nThbg6kXUpJWGl7E1IGOCspRomTxdCARLviKw6E5SY8" },
  },
};

/** Plain FTP chosen: its warning shows until it is accepted, once for this destination (B5). */
export const PlainFtp: Story = {
  args: {
    destination: {
      protocol: "ftp",
      host: "ftp.rosasbakery.co.uk",
      user: "rosa",
      folder: "/httpdocs",
    },
  },
};
