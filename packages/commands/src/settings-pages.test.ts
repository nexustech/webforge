import type { PageId, SiteDoc } from "@webforge/model";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createCommandApi } from "./api.js";
import { app, home, type Setup, setup } from "./api.test-helper.js";
import { catalogueResourceText } from "./catalogue.js";

describe("the catalogue, offered (4.11, AIB-1)", () => {
  it("lists the types AI apps may add, by place, never the Header, Footer or Custom Code", () => {
    const api = createCommandApi(setup().host);

    const all = api.query("components", {});
    const sections = api.query("components", { place: "section" });

    expect(all.status).toBe("done");
    const types = (all as { data: { type: string; place: string }[] }).data;
    expect(types).toContainEqual(expect.objectContaining({ type: "Hero", place: "section" }));
    expect(types).toContainEqual(expect.objectContaining({ type: "Heading", place: "element" }));
    expect(types.map(({ type }) => type)).not.toContain("Header");
    expect(types.map(({ type }) => type)).not.toContain("CustomCode");
    const placed = (sections as { data: { place: string }[] }).data;
    expect(placed.length).toBeGreaterThan(0);
    expect(placed.every(({ place }) => place === "section")).toBe(true);
  });

  it("gives one type in full: its fields with their schemas, presets and defaults", () => {
    const api = createCommandApi(setup().host);

    const hero = api.query("components", { type: "Hero" });
    const section = api.query("components", { type: "Section" });

    expect(hero).toMatchObject({
      status: "done",
      data: {
        type: "Hero",
        label: "Hero",
        place: "section",
        fields: { title: { kind: "text", schema: expect.anything() } },
        defaults: expect.any(Object),
      },
    });
    // A slot says what it takes, not a value schema: never Custom Code.
    const slot = (section as { data: { fields: { content: { kind: string; takes: string[] } } } })
      .data.fields.content;
    expect(slot.kind).toBe("slot");
    expect(slot.takes).toContain("Heading");
    expect(slot.takes).not.toContain("CustomCode");
  });

  it("names the types there are when asked for one there isn't, or one AI apps can't add", () => {
    const api = createCommandApi(setup().host);

    for (const type of ["Carousel3000", "Header", "CustomCode"]) {
      const answer = api.query("components", { type });
      expect(answer).toMatchObject({ status: "invalid" });
      expect((answer as { message: string }).message).toMatch(
        new RegExp(`^There is no component "${type}"\\. There are: .*\\bHero\\b`),
      );
    }
  });

  it("says which types go there when addNode is given one there isn't", async () => {
    const { host, history } = setup();
    const api = createCommandApi(host);

    const atTop = await api.run(
      "addNode",
      { location: home(history), type: "Banner", values: {} },
      app,
    );
    const inSlot = await api.run(
      "addNode",
      { location: home(history), type: "Paragraph", parentId: "section", slot: "content" },
      app,
    );

    expect(atTop).toMatchObject({ status: "invalid" });
    const sections = (atTop as { message: string }).message;
    expect(sections).toMatch(/^There is no component "Banner"\. These go there: .*\bHero\b/);
    // Only sections go at the top of a page.
    expect(sections).not.toMatch(/\bHeading\b/);
    const elements = (inSlot as { message: string }).message;
    expect(elements).toMatch(/These go there: .*\bHeading\b/);
    expect(elements).not.toMatch(/\bHero\b/);
  });

  it("holds every type in full as a resource, the same as the query gives", () => {
    const api = createCommandApi(setup().host);
    const resource = JSON.parse(catalogueResourceText()) as Record<string, unknown>;

    expect(Object.keys(resource)).toEqual(
      (api.query("components", {}) as { data: { type: string }[] }).data.map(({ type }) => type),
    );
    expect(resource.Hero).toEqual(
      (api.query("components", { type: "Hero" }) as { data: unknown }).data,
    );
  });
});

/** The site's pages by title, as AI apps name them by id. */
const pages = (history: Setup["history"]) => {
  const doc = history.document.getState();
  const byTitle = (title: string) => {
    const page = Object.values(doc.pages).find((each) => each.title === title);
    if (page === undefined) throw new Error(`no page "${title}"`);
    return page;
  };
  return {
    home: doc.homePageId,
    notFound: byTitle("Not found").id,
    about: byTitle("About").id,
  };
};

