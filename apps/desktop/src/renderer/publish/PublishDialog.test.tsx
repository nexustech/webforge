// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PublishDestination } from "@webforge/model";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ListedDestination, PublishApi } from "../../shared/ipc/publish.js";
import { PublishDialog, type PublishDialogApi } from "./PublishDialog.js";

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
  render(
    <PublishDialog
      open
      publish={publish}
      sessionId={() => SESSION}
      notify={notify}
      onSaved={onSaved}
      onClose={vi.fn()}
    />,
  );
  const user = userEvent.setup({ delay: null });
  return { publish, notify, onSaved, user };
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
