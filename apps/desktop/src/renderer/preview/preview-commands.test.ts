import { newId } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";
import type { PhoneAddress, PreviewApi } from "../../shared/ipc/preview.js";
import { starterSite } from "../../shared/starter-site.js";
import type { CodeDecision } from "../editor/code-trust.js";
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
  const confirmCode = vi.fn(
    async (): Promise<CodeDecision> => ({ go: true, keeps: () => true, allowListConfirmed: true }),
  );
  const trustedListeners = new Set<() => void>();
  /** Main trusting more of the site's code. */
  const codeTrusted = () => {
    for (const listener of trustedListeners) listener();
  };
  const remove = registerPreviewCommands(registry, {
    session,
    library: siteLibrary,
    api,
    confirmCode,
    onCodeTrusted: (listener) => {
      trustedListeners.add(listener);
      return () => trustedListeners.delete(listener);
    },
    sessionId: () => SESSION,
    phone: phoneState,
    notify,
  });
  /** An edit of the site, as any edit is: one step in the history. */
  const edit = (name: string) =>
    session.edit("root", "Renamed site", (draft) => {
      draft.settings.general.name = name;
    });
  return {
    session,
    registry,
    api,
    phoneState,
    notify,
    remove,
    edit,
    about,
    confirmCode,
    codeTrusted,
  };
}

describe("previewPageOf (3.2)", () => {
  it("is the page's file as the build names it", () => {
    const { site, about } = siteWithAbout();
    expect(previewPageOf(site, site.homePageId)).toBe("index.html");
    expect(previewPageOf(site, about)).toBe("services/about.html");
  });
});

/** Runs command `id` and lets what it waits for first (the code trust step, #649) answer. */
async function runSettled(registry: ReturnType<typeof createCommandRegistry>, id: string) {
  registry.run(id);
  for (let turn = 0; turn < 5; turn++) await Promise.resolve();
}

describe("registerPreviewCommands: the site's code (#649)", () => {
  it("asks about the site's code first, and opens nothing when the owner doesn't go on", async () => {
    const { registry, api, confirmCode, session } = setUp();
    confirmCode.mockResolvedValue({ go: false });

    await runSettled(registry, COMMAND_IDS.preview);
    await runSettled(registry, COMMAND_IDS.previewOnPhone);

    expect(confirmCode).toHaveBeenCalledWith(session.history.document.getState());
    expect(confirmCode).toHaveBeenCalledTimes(2);
    expect(api.open).not.toHaveBeenCalled();
    expect(api.phone).not.toHaveBeenCalled();
  });

  it("builds again once more code is trusted, which main builds with, while it follows", async () => {
    const { registry, api, codeTrusted, remove } = setUp();
    codeTrusted();
    expect(api.update).not.toHaveBeenCalled();

    await runSettled(registry, COMMAND_IDS.preview);
    codeTrusted();
    expect(api.update).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(PREVIEW_UPDATE_MS);
    remove();
    codeTrusted();
    expect(api.update).toHaveBeenCalledOnce();
  });
});

describe("registerPreviewCommands (3.2)", () => {
  it("opens the site at the page shown, from File → Preview and the title bar's button", async () => {
    const { session, registry, api, about } = setUp();
    session.showPage(about);

    expect(registry.get(COMMAND_IDS.preview)).toMatchObject({ label: "Preview", menu: "file" });
    await runSettled(registry, COMMAND_IDS.preview);

    expect(api.open).toHaveBeenCalledOnce();
    const [sessionId, content, page] = api.open.mock.calls[0] ?? [];
    expect(sessionId).toBe(SESSION);
    expect(page).toBe("services/about.html");
    expect(content?.snapshot.name).toBe(session.history.document.getState().settings.general.name);
  });

  it("says so when the preview couldn't open", async () => {
    const { registry, api, notify } = setUp();
    api.open.mockResolvedValueOnce("failed");
    await runSettled(registry, COMMAND_IDS.preview);
    await vi.waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        "Webforge couldn't open the preview. Try again in a moment.",
      ),
    );
  });

  it("sends nothing until it's opened, then each change, at most one every 100 ms", async () => {
    const { registry, api, edit } = setUp();
    edit("Before");
    expect(api.update).not.toHaveBeenCalled();

    await runSettled(registry, COMMAND_IDS.preview);
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

  it("follows the editor to the page shown", async () => {
    const { session, registry, api, about } = setUp();
    await runSettled(registry, COMMAND_IDS.preview);

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

    await runSettled(registry, COMMAND_IDS.previewOnPhone);
    await vi.waitFor(() =>
      expect(phoneState.getState()).toEqual({
        status: "ready",
        url: "http://192.168.1.23:5002/x/",
      }),
    );
    expect(api.phone.mock.calls[0]?.[2]).toBe("index.html");

    const offline = setUp({ status: "offline" });
    await runSettled(offline.registry, COMMAND_IDS.previewOnPhone);
    await vi.waitFor(() => expect(offline.phoneState.getState()).toEqual({ status: "offline" }));

    const failing = setUp();
    failing.api.phone.mockRejectedValueOnce(new Error("IPC failed"));
    await runSettled(failing.registry, COMMAND_IDS.previewOnPhone);
    await vi.waitFor(() => expect(failing.phoneState.getState()).toEqual({ status: "failed" }));
  });

  it("offers Stop Phone Preview while a phone can open it, which stops it (3.2)", async () => {
    const { registry, api, phoneState } = setUp();
    expect(registry.get(COMMAND_IDS.stopPhonePreview)).toBeUndefined();

    await runSettled(registry, COMMAND_IDS.previewOnPhone);
    await vi.waitFor(() =>
      expect(registry.get(COMMAND_IDS.stopPhonePreview)).toMatchObject({
        label: "Stop Phone Preview",
        menu: "file",
      }),
    );
    // Asked again while on: still one.
    await runSettled(registry, COMMAND_IDS.previewOnPhone);
    await vi.waitFor(() => expect(api.phone).toHaveBeenCalledTimes(2));

    registry.run(COMMAND_IDS.stopPhonePreview);
    await vi.waitFor(() => expect(registry.get(COMMAND_IDS.stopPhonePreview)).toBeUndefined());
    expect(api.stopPhone).toHaveBeenCalledOnce();
    expect(phoneState.getState()).toEqual({ status: "closed" });

    // No network: nothing to stop.
    const offline = setUp({ status: "offline" });
    await runSettled(offline.registry, COMMAND_IDS.previewOnPhone);
    await vi.waitFor(() => expect(offline.phoneState.getState()).toEqual({ status: "offline" }));
    expect(offline.registry.get(COMMAND_IDS.stopPhonePreview)).toBeUndefined();
  });

  it("leaves the dialog closed when it was closed while the preview started", async () => {
    const { registry, phoneState } = setUp();
    await runSettled(registry, COMMAND_IDS.previewOnPhone);
    phoneState.setState({ status: "closed" }, true);
    await vi.runAllTimersAsync();
    expect(phoneState.getState()).toEqual({ status: "closed" });
  });

  it("stops following once removed", async () => {
    const { registry, api, edit, remove } = setUp();
    await runSettled(registry, COMMAND_IDS.preview);
    remove();

    edit("After");
    expect(api.update).not.toHaveBeenCalled();
    expect(registry.get(COMMAND_IDS.preview)).toBeUndefined();
  });
});
