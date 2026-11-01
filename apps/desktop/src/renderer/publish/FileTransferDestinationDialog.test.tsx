// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FileTransferDestination, FileTransferTrust } from "@webforge/model";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublishApi } from "../../shared/ipc/publish.js";
import { FileTransferDestinationDialog, valuesOf } from "./FileTransferDestinationDialog.js";

afterEach(cleanup);

const HOST_KEY = "SHA256:nThbg6kXUpJWGl7E1IGOCspRomTxdCARLviKw6E5SY8";
const KEY_HANDLE = "6f1c2b3a-1111-4222-8333-444455556666";
const OTHER_KEY = "SHA256:AAAAg6kXUpJWGl7E1IGOCspRomTxdCARLviKw6E5SY8";

/** A publish API whose calls the test sets, each a spy. */
function fakePublish(overrides: Partial<PublishApi> = {}) {
  return {
    testConnection: vi.fn<PublishApi["testConnection"]>(async () => ({ ok: true })),
    readHostKey: vi.fn<PublishApi["readHostKey"]>(async () => ({
      status: "read",
      hostKey: HOST_KEY,
    })),
    chooseKeyFile: vi.fn<PublishApi["chooseKeyFile"]>(async () => ({ status: "cancelled" })),
    ...overrides,
  };
}

function setUp(
  destination?: FileTransferDestination,
  publish = fakePublish(),
  trust?: FileTransferTrust,
) {
  const onSave = vi.fn();
  render(
    <FileTransferDestinationDialog
      open
      destination={destination}
      trust={trust}
      publish={publish}
      onSave={onSave}
      onCancel={vi.fn()}
    />,
  );
  const user = userEvent.setup({ delay: null });
  const field = (name: string) => screen.getByLabelText(name, { exact: true });
  const fill = async (name: string, text: string) => {
    await user.clear(field(name));
    await user.type(field(name), text);
  };
  const save = () => user.click(screen.getByRole("button", { name: "Save" }));
  const testConnection = () => user.click(screen.getByRole("button", { name: "Test Connection" }));
  return { onSave, user, field, fill, save, testConnection, publish };
}

