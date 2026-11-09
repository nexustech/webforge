// @vitest-environment happy-dom
import { toast } from "@webforge/editor-ui";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BriefOutcome, SiteBrief } from "../../shared/ipc/ai.js";
import { DEFAULT_PREFERENCES } from "../../shared/ipc/prefs.js";
import type { NewSiteRequest } from "../../shared/ipc/project.js";
import type { TemplateSummary } from "../../shared/ipc/templates.js";
import type { UpdateStatus } from "../../shared/ipc/updates.js";
import type { ProjectResult, RecentSite } from "../../shared/ipc-contract.js";
import { StartScreen } from "./StartScreen.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const info = { name: "Webforge", version: "1.0.0" };
const project = {
  sessionId: "9b2f6c1e-4d3a-4f7b-8e21-5c6d7a8b9c0d",
  name: "Bakery",
  fileName: "Bakery.wforge",
  formatVersion: 1,
  syncService: null,
};
const bakery: RecentSite = {
  id: "a".repeat(32),
  name: "Rosa's Bakery",
  fileName: "Rosa's Bakery.wforge",
  folder: "Sites",
  lastOpened: "2026-10-20T09:00:00.000Z",
  lastEdited: "2026-10-21T09:30:00.000Z",
  thumbnail: "data:image/jpeg;base64,/9j/",
  missing: false,
  pinned: false,
  open: false,
};
const florist: RecentSite = {
  ...bakery,
  id: "b".repeat(32),
  name: "Florist",
  fileName: "Florist.wforge",
  lastEdited: null,
  thumbnail: null,
};
const gone: RecentSite = { ...florist, id: "c".repeat(32), name: "Old site", missing: true };

let container: HTMLDivElement;
let root: Root;
let flushRequests: ReturnType<typeof vi.fn<(save: () => Promise<void>) => () => void>>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  flushRequests = vi.fn((_save: () => Promise<void>) => () => undefined);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

function api(recent: RecentSite[], result: ProjectResult = { status: "opened", project }) {
  return {
    create: vi.fn(async (_request: NewSiteRequest) => result),
    open: vi.fn(async () => result),
    openZip: vi.fn(async () => result),
    listRecent: vi.fn(async () => recent),
    openRecent: vi.fn(async (_id: string) => result),
    pinRecent: vi.fn(async (_id: string, _pinned: boolean) => null),
    removeRecent: vi.fn(async (_id: string) => null),
    clearRecent: vi.fn(async () => null),
  };
}

/** The person's preferences, where the quick start asks for the tour (OB-1). */
const prefs = {
  get: vi.fn(async () => DEFAULT_PREFERENCES),
  set: vi.fn(async () => DEFAULT_PREFERENCES),
};

/** The Help window, as the start screen opens it (5.4b). */
const helpWindow = { open: vi.fn(async () => true) };

/** Webforge's own update (0.5a): none, unless a test says otherwise. */
let updateStatus: UpdateStatus = { state: "idle" };
const updates = {
  status: vi.fn(async () => updateStatus),
  onStatus: vi.fn((_listener: (status: UpdateStatus) => void) => () => undefined),
};

async function render(
  project: ReturnType<typeof api>,
  restart = vi.fn(),
  templates: () => Promise<TemplateSummary[]> = async () => [],
  ai?: { onBrief: (open: BriefOpener) => () => void },
) {
  await act(async () =>
    root.render(
      <StartScreen
        info={info}
        project={project}
        templates={{ list: templates }}
        app={{ onFlushRequest: flushRequests }}
        restart={restart}
        locale="en-GB"
        help={helpWindow}
        prefs={prefs}
        updates={updates}
        {...(ai === undefined ? {} : { ai })}
      />,
    ),
  );
  return restart;
}

const button = (name: string) =>
  [...container.querySelectorAll("button")].find((element) => element.textContent?.includes(name));

