// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createSite } from "@webforge/model";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";
import type { PublishResult } from "../../shared/ipc/publish.js";
import type { WindowContext } from "../editor/areas.js";
import { createPublishRequests } from "../editor/publish-requests.js";
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
  // The saved version Version History asks to republish: as it was, with its web address.
  vi.mocked(api.versions.readSite).mockResolvedValue({ status: "ok", site });
  const showPanel = vi.spyOn(registries.panels, "show");
  const codeTrust = {
    confirm: vi.fn(async () => ({ go: true, keeps: () => true, allowListConfirmed: true })),
  };
  // Published two years ago, as far as the window knows.
  const publishedYear = createStore<number | undefined>(() => new Date().getFullYear() - 2);
  const publishing = createPublishRequests();
  const onNetlify = createStore<boolean>(() => false);
  // Only what the area uses of the window's context.
  const context = {
    ...registries,
    api,
    session,
    windowDialogs,
    codeTrust,
    publishedYear,
    onNetlify,
    publishing,
  } as unknown as WindowContext;
  const remove = publishArea.register(context);
  render(<WindowDialogs registry={windowDialogs} />);
  return {
    registries,
    session,
    api,
    remove,
    flush,
    showPanel,
    publishedYear,
    onNetlify,
    publishing,
    codeTrust,
  };
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

  it("tells Site Settings whether the site has a Netlify destination, as Publish lists them (4.2)", async () => {
    const { registries, api, onNetlify } = setUp();
    const netlify = {
      destination: { id: "2c4e6a8b-1d3f-4a5b-8c7d-9e0f1a2b3c4d", name: "Live", kind: "netlify" },
      signIn: "saved",
      trust: {},
    } as const;
    vi.mocked(api.publish.destinations).mockResolvedValueOnce({
      status: "listed",
      destinations: [rosas, netlify],
    });

    act(() => {
      registries.commands.run(COMMAND_IDS.publish);
    });
    await screen.findByText("Rosa's Bakery");
    await vi.waitFor(() => expect(onNetlify.getState()).toBe(true));
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
    const { registries, remove, publishing } = setUp();
    remove?.();
    expect(registries.commands.get(COMMAND_IDS.publish)).toBeUndefined();
    // Nothing answers Version History's Republish… any more.
    act(() => {
      publishing.republish(VERSION);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says when a publish has gone live, for Version History to list where it went", async () => {
    const { registries, publishing } = setUp();
    const listener = vi.fn();
    publishing.onPublished(listener);
    await publishToRosas(registries);
    await screen.findByRole("dialog", { name: "Your site is live" });
    expect(listener).toHaveBeenCalledOnce();
  });
});

const VERSION = { id: "2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d", name: "Before the menu" };

describe("Republish from Version History (4.6b)", () => {
  /** Asks to republish {@link VERSION}, and republishes it to Rosa's Bakery. */
  async function republishToRosas(publishing: ReturnType<typeof createPublishRequests>) {
    const user = userEvent.setup({ delay: null });
    act(() => {
      publishing.republish(VERSION);
    });
    const dialog = within(
      await screen.findByRole("dialog", { name: "Republish “Before the menu”" }),
    );
    expect(dialog.getByText(/The site you're editing stays as it is/)).toBeTruthy();
    await user.click(dialog.getByRole("button", { name: "Republish to Rosa's Bakery" }));
    return user;
  }

  it("opens the destinations for the version, and republishes it to the one chosen", async () => {
    const { api, publishing, flush, publishedYear, codeTrust } = setUp();
    await republishToRosas(publishing);

    expect(await screen.findByRole("dialog", { name: "Your site is live" })).toBeTruthy();
    expect(api.versions.readSite).toHaveBeenCalledWith(expect.any(String), VERSION.id);
    expect(codeTrust.confirm).toHaveBeenCalledOnce();
    expect(vi.mocked(api.publish.publish).mock.calls[0]?.[3]).toEqual({
      replaceOtherSite: false,
      versionId: VERSION.id,
    });
    // The canvas isn't what's published.
    expect(flush).not.toHaveBeenCalled();
    expect(publishedYear.getState()).toBe(new Date().getFullYear());
  });

  it("publishes the site again, not the version, once File → Publish… opens the destinations", async () => {
    const { registries, api, publishing } = setUp();
    await republishToRosas(publishing);
    await screen.findByRole("dialog", { name: "Your site is live" });
    await userEvent.click(screen.getByRole("button", { name: "Done" }));

    await publishToRosas(registries);
    await screen.findByRole("dialog", { name: "Your site is live" });
    expect(vi.mocked(api.publish.publish).mock.calls[1]?.[3]).toEqual({ replaceOtherSite: false });
  });

  it("asks for the password again with the destinations still for the version", async () => {
    const { api, publishing } = setUp({ published: { status: "sign-in-needed" } });
    await republishToRosas(publishing);
    await waitFor(() => expect(api.publish.publish).toHaveBeenCalled());
    expect(await screen.findByRole("dialog", { name: "Republish “Before the menu”" })).toBeTruthy();
  });
});
