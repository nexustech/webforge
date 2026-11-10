import { toast } from "@webforge/editor-ui";
import type { ReadonlyStore } from "@webforge/history";
import { plural, t } from "@webforge/i18n";
import { anchorsIn } from "@webforge/model";
import { FileCode2Icon } from "lucide-react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { CanvasApi } from "../../shared/ipc/canvas.js";
import type { EditorSession } from "../editor/editor-session.js";
import { siteSelectors } from "../editor/site-css.js";
import { useClassCatalogue } from "../fields/classes/class-catalogue.js";
import { reportFailure } from "../log.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import type { CommandRegistry } from "../shell/commands.js";
import type { PanelRegistry } from "../shell/panels.js";
import type { PreferencesStore } from "../shell/preferences-store.js";
import { type CssSiteData, themeVariables } from "./css-language.js";
import { StylesheetPanel } from "./StylesheetPanel.js";
import {
  editStylesheet,
  moveLookToCss,
  type StylesheetSession,
  stylesheetOf,
  targetSelected,
} from "./stylesheet-actions.js";

/** The Stylesheet panel's id. */
export const STYLESHEET_PANEL_ID = "stylesheet";

/** What the panel works on. */
export type StylesheetPanelOptions = {
  readonly session: StylesheetSession & Pick<EditorSession, "history">;
  readonly panels: PanelRegistry;
  readonly commands: Pick<CommandRegistry, "register" | "update" | "run">;
  readonly preferences: Pick<PreferencesStore, "getState" | "subscribe">;
  /** The canvas styles worker: the class catalogue, an item's markup and its classes' CSS. */
  readonly canvas: () => CanvasApi;
  /** Whether the owner has confirmed the addresses Settings allow (#649). */
  readonly allowListConfirmed: ReadonlyStore<boolean>;
};

/**
 * Puts the Stylesheet panel (CT-8, 6.8) in the bottom drawer, in Advanced mode only, with *Site ›
 * Stylesheet* to show it and *Target this element* and *Move this look to CSS* in the command box.
 * Returns a function that removes them.
 */
export function registerStylesheetPanel(options: StylesheetPanelOptions): () => void {
  const { session, panels, commands, preferences } = options;
  /** Where the caret goes next: a new object each time, so the same position moves it again. */
  const caret = createStore<{ readonly at: number } | undefined>(() => undefined);

  const show = () => {
    panels.show(STYLESHEET_PANEL_ID);
  };
  const target = () => {
    const done = targetSelected(session);
    if ("refused" in done) {
      toast(done.refused);
      return;
    }
    show();
    caret.setState({ at: done.caret }, true);
  };
  const moveLook = () => {
    moveLookToCss(session, options.canvas())
      .then((done) => {
        if ("refused" in done) {
          toast(done.refused);
          return;
        }
        show();
        caret.setState({ at: done.caret }, true);
        if (done.kept > 0) toast(plural("stylesheet.move.kept", done.kept));
      })
      .catch((error: unknown) => reportFailure("stylesheet.moveLook", error));
  };

  function Stylesheet() {
    const css = useStore(session.history.document, stylesheetOf);
    const theme = useStore(session.history.document, (site) => site.theme);
    const hasSelection = useStore(session.ui, (ui) => ui.nodeId !== null);
    const at = useStore(caret);
    const catalogue = useClassCatalogue(options.canvas, theme);
    const siteData = (): CssSiteData => {
      const site = session.history.document.getState();
      const used = siteSelectors(site, session);
      const anchors = new Set<string>();
      for (const page of Object.values(site.pages)) anchorsIn(page.doc.content, anchors);
      return {
        variables: themeVariables(site.theme),
        classes: [...new Set([...[...used.classes].sort(), ...(catalogue?.classes ?? [])])],
        ids: [...anchors].sort(),
      };
    };
    return (
      <StylesheetPanel
        css={css}
        onChange={(next) => editStylesheet(session, next)}
        siteData={siteData}
        lintData={() => {
          const site = session.history.document.getState();
          return {
            site,
            variables: themeVariables(site.theme),
            used: siteSelectors(site, session),
            allowListConfirmed: options.allowListConfirmed.getState(),
          };
        }}
        hasSelection={hasSelection}
        onTarget={target}
        onMoveLook={moveLook}
        caret={at}
      />
    );
  }

  const removePanel = panels.register({
    id: STYLESHEET_PANEL_ID,
    slot: "drawer",
    title: t("stylesheet.panelTitle"),
    icon: FileCode2Icon,
    advancedOnly: true,
    component: Stylesheet,
  });
  // The commands work in Advanced mode only, as the panel is there.
  const advanced = () => preferences.getState().preferences.editorLevel === "advanced";
  let enabled = advanced();
  const removeCommands = [
    commands.register({
      id: COMMAND_IDS.stylesheet,
      label: t("stylesheet.command"),
      menu: "view",
      enabled,
      keywords: ["CSS", "custom.css"],
      run: show,
    }),
    commands.register({
      id: STYLESHEET_COMMANDS.target,
      label: t("stylesheet.target"),
      enabled,
      keywords: ["CSS"],
      run: target,
    }),
    commands.register({
      id: STYLESHEET_COMMANDS.moveLook,
      label: t("stylesheet.move"),
      enabled,
      keywords: ["CSS"],
      run: moveLook,
    }),
  ];
  const stopFollowing = preferences.subscribe(() => {
    if (advanced() === enabled) return;
    enabled = !enabled;
    for (const id of [COMMAND_IDS.stylesheet, ...Object.values(STYLESHEET_COMMANDS)]) {
      commands.update(id, { enabled });
    }
  });
  return () => {
    stopFollowing();
    for (const remove of removeCommands) remove();
    removePanel();
  };
}

/** The panel's two commands on the selected element, in the command box. */
export const STYLESHEET_COMMANDS = {
  target: "stylesheet.target",
  moveLook: "stylesheet.moveLook",
} as const;
