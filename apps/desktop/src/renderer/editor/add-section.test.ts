import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { addSection } from "./add-section.js";
import { createEditorSession, currentPage } from "./editor-session.js";
import { starterSite } from "./starter-site.js";

/** The shown page's top-level elements. */
const content = (session: ReturnType<typeof createEditorSession>) =>
  currentPage(session)?.doc.content ?? [];

describe("addSection", () => {
  it("adds an empty Section at the point, as one step that selects it", () => {
    const session = createEditorSession(siteLibrary, starterSite());

    addSection(session, { index: 1 });

    const added = content(session)[1];
    expect(content(session)).toHaveLength(2);
    expect(added).toMatchObject({ type: "Section", props: { padding: "medium", content: [] } });
    expect(session.history.entries().map((entry) => entry.label)).toEqual(["Added Section"]);
    expect(session.ui.getState().nodeId).toBe(added?.props.id);
    session.history.undo();
    expect(content(session)).toHaveLength(1);
  });

  it("adds at the end when the point is past it, and nothing without a Section component", () => {
    const session = createEditorSession(siteLibrary, starterSite());
    addSection(session, { index: 9 });
    expect(content(session).at(-1)?.type).toBe("Section");

    const bare = createEditorSession({ components: {} }, starterSite());
    addSection(bare, { index: 0 });
    expect(bare.history.entries()).toEqual([]);
  });
});
