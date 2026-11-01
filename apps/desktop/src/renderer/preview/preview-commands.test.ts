import { newId } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";
import type { PhoneAddress, PreviewApi } from "../../shared/ipc/preview.js";
import { starterSite } from "../../shared/starter-site.js";
import { setFailureLog } from "../log.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { createCommandRegistry } from "../shell/commands.js";
import { sessionWith } from "../testing/fixtures.js";
import type { PhoneState } from "./PhonePreviewDialog.js";
import { PREVIEW_UPDATE_MS, previewPageOf, registerPreviewCommands } from "./preview-commands.js";

beforeEach(() => {
  vi.useFakeTimers();
  setFailureLog(async () => null);
});
afterEach(() => {
  vi.useRealTimers();
});

/** The starter site with an About page in a Services folder. */
function siteWithAbout() {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  const about = newId("page");
  site.pages[about] = { ...structuredClone(home), id: about, slug: "about", folder: "services" };
  site.pageOrder.push(about);
  return { site, about };
}

/** The opening of the site the page was loaded for, which every call names (#663). */
const SESSION = "11111111-1111-4111-8111-111111111111";

function setUp(phone: PhoneAddress = { status: "ready", url: "http://192.168.1.23:5002/x/" }) {
  const { site, about } = siteWithAbout();
  const session = sessionWith(site);
  const registry = createCommandRegistry();
  const api = {
    open: vi.fn<PreviewApi["open"]>(async () => "opened"),
    update: vi.fn<PreviewApi["update"]>(async () => null),
    show: vi.fn<PreviewApi["show"]>(async () => null),
    phone: vi.fn<PreviewApi["phone"]>(async () => phone),
    stopPhone: vi.fn<PreviewApi["stopPhone"]>(async () => null),
  };
  const phoneState = createStore<PhoneState>(() => ({ status: "closed" }));
  const notify = vi.fn();
  const remove = registerPreviewCommands(registry, {
    session,
    library: siteLibrary,
    api,
    sessionId: () => SESSION,
    phone: phoneState,
    notify,
  });
  /** An edit of the site, as any edit is: one step in the history. */
  const edit = (name: string) =>
    session.edit("root", "Renamed site", (draft) => {
      draft.settings.general.name = name;
    });
  return { session, registry, api, phoneState, notify, remove, edit, about };
}

describe("previewPageOf (3.2)", () => {
  it("is the page's file as the build names it", () => {
    const { site, about } = siteWithAbout();
    expect(previewPageOf(site, site.homePageId)).toBe("index.html");
    expect(previewPageOf(site, about)).toBe("services/about.html");
  });
});

