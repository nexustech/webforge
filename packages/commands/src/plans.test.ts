import type { SiteDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { createCommandApi } from "./api.js";
import { app, content, home, setup } from "./api.test-helper.js";

/** The test site's About page's id. */
const aboutOf = (doc: SiteDoc) => {
  const page = Object.values(doc.pages).find((each) => each.title === "About");
  if (page === undefined) throw new Error("no About page");
  return page.id;
};

describe("a plan (4.12a, AIB-6)", () => {
  it("is one summary, one Allow and one undo step for everything in it", async () => {
    const { host, history, confirm } = setup();
    const api = createCommandApi(host);
    const before = history.document.getState();
    const about = aboutOf(before);

    const result = await api.run(
      "plan",
      {
        title: "Build the Rapidfix site",
        commands: [
          { name: "addPage", input: { title: "Services" } },
          { name: "removePage", input: { pageId: about } },
          { name: "addNode", input: { location: home(history), type: "Hero" } },
          {
            name: "editText",
            input: { location: home(history), nodeId: "heading", field: "text", text: "Rapidfix" },
          },
          { name: "updateSettings", input: { contact: { phone: "01234 567890" } } },
          { name: "setThemeTokens", input: { tokens: { radius: { box: "l" } } } },
        ],
      },
      app,
    );

    expect(result).toEqual({ status: "done", label: "AI (Claude): Build the Rapidfix site" });
    expect(confirm).toHaveBeenCalledOnce();
    const asked = confirm.mock.calls[0]?.[0];
    expect(asked?.action).toBe("Allow Claude to make these changes: Build the Rapidfix site?");
    expect(asked?.description).toContain('It adds the pages "Services".');
    expect(asked?.description).toContain('It deletes the pages "About".');
    expect(asked?.description).toContain("It changes the theme.");
    expect(asked?.description).toContain(
      "Sections and elements: 1 added, 1 changed, 0 moved, 0 removed.",
    );
    // What each would have asked on its own, the phone named from and to.
    expect(asked?.description).toContain("On their own, these would each have asked first:");
    expect(asked?.description).toContain("Allow Claude to delete the page About?");
    expect(asked?.description).toContain("Phone number: from no address to 01234 567890.");
    expect(asked?.description).toContain("Allow Claude to change the theme?");

    const after = history.document.getState();
    expect(history.state.getState().entries).toHaveLength(1);
    expect(after.pages[about]).toBeUndefined();
    expect(Object.values(after.pages).map(({ title }) => title)).toContain("Services");
    expect(after.settings.contact.phone).toBe("01234 567890");
    expect(content(history).map(({ type }) => type)).toContain("Hero");
    history.undo();
    expect(history.document.getState()).toEqual(before);
  });

  it("changes nothing when one command can't be done, saying which, and asks nothing", async () => {
    const { host, history, confirm } = setup();
    const api = createCommandApi(host);
    const before = history.document.getState();

    const result = await api.run(
      "plan",
      {
        title: "Build it",
        commands: [
          { name: "addPage", input: { title: "Services" } },
          { name: "addNode", input: { location: home(history), type: "Carousel3000" } },
        ],
      },
      app,
    );

    expect(result).toMatchObject({ status: "invalid" });
    expect((result as { message: string }).message).toMatch(
      /^Command 2 \(addNode\): There is no component "Carousel3000"\..* Nothing changed\.$/,
    );
    expect(confirm).not.toHaveBeenCalled();
    expect(history.document.getState()).toBe(before);
  });

  it("plans each command against the site as the ones before it leave it", async () => {
    const { host, history } = setup();
    const api = createCommandApi(host);
    const about = aboutOf(history.document.getState());

    // The page is gone by the time the second command is planned.
    const result = await api.run(
      "plan",
      {
        title: "Tidy the pages",
        commands: [
          { name: "removePage", input: { pageId: about } },
          { name: "renamePage", input: { pageId: about, title: "About us" } },
        ],
      },
      app,
    );

    expect(result).toMatchObject({ status: "not-found" });
    expect((result as { message: string }).message).toMatch(/^Command 2 \(renamePage\): /);
  });

  it("changes nothing when the person says no, and holds no plan of its own", async () => {
    const declined = setup(false);
    const before = declined.history.document.getState();
    expect(
      await createCommandApi(declined.host).run(
        "plan",
        { title: "Build it", commands: [{ name: "addPage", input: { title: "Services" } }] },
        app,
      ),
    ).toMatchObject({ status: "declined" });
    expect(declined.history.document.getState()).toBe(before);

    const nested = await createCommandApi(setup().host).run(
      "plan",
      {
        title: "Plans in plans",
        commands: [{ name: "plan", input: { title: "Inner", commands: [] } }],
      },
      app,
    );
    expect(nested).toMatchObject({ status: "invalid" });
  });

  it("tells the window the pages it deletes, so one shown is replaced by the Home page", async () => {
    const { host, history } = setup();
    const about = aboutOf(history.document.getState());

    await createCommandApi(host).run(
      "plan",
      {
        title: "Fewer pages",
        commands: [{ name: "removePage", input: { pageId: about } }],
      },
      app,
    );

    expect(host.run).toHaveBeenCalledWith(
      "AI (Claude): Fewer pages",
      expect.any(Function),
      "remove",
      [about],
    );
  });
});

describe("a plan in Content mode (4.12a, §5.10)", () => {
  it("runs when every command in it is content, and is refused whole when one isn't", async () => {
    const allowed = setup();
    allowed.host.mode = () => "content";
    expect(
      await createCommandApi(allowed.host).run(
        "plan",
        {
          title: "New words",
          commands: [
            {
              name: "editText",
              input: {
                location: home(allowed.history),
                nodeId: "heading",
                field: "text",
                text: "Hello",
              },
            },
            { name: "updateSettings", input: { general: { name: "Rapidfix" } } },
          ],
        },
        app,
      ),
    ).toMatchObject({ status: "done" });

    const refused = setup();
    refused.host.mode = () => "content";
    const before = refused.history.document.getState();
    expect(
      await createCommandApi(refused.host).run(
        "plan",
        {
          title: "New words and a section",
          commands: [
            {
              name: "editText",
              input: {
                location: home(refused.history),
                nodeId: "heading",
                field: "text",
                text: "Hello",
              },
            },
            { name: "addNode", input: { location: home(refused.history), type: "Hero" } },
          ],
        },
        app,
      ),
    ).toMatchObject({ status: "refused" });
    expect(refused.history.document.getState()).toBe(before);
  });
});