describe("a file-transfer publish destination (4.3, F-PB-1, B5)", () => {
  it("starts with cPanel's folder over FTPS, and saves the settings and the password apart", async () => {
    const { fill, save, onSave, field } = setUp();
    expect((field("Folder") as HTMLInputElement).value).toBe("/public_html");

    await fill("Host", "ftp.rosasbakery.co.uk");
    await fill("User name", "rosa");
    await fill("Password", "test-only-password");
    await fill("Web address", "https://www.rosasbakery.co.uk");
    await save();

    expect(onSave).toHaveBeenCalledWith({
      // Left unnamed, it is listed by its host.
      name: "ftp.rosasbakery.co.uk",
      destination: {
        protocol: "ftps",
        host: "ftp.rosasbakery.co.uk",
        user: "rosa",
        folder: "/public_html",
        url: "https://www.rosasbakery.co.uk",
      },
      signIn: { password: "test-only-password" },
      trust: {},
    });
  });

  it("says a host isn't a host's name or address in its own words", async () => {
    const { fill, save, onSave } = setUp();
    await fill("Host", "192.168.1.");
    await fill("User name", "rosa");
    await fill("Password", "test-only-password");
    await save();

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Use the host's name, such as ftp.example.com.")).toBeTruthy();
  });

  it("fills in Plesk's folder unless one of the person's own is typed", async () => {
    const { user, field, fill } = setUp();

    await user.selectOptions(field("Control panel"), "plesk");
    expect((field("Folder") as HTMLInputElement).value).toBe("/httpdocs");

    await fill("Folder", "/www/shop");
    await user.selectOptions(field("Control panel"), "cpanel");
    expect((field("Folder") as HTMLInputElement).value).toBe("/www/shop");
  });

  it("tests the connection as typed, and words what it found", async () => {
    const publish = fakePublish({
      testConnection: vi.fn(async () => ({ ok: false as const, code: "no-encryption" as const })),
    });
    const { fill, testConnection } = setUp(undefined, publish);
    await fill("Host", "ftp.rosasbakery.co.uk");
    await fill("User name", "rosa");
    await fill("Password", "test-only-password");

    await testConnection();

    expect(publish.testConnection).toHaveBeenCalledWith(
      { protocol: "ftps", host: "ftp.rosasbakery.co.uk", user: "rosa", folder: "/public_html" },
      { password: "test-only-password" },
      {},
    );
    expect(await screen.findByText(/doesn't offer FTPS/)).toBeTruthy();
  });

  it("warns once before plain FTP, and remembers it for the destination on this computer (S2)", async () => {
    const plain: FileTransferDestination = {
      protocol: "ftp",
      host: "ftp.rosasbakery.co.uk",
      user: "rosa",
      folder: "/httpdocs",
    };
    const { user, fill, save, onSave } = setUp(plain);
    expect(screen.getByRole("alert").textContent).toContain("Plain FTP isn't encrypted");

    await fill("Password", "test-only-password");
    await save();
    expect(onSave).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Use Plain FTP Anyway" }));
    expect(screen.queryByText("Plain FTP isn't encrypted")).toBeNull();
    await save();
    // Remembered with what this computer trusts, never in the site's settings.
    expect(onSave).toHaveBeenCalledWith({
      name: plain.host,
      destination: plain,
      signIn: { password: "test-only-password" },
      trust: { plainFtpWarned: true },
    });

    // Opened again with it, it doesn't warn.
    cleanup();
    setUp(plain, undefined, { plainFtpWarned: true });
    expect(screen.queryByText("Plain FTP isn't encrypted")).toBeNull();
  });

  it("trusts an SFTP host's key the first time, then tests with it", async () => {
    const { user, field, fill, save, onSave, testConnection, publish } = setUp();
    await user.selectOptions(field("Connection"), "sftp");
    await fill("Host", "sftp.rosasbakery.co.uk");
    await fill("User name", "rosa");
    await fill("Password", "test-only-password");
    await fill("Folder", "/home/rosa/public_html");

    // Not saved until the host's key is trusted.
    await save();
    expect(onSave).not.toHaveBeenCalled();

    await testConnection();
    expect(publish.testConnection).not.toHaveBeenCalled();
    expect(await screen.findByText(HOST_KEY, { exact: false })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Trust This Host" }));

    expect(await screen.findByText(/Connected/)).toBeTruthy();
    expect(publish.testConnection).toHaveBeenCalledWith(
      expect.objectContaining({ protocol: "sftp", signIn: "password" }),
      { password: "test-only-password" },
      { hostKey: HOST_KEY },
    );
    await save();
    // The key is trusted on this computer, never written into the site's settings (S2).
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: expect.not.objectContaining({ hostKey: expect.anything() }),
        trust: { hostKey: HOST_KEY },
      }),
    );

    // Another host is another connection: its key isn't trusted.
    onSave.mockClear();
    await fill("Host", "sftp.example.com");
    await save();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows a changed SFTP host key, to trust only knowingly", async () => {
    const publish = fakePublish({
      testConnection: vi.fn(async () => ({ ok: false as const, code: "untrusted-host" as const })),
      readHostKey: vi.fn(async () => ({ status: "read" as const, hostKey: OTHER_KEY })),
    });
    const { fill, testConnection } = setUp(
      {
        protocol: "sftp",
        host: "sftp.rosasbakery.co.uk",
        user: "rosa",
        folder: "/site",
        signIn: "password",
      },
      publish,
      { hostKey: HOST_KEY },
    );
    await fill("Password", "test-only-password");

    await testConnection();

    expect(await screen.findByText("The host's key has changed")).toBeTruthy();
    expect(screen.getByText(OTHER_KEY, { exact: false })).toBeTruthy();
  });

  it("signs in to SFTP with a key file and its passphrase", async () => {
    const publish = fakePublish({
      chooseKeyFile: vi.fn(async () => ({
        status: "chosen" as const,
        name: "id_ed25519",
        encrypted: true,
        handle: KEY_HANDLE,
      })),
    });
    const { user, field, fill, save, onSave } = setUp(
      {
        protocol: "sftp",
        host: "sftp.rosasbakery.co.uk",
        user: "rosa",
        folder: "/site",
        signIn: "password",
      },
      publish,
      { hostKey: HOST_KEY },
    );
    await user.click(screen.getByRole("radio", { name: "A private key file" }));
    expect(screen.queryByLabelText("Password")).toBeNull();
    await save();
    expect(onSave).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Choose Key File…" }));
    expect(await screen.findByText("Using id_ed25519")).toBeTruthy();
    await fill("Key passphrase", "test-only-passphrase");
    await save();

    expect(onSave).toHaveBeenCalledWith({
      name: "sftp.rosasbakery.co.uk",
      destination: expect.objectContaining({ signIn: "key" }),
      // The key's handle: its text stays in the main process.
      signIn: { keyHandle: KEY_HANDLE, passphrase: "test-only-passphrase" },
      trust: { hostKey: HOST_KEY },
    });
    expect(field("Key passphrase").getAttribute("type")).toBe("password");
  });

  it("shows a saved key as saved, with no file name to show", () => {
    render(
      <FileTransferDestinationDialog
        open
        destination={{
          protocol: "sftp",
          host: "sftp.rosasbakery.co.uk",
          user: "rosa",
          folder: "/site",
          signIn: "key",
        }}
        savedSignIn
        trust={{ hostKey: HOST_KEY }}
        publish={fakePublish()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("Using your saved key.")).toBeTruthy();
  });

  it("says why a chosen file isn't a key", async () => {
    const publish = fakePublish({
      chooseKeyFile: vi.fn(async () => ({
        status: "failed" as const,
        reason: "not-a-key" as const,
      })),
    });
    const { user, field } = setUp(undefined, publish);
    await user.selectOptions(field("Connection"), "sftp");
    await user.click(screen.getByRole("radio", { name: "A private key file" }));
    await user.click(screen.getByRole("button", { name: "Choose Key File…" }));

    expect((await screen.findByRole("alert")).textContent).toContain("isn't a private key");
  });

  it("reads a destination back into the form, never its password", () => {
    expect(
      valuesOf(
        { protocol: "ftps", host: "h.example", port: 990, user: "u", folder: "/httpdocs" },
        "Shop",
      ),
    ).toMatchObject({
      name: "Shop",
      preset: "plesk",
      port: "990",
      password: "",
      signIn: "password",
    });
  });

  it("names the destination as typed", async () => {
    const { fill, save, onSave } = setUp();
    await fill("Name", "  My shop  ");
    await fill("Host", "ftp.rosasbakery.co.uk");
    await fill("User name", "rosa");
    await fill("Password", "test-only-password");
    await save();

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: "My shop" }));
  });

  it("keeps a saved password left empty, while the host, user and key are the same (S2)", async () => {
    const saved: FileTransferDestination = {
      protocol: "sftp",
      host: "sftp.rosasbakery.co.uk",
      user: "rosa",
      folder: "/site",
      signIn: "password",
    };
    const testSaved = vi.fn(async () => ({ ok: true as const }));
    const onSave = vi.fn();
    const publish = fakePublish();
    render(
      <FileTransferDestinationDialog
        open
        destination={saved}
        name="Live"
        savedSignIn
        trust={{ hostKey: HOST_KEY }}
        publish={publish}
        testSaved={testSaved}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    const user = userEvent.setup({ delay: null });
    const field = (name: string) => screen.getByLabelText(name, { exact: true });
    expect(screen.getByText(/Leave it empty to keep it/)).toBeTruthy();

    // Tested with the saved password, which the renderer never has.
    await user.click(screen.getByRole("button", { name: "Test Connection" }));
    expect(await screen.findByText(/connected/i)).toBeTruthy();
    expect(testSaved).toHaveBeenCalledWith(saved, { hostKey: HOST_KEY });
    expect(publish.testConnection).not.toHaveBeenCalled();

    await user.clear(field("Folder"));
    await user.type(field("Folder"), "/shop");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Live", signIn: { keep: true } }),
    );

    // Another host: the password is typed again.
    onSave.mockClear();
    await user.clear(field("Host"));
    await user.type(field("Host"), "evil.example");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).not.toHaveBeenCalled();
  });
});