describe("registerPreviewCommands (3.2)", () => {
  it("opens the site at the page shown, from File → Preview and the title bar's button", async () => {
    const { session, registry, api, about } = setUp();
    session.showPage(about);

    expect(registry.get(COMMAND_IDS.preview)).toMatchObject({ label: "Preview", menu: "file" });
    registry.run(COMMAND_IDS.preview);

    expect(api.open).toHaveBeenCalledOnce();
    const [sessionId, content, page] = api.open.mock.calls[0] ?? [];
    expect(sessionId).toBe(SESSION);
    expect(page).toBe("services/about.html");
    expect(content?.snapshot.name).toBe(session.history.document.getState().settings.general.name);
  });

  it("says so when the preview couldn't open", async () => {
    const { registry, api, notify } = setUp();
    api.open.mockResolvedValueOnce("failed");
    registry.run(COMMAND_IDS.preview);
    await vi.waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        "Webforge couldn't open the preview. Try again in a moment.",
      ),
    );
  });

  it("sends nothing until it's opened, then each change, at most one every 100 ms", () => {
    const { registry, api, edit } = setUp();
    edit("Before");
    expect(api.update).not.toHaveBeenCalled();

    registry.run(COMMAND_IDS.preview);
    // A lone change goes at once.
    edit("One");
    expect(api.update.mock.calls.map(([, site]) => site.snapshot.name)).toEqual(["One"]);
    // Those right after it wait, and go as one: the last.
    edit("Two");
    edit("Three");
    expect(api.update).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(PREVIEW_UPDATE_MS);
    expect(api.update.mock.calls.map(([, site]) => site.snapshot.name)).toEqual(["One", "Three"]);
    vi.advanceTimersByTime(PREVIEW_UPDATE_MS);
    expect(api.update).toHaveBeenCalledTimes(2);
  });

  it("follows the editor to the page shown", () => {
    const { session, registry, api, about } = setUp();
    registry.run(COMMAND_IDS.preview);

    session.showPage(about);
    session.select(null);

    expect(api.show.mock.calls).toEqual([["services/about.html"]]);
  });

  it("shows the phone's address, or why there is none", async () => {
    const { registry, api, phoneState } = setUp();
    expect(registry.get(COMMAND_IDS.previewOnPhone)).toMatchObject({
      label: "Preview on Phone…",
      menu: "file",
    });

    registry.run(COMMAND_IDS.previewOnPhone);
    expect(phoneState.getState()).toEqual({ status: "starting" });
    await vi.waitFor(() =>
      expect(phoneState.getState()).toEqual({
        status: "ready",
        url: "http://192.168.1.23:5002/x/",
      }),
    );
    expect(api.phone.mock.calls[0]?.[2]).toBe("index.html");

    const offline = setUp({ status: "offline" });
    offline.registry.run(COMMAND_IDS.previewOnPhone);
    await vi.waitFor(() => expect(offline.phoneState.getState()).toEqual({ status: "offline" }));

    const failing = setUp();
    failing.api.phone.mockRejectedValueOnce(new Error("IPC failed"));
    failing.registry.run(COMMAND_IDS.previewOnPhone);
    await vi.waitFor(() => expect(failing.phoneState.getState()).toEqual({ status: "failed" }));
  });

  it("offers Stop Phone Preview while a phone can open it, which stops it (3.2)", async () => {
    const { registry, api, phoneState } = setUp();
    expect(registry.get(COMMAND_IDS.stopPhonePreview)).toBeUndefined();

    registry.run(COMMAND_IDS.previewOnPhone);
    await vi.waitFor(() =>
      expect(registry.get(COMMAND_IDS.stopPhonePreview)).toMatchObject({
        label: "Stop Phone Preview",
        menu: "file",
      }),
    );
    // Asked again while on: still one.
    registry.run(COMMAND_IDS.previewOnPhone);
    await vi.waitFor(() => expect(api.phone).toHaveBeenCalledTimes(2));

    registry.run(COMMAND_IDS.stopPhonePreview);
    await vi.waitFor(() => expect(registry.get(COMMAND_IDS.stopPhonePreview)).toBeUndefined());
    expect(api.stopPhone).toHaveBeenCalledOnce();
    expect(phoneState.getState()).toEqual({ status: "closed" });

    // No network: nothing to stop.
    const offline = setUp({ status: "offline" });
    offline.registry.run(COMMAND_IDS.previewOnPhone);
    await vi.waitFor(() => expect(offline.phoneState.getState()).toEqual({ status: "offline" }));
    expect(offline.registry.get(COMMAND_IDS.stopPhonePreview)).toBeUndefined();
  });

  it("leaves the dialog closed when it was closed while the preview started", async () => {
    const { registry, phoneState } = setUp();
    registry.run(COMMAND_IDS.previewOnPhone);
    phoneState.setState({ status: "closed" }, true);
    await vi.runAllTimersAsync();
    expect(phoneState.getState()).toEqual({ status: "closed" });
  });

  it("stops following once removed", () => {
    const { registry, api, edit, remove } = setUp();
    registry.run(COMMAND_IDS.preview);
    remove();

    edit("After");
    expect(api.update).not.toHaveBeenCalled();
    expect(registry.get(COMMAND_IDS.preview)).toBeUndefined();
  });
});