describe("StartScreen", () => {
  it("says an update is ready to install, as the editor does (0.5a)", async () => {
    updateStatus = { state: "downloaded", version: "1.2.0" };
    try {
      await render(api([]));
      await vi.waitFor(() =>
        expect(document.body.textContent).toContain(
          "Webforge 1.2.0 is ready: it installs when you close Webforge.",
        ),
      );
      expect(updates.onStatus).toHaveBeenCalled();
    } finally {
      updateStatus = { state: "idle" };
      // Toasts are the page's, not the screen's: none may stay for the next test.
      act(() => toast.dismiss());
    }
  });

  it("answers save requests at once, having nothing to save", async () => {
    await render(api([]));

    const save = flushRequests.mock.calls[0]?.[0];
    await expect(save?.()).resolves.toBeUndefined();
  });

  it("offers the quick start first, then New Site and Open, and says when there are no recent sites", async () => {
    const project = api([]);
    const restart = await render(project);

    expect(container.textContent).toContain("Get started");
    expect(container.textContent).toContain("Sites you open or create appear here.");
    // The quick start (QS-4): every step skipped makes the untitled Blank site.
    await act(async () => button("Start a site…")?.click());
    const createSite = [...document.querySelectorAll("button")].find(
      (element) => element.textContent === "Create site",
    );
    await act(async () => createSite?.click());
    expect(project.create).toHaveBeenCalledWith({
      name: "My site",
      theme: "light",
      business: {},
      pages: { leaveOut: [], recipes: [] },
    });
    // The site the quick start made opens with the tour offered (OB-1).
    expect(prefs.set).toHaveBeenCalledWith({
      onboarding: { ...DEFAULT_PREFERENCES.onboarding, tour: "offer" },
    });
    prefs.set.mockClear();

    await act(async () => button("Choose a template yourself…")?.click());
    // New Site's dialog, in a portal on the body (2.14a).
    const create = [...document.querySelectorAll("button")].find(
      (element) => element.textContent === "Create",
    );
    await act(async () => create?.click());
    expect(project.create).toHaveBeenCalledWith({ name: "My site", theme: "light", business: {} });
    expect(restart).toHaveBeenCalled();
    // New Site's: no tour offered.
    expect(prefs.set).not.toHaveBeenCalled();
    await act(async () => button("Open a site…")?.click());
    expect(project.open).toHaveBeenCalled();
  });

  it("still offers a Blank site when the templates can't be listed", async () => {
    const project = api([]);
    await render(project, vi.fn(), async () => {
      throw new Error("templates folder missing");
    });

    await act(async () => button("Choose a template yourself…")?.click());
    expect(document.body.textContent).toContain("No templates of this type yet.");
    const create = [...document.querySelectorAll("button")].find(
      (element) => element.textContent === "Create",
    );
    await act(async () => create?.click());
    expect(project.create).toHaveBeenCalledWith({ name: "My site", theme: "light", business: {} });
  });

  it("lists recent sites with thumbnail, file name and when they were edited or opened", async () => {
    await render(api([bakery, florist, gone]));

    const items = [...container.querySelectorAll("li")].map((item) => item.textContent);
    expect(items[0]).toContain("Rosa's Bakery");
    expect(items[0]).toContain("Edited 21 Oct 2026");
    expect(items[0]).toContain("Sites › Rosa's Bakery.wforge");
    expect(items[1]).toContain("Opened 20 Oct 2026");
    expect(items[2]).toContain("The file has been moved or deleted");
    expect(container.querySelector("li img")?.getAttribute("src")).toBe(bakery.thumbnail);
    expect(button("Old site")?.disabled).toBe(true);
  });

  it("opens a recent site and removes one from the list", async () => {
    const project = api([bakery, florist]);
    const restart = await render(project);

    await act(async () => button("Rosa's Bakery")?.click());
    expect(project.openRecent).toHaveBeenCalledWith(bakery.id);
    expect(restart).toHaveBeenCalled();

    const remove = container.querySelector<HTMLButtonElement>(
      '[aria-label="Remove Florist from the list"]',
    );
    // Main's list without it, which the screen reads again.
    project.listRecent.mockResolvedValue([bakery]);
    await act(async () => remove?.click());
    expect(project.removeRecent).toHaveBeenCalledWith(florist.id);
    expect(container.textContent).not.toContain("Florist.wforge");
  });

  it("says when the list can't be changed, and changes nothing (#448 review)", async () => {
    const project = api([bakery, florist]);
    project.pinRecent.mockRejectedValueOnce(new Error("disk full"));
    await render(project);

    const pin = container.querySelector<HTMLButtonElement>('[aria-label="Pin Florist"]');
    await act(async () => pin?.click());

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "The list of recent sites couldn't be changed. Try again.",
    );
    expect(pin?.getAttribute("aria-pressed")).toBe("false");
  });

  it("says why a site couldn't be opened", async () => {
    await render(api([bakery], { status: "failed", reason: "newer-format" }));

    await act(async () => button("Rosa's Bakery")?.click());

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "This site was saved by a newer version of Webforge. Update Webforge to open it.",
    );
  });

  it("pins a site to the top of the list, and unpins it (2.14b)", async () => {
    const project = api([bakery, florist]);
    await render(project);
    project.listRecent.mockResolvedValueOnce([{ ...florist, pinned: true }, bakery]);

    // A toggle (APG): the same name pinned or not, pressed while pinned; the tooltip says what a
    // click does.
    const pin = () => container.querySelector<HTMLButtonElement>('[aria-label="Pin Florist"]');
    expect(pin()?.getAttribute("aria-pressed")).toBe("false");
    expect(pin()?.title).toBe("Pin Florist to the top");
    await act(async () => pin()?.click());

    expect(project.pinRecent).toHaveBeenCalledWith(florist.id, true);
    const names = [...container.querySelectorAll("li")].map((item) => item.textContent);
    expect(names[0]).toContain("Florist");
    expect(pin()?.getAttribute("aria-pressed")).toBe("true");
    expect(pin()?.title).toBe("Unpin Florist");
    await act(async () => pin()?.click());
    expect(project.pinRecent).toHaveBeenLastCalledWith(florist.id, false);
  });

  it("searches the recent sites by name, file and folder (2.14b)", async () => {
    await render(api([bakery, { ...florist, folder: "Flowers" }, gone]));
    const search = container.querySelector<HTMLInputElement>('input[type="search"]');
    const type = (text: string) =>
      act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
          search,
          text,
        );
        search?.dispatchEvent(new Event("input", { bubbles: true }));
      });
    const shown = () => [...container.querySelectorAll("li")].map((item) => item.textContent);

    await type("ROSA");
    expect(shown()).toEqual([expect.stringContaining("Rosa's Bakery")]);
    await type("flowers");
    expect(shown()).toEqual([expect.stringContaining("Florist")]);
    await type("old site");
    expect(shown()).toEqual([expect.stringContaining("Old site")]);
    await type("cupcakes");
    expect(shown()).toEqual([]);
    expect(container.textContent).toContain("No site matches “cupcakes”.");
  });

  it("tries the app's example, named after it, without New Site's dialog (2.14b, PG-3)", async () => {
    const example: TemplateSummary = {
      id: "cafe",
      category: "food",
      example: true,
      pages: 2,
      pageList: [],
      theme: "bistro",
      thumbnail: null,
    };
    const project = api([]);
    const restart = await render(project, vi.fn(), async () => [
      { ...example, example: false },
      example,
    ]);

    await act(async () => button("Try an example")?.click());

    expect(project.create).toHaveBeenCalledWith({
      name: "Café / Restaurant",
      theme: "bistro",
      template: "cafe",
    });
    expect(restart).toHaveBeenCalled();
  });

  it("offers no example when the app ships none", async () => {
    await render(api([]));

    expect(button("Try an example")).toBeUndefined();
  });

  it("lists the help pages to start with, the shortcuts and the example on the Help tab, and runs them (2.14b, 5.4b)", async () => {
    const example: TemplateSummary = {
      id: "cafe",
      category: "food",
      example: true,
      pages: 2,
      pageList: [],
      theme: "light",
      thumbnail: null,
    };
    const project = api([]);
    await render(project, vi.fn(), async () => [example]);
    const help = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
      (tab) => tab.textContent === "Help",
    );

    await act(async () => {
      help?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    });
    const panel = container.querySelector('[role="tabpanel"][data-state="active"]');
    expect([...(panel?.querySelectorAll("li") ?? [])].map((item) => item.textContent)).toEqual([
      expect.stringContaining("Getting started"),
      expect.stringContaining("The editor"),
      expect.stringMatching(/^Keyboard shortcutsEach keyboard shortcut explained/),
      expect.stringContaining("Keyboard Shortcuts"),
      expect.stringContaining("Try an Example"),
    ]);

    // A help page opens in the Help window.
    const started = [...(panel?.querySelectorAll("button") ?? [])].find((each) =>
      each.textContent?.includes("Getting started"),
    );
    await act(async () => started?.click());
    expect(helpWindow.open).toHaveBeenCalledWith({ page: "getting-started" });

    const tryIt = [...(panel?.querySelectorAll("button") ?? [])].find((each) =>
      each.textContent?.includes("Try an Example"),
    );
    await act(async () => tryIt?.click());
    expect(project.create).toHaveBeenCalledWith(expect.objectContaining({ template: "cafe" }));
  });

  it("welcomes a first start with the ways in, each saying what it does (SC-3)", async () => {
    const example: TemplateSummary = {
      id: "cafe",
      category: "food",
      example: true,
      pages: 2,
      pageList: [],
      theme: "light",
      thumbnail: null,
    };
    const project = api([]);
    await render(project, vi.fn(), async () => [example]);

    expect(container.querySelector("h2")?.textContent).toBe("Get started");
    expect(container.textContent).toContain("Welcome to Webforge");
    const choices = [...container.querySelectorAll('[role="tabpanel"] li')].map(
      (item) => item.textContent,
    );
    expect(choices).toEqual([
      expect.stringContaining("Answer a few questions about your business"),
      expect.stringContaining("A finished example site"),
      expect.stringContaining("A site you've saved on this computer."),
    ]);
    const welcome = [...container.querySelectorAll<HTMLButtonElement>('[role="tabpanel"] button')];

    await act(async () =>
      welcome.find((each) => each.textContent?.includes("Open a site"))?.click(),
    );
    expect(project.open).toHaveBeenCalled();
    // New Site one click away (QS-4).
    await act(async () => welcome.at(-1)?.click());
    expect(document.body.textContent).toContain("Start from scratch");
  });

  it("lists the recent sites instead of the welcome once there are some", async () => {
    await render(api([bakery]));

    expect(container.textContent).not.toContain("Welcome to Webforge");
    expect(container.querySelector('input[type="search"]')).not.toBeNull();
  });

  it("never shows the welcome to a returning user while their sites load (#456 review)", async () => {
    const project = api([]);
    let answer: (sites: RecentSite[]) => void = () => undefined;
    project.listRecent.mockReturnValueOnce(
      new Promise<RecentSite[]>((resolve) => {
        answer = resolve;
      }),
    );
    await render(project);

    // Main hasn't answered yet: neither the welcome nor the list.
    expect(container.textContent).not.toContain("Welcome to Webforge");
    expect(container.querySelector('input[type="search"]')).toBeNull();

    await act(async () => answer([bakery]));
    expect(container.textContent).not.toContain("Welcome to Webforge");
    expect(container.textContent).toContain("Rosa's Bakery.wforge");
  });

  it("welcomes a first start whose list can't be read", async () => {
    const project = api([]);
    project.listRecent.mockRejectedValueOnce(new Error("unreadable"));
    await render(project);

    expect(container.textContent).toContain("Welcome to Webforge");
  });
});

