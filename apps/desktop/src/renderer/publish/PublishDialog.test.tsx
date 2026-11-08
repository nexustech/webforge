// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PublishDestination } from "@webforge/model";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ListedDestination, PublishApi } from "../../shared/ipc/publish.js";
import { type NetlifyPublishApi, PublishDialog, type PublishDialogApi } from "./PublishDialog.js";

afterEach(cleanup);

const SESSION = "0c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const HOST_KEY = "SHA256:nThbg6kXUpJWGl7E1IGOCspRomTxdCARLviKw6E5SY8";

const live: PublishDestination = {
  id: "6f1c1b6e-8a3e-4c1e-9d55-2f5c1e0a7b10",
  name: "Live",
  kind: "file-transfer",
  settings: {
    protocol: "sftp",
    host: "sftp.rosasbakery.co.uk",
    user: "rosa",
    folder: "/public_html",
    url: "https://www.rosasbakery.co.uk/",
    signIn: "password",
  },
};
const old: PublishDestination = {
  id: "0b9a8f6e-3c2d-4e1f-8a7b-6c5d4e3f2a10",
  name: "Old host",
  kind: "file-transfer",
  settings: { protocol: "ftps", host: "ftp.old.example", user: "rosa", folder: "/" },
};

/** The main process's side, listing `listed` and changing it as asked; each call a spy. */
function fakePublish(listed: ListedDestination[]) {
  let list = [...listed];
  return {
    destinations: vi.fn<PublishApi["destinations"]>(async () => ({
      status: "listed",
      destinations: list,
    })),
    saveDestination: vi.fn<PublishApi["saveDestination"]>(async (_session, draft) => {
      const destination: PublishDestination = {
        id: draft.id ?? "4f9a2c1e-7b3d-4a5e-9c8f-1d2e3f4a5b6c",
        name: draft.name,
        kind: "file-transfer",
        settings: draft.settings as Extract<
          PublishDestination,
          { kind: "file-transfer" }
        >["settings"],
      };
      list = [
        ...list.filter((each) => each.destination.id !== destination.id),
        { destination, signIn: "saved", trust: {} },
      ];
      return { status: "saved", destination };
    }),
    removeDestination: vi.fn<PublishApi["removeDestination"]>(async (_session, id) => {
      list = list.filter((each) => each.destination.id !== id);
      return { status: "removed" };
    }),
    testSavedDestination: vi.fn<PublishApi["testSavedDestination"]>(async () => ({ ok: true })),
    testConnection: vi.fn<PublishApi["testConnection"]>(async () => ({ ok: true })),
    readHostKey: vi.fn<PublishApi["readHostKey"]>(async () => ({
      status: "read",
      hostKey: HOST_KEY,
    })),
    chooseKeyFile: vi.fn<PublishApi["chooseKeyFile"]>(async () => ({ status: "cancelled" })),
  } satisfies PublishDialogApi;
}

function setUp(listed: ListedDestination[] = [], publish = fakePublish(listed)) {
  const notify = vi.fn();
  const onSaved = vi.fn();
  const onPublish = vi.fn();
  render(
    <PublishDialog
      open
      publish={publish}
      sessionId={() => SESSION}
      notify={notify}
      onSaved={onSaved}
      onPublish={onPublish}
      onClose={vi.fn()}
    />,
  );
  const user = userEvent.setup({ delay: null });
  return { publish, notify, onSaved, onPublish, user };
}

