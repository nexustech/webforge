// @vitest-environment happy-dom
import type { SiteDoc } from "@webforge/model";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoreApi } from "zustand/vanilla";
import type { EditorSession } from "../editor/editor-session.js";
import { sessionWith } from "../testing/fixtures.js";
import { AutosaveStatus } from "./AutosaveStatus.js";
import type { SaveStatus as Status } from "./autosave.js";
import type { LoadedSite } from "./load-site.js";
import { type AutosaveApi, useAutosave } from "./use-autosave.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let session: EditorSession;
let api: AutosaveApi & { project: { commit: ReturnType<typeof vi.fn> } };
let flushRequest: (() => Promise<void>) | undefined;
let returned: StoreApi<{ readonly status: Status }> | undefined;

function Harness({ loaded }: { loaded: LoadedSite | undefined }) {
  returned = useAutosave(session, loaded, api);
  return null;
}

/** The component the shell mounts, rendered with the test's API. */
function MountedStatus({ loaded }: { loaded: LoadedSite | undefined }) {
  return <AutosaveStatus session={session} loaded={loaded} api={api} />;
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  session = sessionWith();
  flushRequest = undefined;
  api = {
    project: { commit: vi.fn(async () => ({ status: "saved" as const })) },
    app: {
      onFlushRequest: (save) => {
        flushRequest = save;
        return () => {
          flushRequest = undefined;
        };
      },
    },
  };
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const site = () => session.history.document.getState();
const rename = (draft: SiteDoc) => {
  draft.settings.general.name = "Rosa's";
};

describe("useAutosave", () => {
  it("returns no save status without a site file", async () => {
    await act(async () => root.render(<Harness loaded={undefined} />));

    expect(returned).toBeUndefined();
  });

  it("shows no save status for a site in memory and never saves it", async () => {
    await act(async () => root.render(<MountedStatus loaded={{ kind: "memory", site: site() }} />));

    session.edit("props", "Changed site name", rename);
    await act(async () => window.dispatchEvent(new Event("blur")));

    expect(container.textContent).toBe("");
    expect(api.project.commit).not.toHaveBeenCalled();
  });

  it("saves an open site file and shows Saved and Saving…", async () => {
    await act(async () =>
      root.render(<MountedStatus loaded={{ kind: "file", site: site(), saved: site() }} />),
    );
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Saved");

    await act(async () => session.edit("props", "Changed site name", rename));
    expect(container.textContent).toBe("Saving…");

    await act(async () => flushRequest?.());
    expect(api.project.commit).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe("Saved");
  });

  it("stops saving when the editor goes away", async () => {
    await act(async () =>
      root.render(<Harness loaded={{ kind: "file", site: site(), saved: site() }} />),
    );
    await act(async () => root.render(null));

    session.edit("props", "Changed site name", rename);
    window.dispatchEvent(new Event("blur"));

    expect(flushRequest).toBeUndefined();
    expect(api.project.commit).not.toHaveBeenCalled();
  });
});

describe("SaveStatus", () => {
  it("says when a save failed", async () => {
    api.project.commit.mockResolvedValue({ status: "failed", reason: "unknown" });
    await act(async () =>
      root.render(<MountedStatus loaded={{ kind: "file", site: site(), saved: site() }} />),
    );
    session.edit("props", "Changed site name", rename);

    await act(async () => flushRequest?.());

    expect(container.textContent).toBe("Not saved. Webforge will try again.");
  });
});
