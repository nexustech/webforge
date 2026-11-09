import type { Viewport } from "@webforge/engine";
import { type MessageKey, t } from "@webforge/i18n";
import { type CanvasView, zoomStep } from "./canvas-view.js";
import { COMMAND_IDS } from "./command-ids.js";
import type { CommandRegistry } from "./commands.js";
import type { PreferencesStore } from "./preferences-store.js";

/**
 * The View menu's zoom and device views (F-ED-27: Mod + =/−/0/9 and Mod + 1/2/3), as the canvas
 * toolbar sets them: view state, never an undo step (U6). Zooming in or out goes one of the
 * toolbar's levels from the scale the canvas shows, Fit's included. Returns a function that removes
 * them.
 */
export function registerViewCommands(
  registry: CommandRegistry,
  session: { setViewport(viewport: Viewport): void },
  view: CanvasView,
): () => void {
  const shownScale = () => {
    const { zoom, size } = view.getState();
    return typeof zoom === "number" ? zoom : (size?.zoom ?? 1);
  };
  const zoomTo = (zoom: number | "fit") => () => view.setState({ zoom });
  const show = (viewport: Viewport) => () => session.setViewport(viewport);
  const removers = [
    registry.register({
      id: COMMAND_IDS.zoomIn,
      label: t("command.zoomIn"),
      menu: "view",
      run: () => view.setState({ zoom: zoomStep(shownScale(), "in") }),
    }),
    registry.register({
      id: COMMAND_IDS.zoomOut,
      label: t("command.zoomOut"),
      menu: "view",
      run: () => view.setState({ zoom: zoomStep(shownScale(), "out") }),
    }),
    registry.register({
      id: COMMAND_IDS.zoomActual,
      label: t("command.zoomActual"),
      menu: "view",
      run: zoomTo(1),
    }),
    registry.register({
      id: COMMAND_IDS.zoomFit,
      label: t("command.zoomFit"),
      menu: "view",
      run: zoomTo("fit"),
    }),
    registry.register({
      id: COMMAND_IDS.desktopView,
      label: t("command.desktopView"),
      menu: "view",
      run: show("desktop"),
    }),
    registry.register({
      id: COMMAND_IDS.tabletView,
      label: t("command.tabletView"),
      menu: "view",
      run: show("tablet"),
    }),
    registry.register({
      id: COMMAND_IDS.mobileView,
      label: t("command.mobileView"),
      menu: "view",
      run: show("mobile"),
    }),
  ];
  return () => {
    for (const remove of removers) remove();
  };
}

/** The canvas's View options with a key (#857), each named for what choosing it does. */
const VIEW_OPTION_COMMANDS = [
  {
    id: COMMAND_IDS.showOutlines,
    option: "showOutlines",
    show: "command.showOutlines",
    hide: "command.hideOutlines",
  },
  {
    id: COMMAND_IDS.elementNames,
    option: "elementNames",
    show: "command.showElementNames",
    hide: "command.hideElementNames",
  },
] as const satisfies readonly {
  readonly id: string;
  readonly option: "showOutlines" | "elementNames";
  readonly show: MessageKey;
  readonly hide: MessageKey;
}[];

/**
 * View → Show/Hide Outlines and Show/Hide Element Names (#857, product/06 §5): the canvas
 * toolbar's View options, turned on and off from the keyboard. A preference, never an undo step
 * (U6). Each is named for what it does now, so it's registered again when its option changes.
 * Returns a function that removes them.
 */
export function registerViewOptionCommands(
  registry: CommandRegistry,
  preferences: Pick<PreferencesStore, "getState" | "subscribe" | "change">,
): () => void {
  const removers = new Map<string, () => void>();
  const shown = new Map<string, boolean>();
  const register = () => {
    const { canvas } = preferences.getState().preferences;
    for (const { id, option, show, hide } of VIEW_OPTION_COMMANDS) {
      const on = canvas[option];
      if (shown.get(id) === on) continue;
      removers.get(id)?.();
      shown.set(id, on);
      removers.set(
        id,
        registry.register({
          id,
          label: t(on ? hide : show),
          menu: "view",
          run: () => {
            const current = preferences.getState().preferences.canvas;
            preferences.change({ canvas: { ...current, [option]: !current[option] } });
          },
        }),
      );
    }
  };
  register();
  const unsubscribe = preferences.subscribe(register);
  return () => {
    unsubscribe();
    for (const remove of removers.values()) remove();
  };
}