describe("the Publish dialog's destinations (4.4a, F-PB-1)", () => {
  it("lists each destination by name, where it is, and whether its password is here", async () => {
    setUp([
      { destination: live, signIn: "saved", trust: { hostKey: HOST_KEY } },
      { destination: old, signIn: "changed", trust: {} },
    ]);

    const rows = await screen.findAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("sftp.rosasbakery.co.uk · /public_html"),
      expect.stringContaining("Its host changed since the password was saved here"),
    ]);
    // A destination whose password isn't saved for it can't be tested until it's typed again.
    const second = within(rows[1] as HTMLElement);
    expect(
      (second.getByRole("button", { name: "Test the connection to Old host" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("publishes to a destination as its first action, once its password is here (4.5)", async () => {
    const { onPublish, user } = setUp([
      { destination: live, signIn: "saved", trust: { hostKey: HOST_KEY } },
      { destination: old, signIn: "changed", trust: {} },
    ]);

    const rows = await screen.findAllByRole("listitem");
    const first = within(rows[0] as HTMLElement);
    const second = within(rows[1] as HTMLElement);
    expect(first.getAllByRole("button")[0]?.getAttribute("aria-label")).toBe("Publish to Live");
    expect(
      (second.getByRole("button", { name: "Publish to Old host" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await user.click(screen.getByRole("button", { name: "Publish to Live" }));
    expect(onPublish).toHaveBeenCalledWith(live);
  });

  it("says when there are none yet", async () => {
    setUp();
    expect((await screen.findByRole("status")).textContent).toContain("No destinations yet");
  });

  it("adds a destination with 4.3's form, and tells the window it was saved", async () => {
    const { user, publish, onSaved } = setUp();
    await user.click(await screen.findByRole("button", { name: "Add Destination" }));

    const form = within(await screen.findByRole("dialog", { name: "Publish to your web host" }));
    await user.type(form.getByLabelText("Host", { exact: true }), "ftp.rosasbakery.co.uk");
    await user.type(form.getByLabelText("User name", { exact: true }), "rosa");
    await user.type(form.getByLabelText("Password", { exact: true }), "test-only-password");
    await user.click(form.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(publish.saveDestination).toHaveBeenCalledWith(
      SESSION,
      {
        name: "ftp.rosasbakery.co.uk",
        settings: expect.objectContaining({ protocol: "ftps", host: "ftp.rosasbakery.co.uk" }),
      },
      { password: "test-only-password" },
      {},
    );
    // The list is read again, with the new one in it.
    expect(await screen.findByText("ftp.rosasbakery.co.uk", { selector: "p" })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Publish to your web host" })).toBeNull();
  });

  it("starts each Add afresh: nothing typed or trusted in the last one stays", async () => {
    const { user } = setUp();
    await user.click(await screen.findByRole("button", { name: "Add Destination" }));
    let form = within(await screen.findByRole("dialog", { name: "Publish to your web host" }));
    await user.type(form.getByLabelText("Host", { exact: true }), "ftp.rosasbakery.co.uk");
    await user.click(form.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Publish to your web host" })).toBeNull(),
    );

    await user.click(screen.getByRole("button", { name: "Add Destination" }));
    form = within(await screen.findByRole("dialog", { name: "Publish to your web host" }));
    expect((form.getByLabelText("Host", { exact: true }) as HTMLInputElement).value).toBe("");
  });

  it("edits a destination, keeping its saved password when none is typed", async () => {
    const { user, publish } = setUp([
      { destination: live, signIn: "saved", trust: { hostKey: HOST_KEY } },
    ]);
    await user.click(await screen.findByRole("button", { name: "Edit Live" }));

    const form = within(await screen.findByRole("dialog", { name: "Publish to your web host" }));
    expect((form.getByLabelText("Name", { exact: true }) as HTMLInputElement).value).toBe("Live");
    expect((form.getByLabelText("Password", { exact: true }) as HTMLInputElement).value).toBe("");
    await user.click(form.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(publish.saveDestination).toHaveBeenCalledWith(
        SESSION,
        { id: live.id, name: "Live", settings: live.kind === "file-transfer" ? live.settings : {} },
        { keep: true },
        { hostKey: HOST_KEY },
      ),
    );
  });

  it("tests a saved destination with its saved password, in main", async () => {
    const { user, publish } = setUp([
      { destination: live, signIn: "saved", trust: { hostKey: HOST_KEY } },
    ]);
    await user.click(await screen.findByRole("button", { name: "Test the connection to Live" }));

    expect(await screen.findByText(/Connected/)).toBeTruthy();
    expect(publish.testSavedDestination).toHaveBeenCalledWith(
      SESSION,
      live.id,
      live.kind === "file-transfer" ? live.settings : undefined,
      { hostKey: HOST_KEY },
    );
  });

  it("removes a destination once the person confirms", async () => {
    const { user, publish } = setUp([{ destination: old, signIn: "saved", trust: {} }]);
    await user.click(await screen.findByRole("button", { name: "Remove Old host" }));

    const question = within(await screen.findByRole("alertdialog", { name: "Remove 'Old host'?" }));
    await user.click(question.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(publish.removeDestination).toHaveBeenCalledWith(SESSION, old.id));
    expect(await screen.findByText(/No destinations yet/)).toBeTruthy();
  });

  it("says why a change didn't happen, keeping the form open", async () => {
    const publish = fakePublish([]);
    publish.saveDestination.mockResolvedValueOnce({ status: "failed", reason: "no-keychain" });
    const { user, notify } = setUp([], publish);
    await user.click(await screen.findByRole("button", { name: "Add Destination" }));
    const form = within(await screen.findByRole("dialog", { name: "Publish to your web host" }));
    await user.type(form.getByLabelText("Host", { exact: true }), "ftp.rosasbakery.co.uk");
    await user.type(form.getByLabelText("User name", { exact: true }), "rosa");
    await user.type(form.getByLabelText("Password", { exact: true }), "test-only-password");
    await user.click(form.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        "This computer can't keep passwords safely, so Webforge can't save one.",
      ),
    );
    expect(screen.getByRole("dialog", { name: "Publish to your web host" })).toBeTruthy();
  });
});

describe("the Publish dialog's Netlify destinations (4.4b)", () => {
  const SITE = {
    id: "3d3f0a5e-1111-4222-8333-444455556666",
    name: "rosas-bakery",
    url: "https://rosas-bakery.netlify.app",
  };
  const netlifyDestination: PublishDestination = {
    id: "c0ffee00-1111-4222-8333-444455556666",
    name: "On Netlify",
    kind: "netlify",
    siteId: SITE.id,
    url: SITE.url,
  };

  /** Netlify's side: one site, a new one made on request, and saving; each call a spy. */
  function fakeNetlify() {
    return {
      canSignIn: false,
      signIn: vi.fn<NetlifyPublishApi["signIn"]>(async () => ({
        status: "failed",
        reason: "not-set-up",
      })),
      cancelSignIn: vi.fn(),
      forgetSignIn: vi.fn(),
      signInWithToken: vi.fn<NetlifyPublishApi["signInWithToken"]>(async () => ({
        status: "signed-in",
        handle: "8d2c1f0e-1111-4222-8333-444455556666",
      })),
      testSaved: vi.fn<NetlifyPublishApi["testSaved"]>(async () => ({ ok: true })),
      sites: vi.fn<NetlifyPublishApi["sites"]>(async () => ({ status: "listed", sites: [SITE] })),
      checkAccess: vi.fn<NetlifyPublishApi["checkAccess"]>(async () => ({
        status: "checked",
        protected: false,
      })),
      createSite: vi.fn<NetlifyPublishApi["createSite"]>(async () => ({
        status: "created",
        site: {
          id: "9e8d7c6b-1111-4222-8333-444455556666",
          name: "brave-otter-1a2b",
          url: "https://brave-otter-1a2b.netlify.app",
        },
      })),
      save: vi.fn<NetlifyPublishApi["save"]>(async (draft) => ({
        status: "saved",
        destination: {
          id: draft.id ?? "4f9a2c1e-7b3d-4a5e-9c8f-1d2e3f4a5b6c",
          name: draft.name,
          kind: "netlify",
          siteId: draft.site.id,
          ...(draft.site.url === undefined ? {} : { url: draft.site.url }),
        },
      })),
    };
  }

  function setUpNetlify(listed: ListedDestination[], netlify = fakeNetlify()) {
    const onSaved = vi.fn();
    const onPublish = vi.fn();
    render(
      <PublishDialog
        open
        publish={fakePublish(listed)}
        netlify={netlify}
        sessionId={() => SESSION}
        notify={vi.fn()}
        onSaved={onSaved}
        onPublish={onPublish}
        onClose={vi.fn()}
      />,
    );
    return { netlify, onSaved, onPublish, user: userEvent.setup({ delay: null }) };
  }

  it("adds one through Add Destination › Netlify…, making a new site Netlify names", async () => {
    const { netlify, onSaved, user } = setUpNetlify([]);
    await user.click(await screen.findByRole("button", { name: "Add Destination" }));
    await user.click(await screen.findByRole("menuitem", { name: "Netlify…" }));

    const dialog = await screen.findByRole("dialog", { name: "Add a Netlify Destination" });
    await user.type(within(dialog).getByLabelText("Personal access token"), "nfp_token");
    await user.click(within(dialog).getByRole("button", { name: "Connect" }));
    await user.selectOptions(await within(dialog).findByLabelText("Netlify site"), "new");
    await user.click(within(dialog).getByRole("button", { name: "Save Destination" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(netlify.createSite).toHaveBeenCalledWith(
      { handle: "8d2c1f0e-1111-4222-8333-444455556666" },
      undefined,
    );
    // Unnamed, as its site was: listed by the name Netlify gave the site.
    expect(netlify.save).toHaveBeenCalledWith(
      {
        name: "brave-otter-1a2b",
        site: {
          id: "9e8d7c6b-1111-4222-8333-444455556666",
          name: "brave-otter-1a2b",
          url: "https://brave-otter-1a2b.netlify.app",
        },
      },
      { handle: "8d2c1f0e-1111-4222-8333-444455556666" },
    );
  });

  it("makes a new site once: a second Save, or one after a failed save, uses it (#826 review)", async () => {
    const netlify = fakeNetlify();
    netlify.save.mockResolvedValueOnce({ status: "failed", reason: "unknown" });
    const { onSaved, user } = setUpNetlify([], netlify);
    await user.click(await screen.findByRole("button", { name: "Add Destination" }));
    await user.click(await screen.findByRole("menuitem", { name: "Netlify…" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a Netlify Destination" });
    await user.type(within(dialog).getByLabelText("Personal access token"), "nfp_token");
    await user.click(within(dialog).getByRole("button", { name: "Connect" }));
    await user.selectOptions(await within(dialog).findByLabelText("Netlify site"), "new");
    const save = within(dialog).getByRole("button", { name: "Save Destination" });

    // Twice at once: one save. It fails, so the dialog stays; Save again uses the site it made.
    await Promise.all([user.click(save), user.click(save)]);
    await waitFor(() => expect(netlify.save).toHaveBeenCalledTimes(1));
    await user.click(save);

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(netlify.createSite).toHaveBeenCalledTimes(1);
    expect(netlify.save).toHaveBeenCalledTimes(2);
    expect(netlify.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        site: expect.objectContaining({ id: "9e8d7c6b-1111-4222-8333-444455556666" }),
      }),
      { handle: "8d2c1f0e-1111-4222-8333-444455556666" },
    );
  });

  it("lists one by its site, publishes and tests it, and can't before it has its site", async () => {
    const { netlify, onPublish, user } = setUpNetlify([
      { destination: netlifyDestination, signIn: "saved", trust: {} },
      {
        destination: {
          id: "d00d0000-1111-4222-8333-444455556666",
          name: "Siteless",
          kind: "netlify",
        },
        signIn: "saved",
        trust: {},
      },
    ]);
    const rows = await screen.findAllByRole("listitem");
    const first = within(rows[0] as HTMLElement);
    const second = within(rows[1] as HTMLElement);
    expect(first.getByText("Netlify: https://rosas-bakery.netlify.app")).toBeTruthy();

    await user.click(first.getByRole("button", { name: "Test the connection to On Netlify" }));
    expect(netlify.testSaved).toHaveBeenCalledWith(netlifyDestination.id);
    expect(await first.findByText("Connected. Webforge can publish your site here.")).toBeTruthy();
    await user.click(first.getByRole("button", { name: "Publish to On Netlify" }));
    expect(onPublish).toHaveBeenCalledWith(netlifyDestination);

    expect(
      (second.getByRole("button", { name: "Publish to Siteless" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
