import type { Viewport } from "@webforge/engine";
import { t } from "@webforge/i18n";
import { type CanvasView, zoomStep } from "./canvas-view.js";
import { COMMAND_IDS } from "./command-ids.js";
import type { CommandRegistry } from "./commands.js";

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
