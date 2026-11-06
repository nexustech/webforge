import type { Meta, StoryObj } from "@storybook/react-vite";
import type { PublishApi } from "../../shared/ipc/publish.js";
import { FileTransferDestinationDialog } from "./FileTransferDestinationDialog.js";

/** A host that answers every test: connected, with a host key to trust. */
const publish: Pick<PublishApi, "testConnection" | "readHostKey" | "chooseKeyFile"> = {
  testConnection: async () => ({ ok: true }),
  readHostKey: async () => ({
    status: "read",
    hostKey: "SHA256:nThbg6kXUpJWGl7E1IGOCspRomTxdCARLviKw6E5SY8",
  }),
  chooseKeyFile: async () => ({ status: "cancelled" }),
};

const meta = {
  title: "Dialogs/Publish destination",
  component: FileTransferDestinationDialog,
  tags: ["full-window"],
  args: { open: true, publish, onSave: () => undefined, onCancel: () => undefined },
} satisfies Meta<typeof FileTransferDestinationDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A new destination: cPanel's usual folder, over FTPS. */
export const New: Story = {};

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
