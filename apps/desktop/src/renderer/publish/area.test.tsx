// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createSite } from "@webforge/model";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";
import type { PublishResult } from "../../shared/ipc/publish.js";
import type { WindowContext } from "../editor/areas.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { createWindowDialogs, WindowDialogs } from "../shell/window-dialogs.js";
import { registriesForTest, sessionWith } from "../testing/fixtures.js";
import { fakePreloadApi } from "../testing/preload.js";
import { publishArea } from "./area.js";

afterEach(cleanup);

const LIVE: PublishResult = {
  status: "published",
  url: "https://www.rosasbakery.co.uk/",
  check: "live",
  uploaded: 12,
  unchanged: 0,
  removed: 0,
  versionSaved: true,
};

/** A destination this computer has the password for. */
const rosas = {
  destination: {
    id: "6f1c1b6e-8a3e-4c1e-9d55-2f5c1e0a7b10",
    name: "Rosa's Bakery",
    kind: "file-transfer" as const,
    settings: {
      protocol: "sftp" as const,
      host: "sftp.rosasbakery.co.uk",
      user: "rosa",
      folder: "/public_html",
      url: "https://www.rosasbakery.co.uk",
      signIn: "password" as const,
    },
  },
  signIn: "saved" as const,
  trust: {},
};

function setUp({
  published = LIVE,
  address = true,
}: {
  readonly published?: PublishResult;
  readonly address?: boolean;
} = {}) {
  const registries = registriesForTest();
  const windowDialogs = createWindowDialogs();
  // A site Site Check lets publish: nothing to fill in, and its web address.
  const site = createSite({
    name: "Rosa's Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
  });
  if (address) site.settings.address.url = "https://www.rosasbakery.co.uk";
  const session = sessionWith(site);
  const flush = vi.spyOn(session, "flush");
  const api = fakePreloadApi({
    publish: {
      destinations: vi.fn(async () => ({ status: "listed" as const, destinations: [rosas] })),
      publish: vi.fn(async () => published),
      cancel: vi.fn(async () => null),
      onProgress: vi.fn(() => () => undefined),
      openLive: vi.fn(async () => true),
      saveDestination: vi.fn(async (_session, draft) => ({
        status: "saved" as const,
        destination: {
          id: "6f1c1b6e-8a3e-4c1e-9d55-2f5c1e0a7b10",
          name: draft.name,
          kind: "file-transfer" as const,
          settings: {
            protocol: "ftps" as const,
            host: "ftp.rosasbakery.co.uk",
            user: "rosa",
            folder: "/public_html",
            url: "https://www.rosasbakery.co.uk",
          },
        },
      })),
    },
  });
  const showPanel = vi.spyOn(registries.panels, "show");
  const codeTrust = {
    confirm: vi.fn(async () => ({ go: true, keeps: () => true, allowListConfirmed: true })),
  };
  // Published two years ago, as far as the window knows.
  const publishedYear = createStore<number | undefined>(() => new Date().getFullYear() - 2);
  // Only what the area uses of the window's context.
  const context = {
    ...registries,
    api,
    session,
    windowDialogs,
    codeTrust,
    publishedYear,
  } as unknown as WindowContext;
  const remove = publishArea.register(context);
  render(<WindowDialogs registry={windowDialogs} />);
  return { registries, session, api, remove, flush, showPanel, publishedYear };
}

/** Opens Publish and publishes to Rosa's Bakery. */
async function publishToRosas(registries: ReturnType<typeof registriesForTest>) {
  const user = userEvent.setup({ delay: null });
  act(() => {
    registries.commands.run(COMMAND_IDS.publish);
  });
  await user.click(await screen.findByRole("button", { name: "Publish to Rosa's Bakery" }));
  return user;
}