/** The site's pages' titles, in order. */
const titles = (history: Setup["history"]) => {
  const doc = history.document.getState();
  return doc.pageOrder.map((id) => doc.pages[id]?.title);
};

/** Adds ordinary pages after About, before "Page not found", as `insertPage` would place them. */
function withPages(...more: readonly string[]) {
  return (doc: SiteDoc) => {
    for (const title of more) {
      const id = `page-${title.toLowerCase()}` as PageId;
      doc.pages[id] = {
        id,
        kind: "page",
        slug: title.toLowerCase(),
        title,
        settings: { hideHeader: false, hideFooter: false, hideFromNavigation: false },
        doc: { root: { props: {} }, content: [] },
      };
      doc.pageOrder.push(id);
    }
  };
}

describe("updateSettings, the business part of Site Settings (4.11, AIB-2)", () => {
  it("changes the business's details as one undo step, after one Allow naming the new phone", async () => {
    const { host, history, confirm } = setup();
    const api = createCommandApi(host);
    const before = history.document.getState().settings;

    const result = await api.run(
      "updateSettings",
      {
        general: { name: "Rosa's Garage", description: "Servicing and MOTs" },
        contact: {
          phone: "01234 567890",
          openingHours: [{ days: ["mon"], opens: "08:00", closes: "17:30" }],
        },
      },
      app,
    );

    expect(result).toEqual({
      status: "done",
      label: "AI (Claude): Changed Site Settings: General, Contact & hours",
    });
    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm.mock.calls[0]?.[0]).toEqual({
      action: "Allow Claude to change Site Settings: General, Contact & hours?",
      description: "Phone number: from no address to 01234 567890.",
      confirm: "Allow",
      affectedPages: history.document.getState().pageOrder.length,
      first: true,
    });
    const settings = history.document.getState().settings;
    expect(settings.general).toMatchObject({
      name: "Rosa's Garage",
      description: "Servicing and MOTs",
    });
    expect(settings.contact.openingHours).toHaveLength(1);
    // The rest stays as it was.
    expect(settings.analytics).toEqual(before.analytics);
    history.undo();
    expect(history.document.getState().settings).toEqual(before);
  });

  it("names the email and social profiles it changes, from what they were to what they'd be", async () => {
    const { host, confirm } = setup(true, (doc) => {
      doc.settings.contact.email = "rosa@example.com";
      doc.settings.social.profiles = [{ network: "facebook", url: "https://facebook.com/rosas" }];
    });
    const api = createCommandApi(host);

    await api.run(
      "updateSettings",
      {
        contact: { email: "bookings@example.com" },
        social: { profiles: [{ network: "facebook", url: "https://facebook.com/rosas-garage" }] },
      },
      app,
    );

    expect(confirm.mock.calls[0]?.[0].description).toBe(
      "Email address: from rosa@example.com to bookings@example.com. Facebook: from https://facebook.com/rosas to https://facebook.com/rosas-garage.",
    );
  });

  it("clears a setting given null, and changes nothing when the person says no", async () => {
    const cleared = setup(true, (doc) => {
      doc.settings.contact.email = "rosa@example.com";
    });
    await createCommandApi(cleared.host).run("updateSettings", { contact: { email: null } }, app);
    expect(cleared.history.document.getState().settings.contact.email).toBeUndefined();

    const declined = setup(false);
    const before = declined.history.document.getState();
    expect(
      await createCommandApi(declined.host).run(
        "updateSettings",
        { general: { name: "Elsewhere" } },
        app,
      ),
    ).toMatchObject({ status: "declined" });
    expect(declined.history.document.getState()).toBe(before);
  });

  it.each([
    ["publishing's", { publish: { destination: "netlify" } }, "publish"],
    ["forms'", { forms: { service: { kind: "netlify" } } }, "forms"],
    ["analytics'", { analytics: { measurementId: "G-ABC123DEF4" } }, "analytics"],
    [
      "Custom Code's addresses",
      { allowedExternalUrls: ["https://cdn.example.com"] },
      "allowedExternalUrls",
    ],
    ["the icon", { general: { icon: "media-1" } }, "icon"],
    ["the share image", { social: { shareImage: "media-1" } }, "shareImage"],
    [
      "search engines' verification codes",
      { search: { verification: { google: "abcdefgh12345678" } } },
      "verification",
    ],
  ])("refuses %s settings, which stay the person's", async (_, change, key) => {
    const { host, history, confirm } = setup();
    const before = history.document.getState();

    const result = await createCommandApi(host).run("updateSettings", change, app);

    expect(result).toMatchObject({ status: "invalid" });
    expect((result as { message: string }).message).toContain(`AI apps can't change ${key}`);
    expect(confirm).not.toHaveBeenCalled();
    expect(history.document.getState()).toBe(before);
  });

  it("names a new web address and hiding the site from search engines before they're allowed", async () => {
    const { host, confirm } = setup(true, (doc) => {
      doc.settings.address.url = "https://rosas.example";
    });

    await createCommandApi(host).run(
      "updateSettings",
      { address: { url: "https://rosas-garage.example" }, search: { allowIndexing: false } },
      app,
    );

    expect(confirm.mock.calls[0]?.[0]).toMatchObject({
      action: "Allow Claude to change Site Settings: Web address, Search engines?",
      description:
        "Web address: from https://rosas.example to https://rosas-garage.example. Let search engines show the site: from yes to no.",
    });
  });

  it("refuses values Site Settings don't take, and a change that changes nothing", async () => {
    const api = createCommandApi(setup().host);

    expect(
      await api.run("updateSettings", { contact: { email: "not an email" } }, app),
    ).toMatchObject({
      status: "invalid",
    });
    expect(await api.run("updateSettings", { general: { name: "" } }, app)).toMatchObject({
      status: "invalid",
    });
    expect(await api.run("updateSettings", {}, app)).toMatchObject({ status: "invalid" });
    expect(
      await api.run("updateSettings", { general: { name: "Rosa's Bakery" } }, app),
    ).toMatchObject({ status: "invalid", message: "Site Settings are already like that." });
  });
});

