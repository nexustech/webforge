import { t } from "@webforge/i18n";
import { describe, expect, it, vi } from "vitest";
import type { EditorContext } from "../editor/areas.js";
import { createPreviewStore } from "../editor/edit-previews.js";
import { createEngineHost } from "../editor/engine-host.js";
import { createImagePickRequests } from "../editor/image-picks.js";
import { registriesForTest, sessionWith } from "../testing/fixtures.js";
import { fakePreloadApi } from "../testing/preload.js";
import { editPanelArea } from "./area.js";

describe("editPanelArea (#668)", () => {
  it("registers the Edit panel in the right column's top, and removes it", () => {
    const registries = registriesForTest();
    const ctx: EditorContext = {
      ...registries,
      api: fakePreloadApi(),
      session: sessionWith(),
      engine: createEngineHost(),
      compileCss: async () => ({ status: "failed" }),
      sectionPreviews: () => null,
      editPreviews: createPreviewStore(),
      dialogs: { nameSharedSection: vi.fn(), rename: vi.fn(), pickImage: vi.fn() },
      imagePicks: createImagePickRequests(),
    };

    const remove = editPanelArea.register(ctx);

    expect(registries.panels.list()).toEqual([
      expect.objectContaining({ id: "edit", slot: "right.top", title: t("editPanel.title") }),
    ]);

    remove();
    expect(registries.panels.list()).toEqual([]);
  });
});