describe("publishArea (4.4a)", () => {
  it("registers Publish… in File, which opens the site's destinations", async () => {
    const { registries, api } = setUp();
    expect(registries.commands.get(COMMAND_IDS.publish)).toMatchObject({
      label: "Publish…",
      menu: "file",
    });

    act(() => {
      registries.commands.run(COMMAND_IDS.publish);
    });

    expect(await screen.findByRole("dialog", { name: "Publish" })).toBeTruthy();
    expect(api.publish.destinations).toHaveBeenCalledOnce();
  });

  it("fills the site's web address from a destination saved with one, as one undo step", async () => {
    const { registries, session } = setUp({ address: false });
    const user = userEvent.setup({ delay: null });
    act(() => {
      registries.commands.run(COMMAND_IDS.publish);
    });
    await user.click(await screen.findByRole("button", { name: "Add Destination" }));
    const form = within(await screen.findByRole("dialog", { name: "Publish to your web host" }));
    await user.type(form.getByLabelText("Host", { exact: true }), "ftp.rosasbakery.co.uk");
    await user.type(form.getByLabelText("User name", { exact: true }), "rosa");
    await user.type(form.getByLabelText("Password", { exact: true }), "test-only-password");
    await user.click(form.getByRole("button", { name: "Save" }));

    await vi.waitFor(() =>
      expect(session.history.document.getState().settings.address.url).toBe(
        "https://www.rosasbakery.co.uk",
      ),
    );
    expect(session.history.state.getState().entries.at(-1)?.label).toBe(
      "Changed Site Settings: Web address",
    );
  });

  it("publishes what the person sees, then says the site is live, with Open and Copy Link (4.5)", async () => {
    const { registries, api, flush } = setUp();
    const user = await publishToRosas(registries);

    const live = within(await screen.findByRole("dialog", { name: "Your site is live" }));
    expect(live.getByText("Visitors can see it at https://www.rosasbakery.co.uk/.")).toBeTruthy();
    // The canvas's edit ended before main was asked; main has the window save first (A4).
    expect(flush.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(api.publish.publish).mock.invocationCallOrder[0] ?? 0,
    );
    expect(screen.queryByRole("dialog", { name: "Publish" })).toBeNull();
    const operationId = vi.mocked(api.publish.publish).mock.calls[0]?.[2];

    await user.click(live.getByRole("button", { name: "Open Site" }));
    expect(api.publish.openLive).toHaveBeenCalledWith(operationId);
    await user.click(live.getByRole("button", { name: "Copy Link" }));
    expect(api.clipboard.copyText).toHaveBeenCalledWith("https://www.rosasbakery.co.uk/");
    expect(live.queryByText(/Version History/)).toBeNull();
    await user.click(live.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog", { name: "Your site is live" })).toBeNull();
  });

  it("still says the site is live when its version couldn't be kept, quietly", async () => {
    const { registries } = setUp({ published: { ...LIVE, versionSaved: false } });
    await publishToRosas(registries);

    const live = within(await screen.findByRole("dialog", { name: "Your site is live" }));
    expect(live.getByText("This publish couldn't be kept in Version History.")).toBeTruthy();
    expect(live.queryByRole("alert")).toBeNull();
  });

  it("tells Site Check the site now shows this year, once live and only then (F-CM-8)", async () => {
    const before = new Date().getFullYear() - 2;
    const failed = setUp({ published: { status: "cancelled" } });
    await publishToRosas(failed.registries);
    await waitFor(() => expect(failed.api.publish.publish).toHaveBeenCalled());
    expect(failed.publishedYear.getState()).toBe(before);
    failed.remove();
    cleanup();

    const { registries, publishedYear } = setUp();
    await publishToRosas(registries);
    await screen.findByRole("dialog", { name: "Your site is live" });
    expect(publishedYear.getState()).toBe(new Date().getFullYear());
  });

  it("says what the live check found when the address shows another page", async () => {
    const { registries } = setUp({ published: { ...LIVE, check: "different" } });
    await publishToRosas(registries);
    const live = within(await screen.findByRole("dialog", { name: "Your site is live" }));
    expect(live.getByText(/That address shows another page for now/)).toBeTruthy();
  });

  it("asks before replacing another site in the folder, and publishes over it once asked (A8)", async () => {
    const { registries, api } = setUp();
    vi.mocked(api.publish.publish).mockResolvedValueOnce({
      status: "failed",
      reason: "other-site",
    });
    const user = await publishToRosas(registries);

    const question = within(
      await screen.findByRole("alertdialog", { name: "Replace the site in this folder?" }),
    );
    expect(question.getByText(/The folder on Rosa's Bakery has another site/)).toBeTruthy();
    await user.click(question.getByRole("button", { name: "Replace It" }));

    expect(await screen.findByRole("dialog", { name: "Your site is live" })).toBeTruthy();
    expect(vi.mocked(api.publish.publish).mock.calls[1]?.[3]).toEqual({ replaceOtherSite: true });
  });

  it("shows Site Check when main's gate finds something to fix", async () => {
    const { registries, showPanel } = setUp({ published: { status: "must-fix", count: 1 } });
    await publishToRosas(registries);
    await vi.waitFor(() => expect(showPanel).toHaveBeenCalledWith("siteCheck"));
  });

  it("removes its command and dialog when unregistered", () => {
    const { registries, remove } = setUp();
    remove?.();
    expect(registries.commands.get(COMMAND_IDS.publish)).toBeUndefined();
  });
});