describe("the page tools (4.11, AIB-3)", () => {
  it("deletes a page after asking as Delete Page does, counting the pages that link to it", async () => {
    const { host, history, confirm } = setup(true, (doc) => {
      const homePage = doc.pages[doc.homePageId];
      const about = doc.pageOrder.at(-1);
      homePage?.doc.content.push({
        type: "Button",
        props: { id: "to-about", label: "About us", link: { kind: "page", pageId: about } },
      });
    });
    const api = createCommandApi(host);
    const { about } = pages(history);
    const before = history.document.getState();

    const result = await api.run("removePage", { pageId: about }, app);

    expect(result).toEqual({ status: "done", label: "AI (Claude): Deleted page 'About'" });
    expect(confirm.mock.calls[0]?.[0]).toEqual({
      action: "Allow Claude to delete the page About?",
      description: "This removes the page and its content.",
      confirm: "Allow",
      // About itself, and the home page, whose link to it breaks.
      affectedPages: 2,
    });
    expect(history.document.getState().pages[about]).toBeUndefined();
    history.undo();
    expect(history.document.getState()).toEqual(before);
  });

  it("never deletes the home page or Page not found, nor a page that isn't there", async () => {
    const { host, history, confirm } = setup();
    const api = createCommandApi(host);
    const { home: homePage, notFound } = pages(history);

    expect(await api.run("removePage", { pageId: homePage }, app)).toMatchObject({
      status: "refused",
    });
    expect(await api.run("removePage", { pageId: notFound }, app)).toMatchObject({
      status: "refused",
    });
    expect(await api.run("removePage", { pageId: "page-none" }, app)).toMatchObject({
      status: "not-found",
    });
    expect(confirm).not.toHaveBeenCalled();
  });

  it("renames a page, its file name following unless set by hand", async () => {
    const { host, history } = setup(true, withPages("Prices"));
    const api = createCommandApi(host);
    const { about } = pages(history);
    const prices = "page-prices" as PageId;
    history.run("Set by hand", (draft) => {
      const page = draft.pages[prices];
      if (page !== undefined) page.slug = "our-prices";
    });

    expect(await api.run("renamePage", { pageId: about, title: "About us" }, app)).toEqual({
      status: "done",
      label: "AI (Claude): Renamed page 'About us'",
    });
    await api.run("renamePage", { pageId: prices, title: "Price list" }, app);

    const doc = history.document.getState();
    expect(doc.pages[about]).toMatchObject({ title: "About us", slug: "about-us" });
    expect(doc.pages[prices]).toMatchObject({ title: "Price list", slug: "our-prices" });
    expect(await api.run("renamePage", { pageId: about, title: " About us " }, app)).toMatchObject({
      status: "invalid",
    });
  });

  it("moves a page up or down among its folder's pages, steps at a time, as one step", async () => {
    const { host, history } = setup(true, withPages("Prices", "Contact"));
    const api = createCommandApi(host);

    expect(
      await api.run("movePage", { pageId: "page-contact", direction: "up", steps: 2 }, app),
    ).toEqual({ status: "done", label: "AI (Claude): Moved page 'Contact'" });
    // Each step swaps it with the page above it then, as the Pages panel's arrow does.
    expect(titles(history)).toEqual(["Home", "Not found", "Contact", "About", "Prices"]);
    history.undo();
    expect(titles(history).at(-1)).toBe("Contact");

    expect(
      await api.run("movePage", { pageId: "page-contact", direction: "down" }, app),
    ).toMatchObject({ status: "invalid", message: "The page is already the last in its folder." });
    expect(
      await api.run("movePage", { pageId: "page-contact", direction: "up", steps: 50 }, app),
    ).toMatchObject({ status: "invalid" });
  });

  it("changes a page's title, description and switches as Page Settings does, its file name kept", async () => {
    const { host, history } = setup();
    const api = createCommandApi(host);
    const { about, notFound } = pages(history);

    expect(
      await api.run(
        "updatePageSettings",
        {
          pageId: about,
          title: "About Rosa's",
          description: "Who we are",
          hideFromNavigation: true,
          hideFromSearch: true,
        },
        app,
      ),
    ).toEqual({ status: "done", label: "AI (Claude): Changed page settings" });
    expect(history.document.getState().pages[about]).toMatchObject({
      title: "About Rosa's",
      slug: "about",
      settings: { description: "Who we are", hideFromNavigation: true, hideFromSearch: true },
    });

    await api.run(
      "updatePageSettings",
      { pageId: about, description: "", hideFromSearch: false },
      app,
    );
    const settings = history.document.getState().pages[about]?.settings;
    expect(settings?.description).toBeUndefined();
    expect(settings?.hideFromSearch).toBeUndefined();

    expect(
      await api.run("updatePageSettings", { pageId: notFound, hideFromNavigation: false }, app),
    ).toMatchObject({ status: "refused" });
    expect(await api.run("updatePageSettings", { pageId: about }, app)).toMatchObject({
      status: "invalid",
    });
    // Settings it already has: no step, as renamePage and updateSettings refuse theirs.
    const steps = history.state.getState().entries.length;
    expect(
      await api.run(
        "updatePageSettings",
        { pageId: about, title: "About Rosa's", description: "", hideFromNavigation: true },
        app,
      ),
    ).toEqual({ status: "invalid", message: "The page's settings are already like that." });
    expect(history.state.getState().entries.length).toBe(steps);
  });
});

