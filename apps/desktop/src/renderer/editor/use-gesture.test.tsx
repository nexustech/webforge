// @vitest-environment happy-dom
import type { SiteDoc } from "@webforge/model";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sessionWith } from "../testing/fixtures.js";
import { type EditorSession, runHistoryCommand } from "./editor-session.js";
import { type GestureControls, useGesture } from "./use-gesture.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const setName = (name: string) => (draft: SiteDoc) => {
  draft.settings.general.name = name;
};

describe("useGesture", () => {
  let container: HTMLDivElement;
  let root: Root;
  let session: EditorSession;
  let controls: GestureControls;

  /** Stands in for a slider: hands its gesture controls to the test. */
  function Slider() {
    controls = useGesture(session, "props", "Changed site name");
    return null;
  }

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    session = sessionWith();
    await act(async () => root.render(<Slider />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const name = () => session.history.document.getState().settings.general.name;
  const labels = () => session.history.entries().map((entry) => entry.label);

  it("makes one undo step of a drag", () => {
    controls.update(setName("A"));
    controls.update(setName("AB"));
    expect(name()).toBe("AB");
    controls.commit();

    expect(labels()).toEqual(["Changed site name"]);
    session.history.undo();
    expect(name()).toBe("My site");
  });

  it("starts a new step with the next drag", () => {
    controls.update(setName("A"));
    controls.commit();
    controls.update(setName("B"));
    controls.commit();

    expect(labels()).toEqual(["Changed site name", "Changed site name"]);
  });

  it("is cancelled by Esc and by its own cancel", () => {
    controls.update(setName("A"));
    expect(runHistoryCommand(session, "cancel")).toBe(true);
    // A commit after Esc records nothing.
    controls.commit();
    controls.update(setName("B"));
    controls.cancel();
    controls.cancel();

    expect(name()).toBe("My site");
    expect(labels()).toEqual([]);
  });

  it("cancels a drag still in progress when the control goes away", async () => {
    controls.update(setName("A"));

    await act(async () => root.render(<></>));

    expect(name()).toBe("My site");
    expect(session.cancelGesture()).toBe(false);
  });
});