/** How the window is handed an AI app's brief. */
type BriefOpener = (brief: SiteBrief, answer: (outcome: BriefOutcome) => Promise<void>) => void;

describe("an AI app's brief (4.12a, AIB-5)", () => {
  const trades: TemplateSummary = {
    id: "trades",
    category: "trades",
    example: false,
    pages: 3,
    pageList: [
      { id: "home", title: "Home", home: true },
      { id: "services", title: "Services", home: false },
      { id: "about", title: "About", home: false },
    ],
    theme: "workshop",
    thumbnail: null,
  };
  const brief: SiteBrief = {
    businessType: "trades",
    businessKind: "AutoRepair",
    name: "Rapidfix Vehicle Repair",
    whatYouDo: "Servicing, MOTs and repairs",
    leaveOut: ["about"],
    colours: { colour: "#C62828" },
    phone: "01234 567890",
  };

  /** The start screen, with a brief to hand it: what it was answered, in order. */
  async function withBrief(result?: ProjectResult) {
    let open: BriefOpener | undefined;
    const answers: string[] = [];
    const project = api([], result);
    const restart = vi.fn(() => answers.push("restart"));
    await render(project, restart, async () => [trades], {
      onBrief: (opener) => {
        open = opener;
        return () => undefined;
      },
    });
    const hand = async () =>
      act(async () => {
        open?.(brief, async (outcome) => {
          answers.push(outcome);
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    return { project, answers, hand };
  }

  const dialogButton = (name: string) =>
    [...document.querySelectorAll("[role=dialog] button")].find(
      (element) => element.textContent?.trim() === name,
    ) as HTMLButtonElement | undefined;

  it("opens the quick start filled in, and makes the site only when the person creates it", async () => {
    const { project, answers, hand } = await withBrief();

    await hand();
    expect(document.querySelector("[role=dialog]")?.textContent).toContain("Start a site");
    expect(project.create).not.toHaveBeenCalled();
    await act(async () => dialogButton("Create site")?.click());

    await vi.waitFor(() => expect(answers).toEqual(["created", "restart"]));
    const request = project.create.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      name: "Rapidfix Vehicle Repair",
      template: "trades",
      business: {
        description: "Servicing, MOTs and repairs",
        phone: "01234 567890",
        businessType: "trades",
        businessKind: "AutoRepair",
      },
      pages: { leaveOut: ["about"], recipes: [] },
    });
    expect(request?.themeTokens).toBeDefined();
  });

  it("answers declined when the person closes it, and makes nothing", async () => {
    const { project, answers, hand } = await withBrief();

    await hand();
    await act(async () => dialogButton("Cancel")?.click());

    expect(answers).toEqual(["declined"]);
    expect(project.create).not.toHaveBeenCalled();
  });

  it("answers declined when the site couldn't be made, and busy while one is shown", async () => {
    const failed = await withBrief({ status: "failed", reason: "newer-format" });
    await failed.hand();
    await failed.hand();
    expect(failed.answers).toEqual(["busy"]);
    await act(async () => dialogButton("Create site")?.click());

    await vi.waitFor(() => expect(failed.answers).toEqual(["busy", "declined"]));
  });
});