describe("Content mode's rules for the new tools (4.11, §5.10)", () => {
  /** A command's answer in Content mode. */
  async function inContentMode(name: string, input: unknown, edit?: (doc: SiteDoc) => void) {
    const { host, history } = setup(true, (doc) => {
      withPages("Prices")(doc);
      edit?.(doc);
    });
    host.mode = () => "content";
    return { result: await createCommandApi(host).run(name, input, app), history };
  }

  it("allows the catalogue, and the business's name, description, contact details, hours and profiles", async () => {
    const { host } = setup();
    host.mode = () => "content";
    expect(createCommandApi(host).query("components", {})).toMatchObject({ status: "done" });

    for (const change of [
      { general: { name: "Rosa's Garage", description: "MOTs" } },
      { contact: { phone: "01234 567890", openingHoursNote: "Closed on bank holidays" } },
      { social: { profiles: [{ network: "instagram", url: "https://instagram.com/rosas" }] } },
    ]) {
      expect((await inContentMode("updateSettings", change)).result).toMatchObject({
        status: "done",
      });
    }
  });

  it("allows a page's title and description, not its switches", async () => {
    const allowed = await inContentMode("updatePageSettings", {
      pageId: "page-prices",
      title: "Our prices",
      description: "What it costs",
    });
    expect(allowed.result).toMatchObject({ status: "done" });

    for (const input of [
      { pageId: "page-prices", hideFromNavigation: true },
      { pageId: "page-prices", title: "Prices", hideFromSearch: true },
    ]) {
      expect((await inContentMode("updatePageSettings", input)).result).toMatchObject({
        status: "refused",
      });
    }
  });

  it("refuses the language, business type and kind, web address and search settings", async () => {
    for (const change of [
      { general: { language: "fr" } },
      { general: { businessType: "trades" } },
      { general: { businessKind: "AutoRepair" } },
      { address: { url: "https://rosas.example" } },
      { search: { allowIndexing: false } },
      { general: { name: "Rosa's Garage" }, search: { includeSitemap: false } },
    ]) {
      const { result, history } = await inContentMode("updateSettings", change);
      expect(result).toMatchObject({ status: "refused" });
      expect(history.document.getState().settings.general.name).toBe("Rosa's Bakery");
    }
  });

  it("refuses moving, renaming and deleting pages", async () => {
    for (const [name, input] of [
      ["movePage", { pageId: "page-prices", direction: "up" }],
      ["renamePage", { pageId: "page-prices", title: "Price list" }],
      ["removePage", { pageId: "page-prices" }],
    ] as const) {
      expect((await inContentMode(name, input)).result).toMatchObject({ status: "refused" });
    }
  });
});

