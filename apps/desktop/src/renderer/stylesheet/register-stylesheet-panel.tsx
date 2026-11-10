import { toast } from "@webforge/editor-ui";
import type { ReadonlyStore } from "@webforge/history";
import { plural, t } from "@webforge/i18n";
import { FileCode2Icon } from "lucide-react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { CanvasApi } from "../../shared/ipc/canvas.js";
import type { EditorSession } from "../editor/editor-session.js";
import { type ClassCatalogue, useClassCatalogue } from "../fields/index.js";
import { reportFailure } from "../log.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import type { CommandRegistry } from "../shell/commands.js";
import type { PanelRegistry } from "../shell/panels.js";
import type { PreferencesStore } from "../shell/preferences-store.js";
import { StylesheetPanel } from "./StylesheetPanel.js";
import {
  editStylesheet,
  moveLookToCss,
  type StylesheetSession,
  stylesheetOf,
  targetSelected,
} from "./stylesheet-actions.js";
import { type StylesheetFacts, stylesheetFacts } from "./stylesheet-data.js";

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

/** The panel's two commands on the selected element, in the command box. */
const STYLESHEET_COMMANDS = {
  target: "stylesheet.target",
  moveLook: "stylesheet.moveLook",
} as const;

/**
 * Puts the Stylesheet panel (CT-8, 6.8) in the bottom drawer, in Advanced mode only, with *View ›
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
    targetSelected(session, options.canvas())
      .then((done) => {
        if ("refused" in done) {
          toast(done.refused);
          return;
        }
        show();
        caret.setState({ at: done.caret }, true);
      })
      .catch((error: unknown) => reportFailure("stylesheet.target", error));
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

  /**
   * What completion and lint read of the site, worked out again only when what it's made of
   * changes: the pages, the Header and Footer, the shared sections, the theme or the catalogue.
   * Typing in the stylesheet changes none of them, so a pause in it renders nothing again.
   */
  let siteFacts: (StylesheetFacts & { readonly made: readonly unknown[] }) | null = null;
  const factsFor = (catalogue: ClassCatalogue | undefined) => {
    const site = session.history.document.getState();
    const made = [site.pages, site.layout, site.sharedSections, site.theme, catalogue];
    if (siteFacts?.made.every((part, index) => part === made[index]) === true) return siteFacts;
    siteFacts = { made, ...stylesheetFacts(site, session, catalogue) };
    return siteFacts;
  };

  function Stylesheet() {
    const theme = useStore(session.history.document, (site) => site.theme);
    const hasSelection = useStore(session.ui, (ui) => ui.nodeId !== null);
    const at = useStore(caret);
    const catalogue = useClassCatalogue(options.canvas, theme);
    return (
      <StylesheetPanel
        css={stylesheetOf(session.history.document.getState())}
        followCss={(show) => session.history.document.subscribe((site) => show(stylesheetOf(site)))}
        onChange={(next) => editStylesheet(session, next)}
        siteData={() => factsFor(catalogue).data}
        lintData={() => {
          const facts = factsFor(catalogue);
          return {
            site: session.history.document.getState(),
            variables: facts.data.variables,
            used: facts.used,
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