describe("the new commands (4.11, property)", () => {
  it("are each one undo step labelled for the app, and undoing them all restores the site", async () => {
    const step = fc.oneof(
      fc.record({
        name: fc.constant("addPage"),
        title: fc.string({ minLength: 1, maxLength: 12 }),
      }),
      fc.record({ name: fc.constant("removePage"), at: fc.nat(8) }),
      fc.record({
        name: fc.constant("renamePage"),
        at: fc.nat(8),
        title: fc.string({ minLength: 1, maxLength: 12 }),
      }),
      fc.record({
        name: fc.constant("movePage"),
        at: fc.nat(8),
        direction: fc.constantFrom("up", "down"),
        steps: fc.integer({ min: 1, max: 3 }),
      }),
      fc.record({
        name: fc.constant("updatePageSettings"),
        at: fc.nat(8),
        description: fc.string({ maxLength: 20 }),
        hideFromSearch: fc.boolean(),
      }),
      fc.record({
        name: fc.constant("updateSettings"),
        siteName: fc.string({ minLength: 1, maxLength: 20 }),
      }),
    );
    await fc.assert(
      fc.asyncProperty(fc.array(step, { maxLength: 10 }), async (steps) => {
        const { history, host } = setup(true, withPages("Prices", "Contact"));
        const api = createCommandApi(host);
        const states = [history.document.getState()];
        for (const each of steps) {
          const order = history.document.getState().pageOrder;
          const pageId = "at" in each ? order[each.at % order.length] : undefined;
          const {
            name,
            at: _at,
            siteName,
            ...rest
          } = each as typeof each & {
            at?: number;
            siteName?: string;
          };
          const input =
            name === "updateSettings"
              ? { general: { name: siteName } }
              : pageId === undefined
                ? rest
                : { pageId, ...rest };
          const result = await api.run(name, input, app);
          const entries = history.state.getState().entries;
          const now = history.document.getState();
          if (result.status === "done" && now !== states.at(-1)) {
            expect(entries.length).toBe(states.length);
            expect(entries.at(-1)?.label).toBe(result.label);
            expect(result.label.startsWith("AI (Claude): ")).toBe(true);
            states.push(now);
          } else {
            // Refused (the home page, "Page not found", the end of a folder…): no step.
            expect(entries.length).toBe(states.length - 1);
            expect(now).toBe(states.at(-1));
          }
        }
        for (let at = states.length - 1; at > 0; at--) {
          history.undo();
          expect(history.document.getState()).toEqual(states[at - 1]);
        }
      }),
      { numRuns: 60 },
    );
  });
});
