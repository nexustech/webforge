import type { NodeDoc, Theme } from "@webforge/model";
import type { ReactNode } from "react";
import type { StoreApi } from "zustand/vanilla";
import type { WebforgeApi } from "../../shared/webforge-api.js";
import type { CanvasView } from "../shell/canvas-view.js";
import type { CommandRegistry } from "../shell/commands.js";
import type { SiteWideConfirm } from "../shell/confirm-site-wide.js";
import type { ContextualToolbarRegistry } from "../shell/contextual-toolbars.js";
import type { PanelRegistry } from "../shell/panels.js";
import type { PreferencesStore } from "../shell/preferences-store.js";
import type { WindowDialogRegistry } from "../shell/window-dialogs.js";
import type { AddItem } from "./add-item.js";
import type { CanvasPointer } from "./canvas-pointer.js";
import type { CodeTrust } from "./code-trust.js";
import type { PreviewChoices } from "./edit-previews.js";
import type { EditorSession } from "./editor-session.js";
import type { EngineHandle } from "./engine-host.js";
import type { ImagePickRequests } from "./image-picks.js";
import type { Layer } from "./layers.js";

/**
 * Theme Studio's previews of each kind (3.12): `type` with its defaults, in the site's theme or in
 * `theme`, with a look not applied yet (4.10).
 */
export type KindPreviews = (type: string, theme?: Theme) => ReactNode;

/** An item drawn on Desktop or Mobile (3.13a), in the site's theme or in `theme` (4.10). */
export type ItemPreviews = (
  node: NodeDoc,
  device: "desktop" | "mobile",
  theme?: Theme,
) => ReactNode;

import type { SettingsRegistry } from "./settings-registry.js";
import type { SharedSectionNaming } from "./shared-sections.js";
import type { CompileCanvasCss } from "./site-css.js";

/**
 * A renderer area as the editor puts it together (2.20, B1): what it registers (panels, commands,
 * toolbars, connections to the canvas) and how to remove it all again. The composition root,
 * `renderer/areas.ts`, lists the areas in the order they register.
 */
export type Area<Context> = {
  /** A name for the area, unique in its list. */
  readonly id: string;
  /** Registers the area on `ctx`; returns how to remove what it registered. */
  readonly register: (ctx: Context) => () => void;
};

/** What every area registers into, and the session and preferences it works on. */
type AreaContext = {
  /**
   * The main process, through the preload API: `window.webforge` in the app, `fakePreloadApi()` in
   * tests and `storyPreloadApi()` in stories (#668). An area reaches main only through this, never
   * through `window.webforge`.
   */
  readonly api: WebforgeApi;
  readonly session: EditorSession;
  readonly commands: CommandRegistry;
  readonly panels: PanelRegistry;
  /** The person's preferences and the editor mode, which an area follows itself. */
  readonly preferences: PreferencesStore;
};

/**
 * What the window gives the areas it registers (App): its own registries and stores, made once,
 * so its areas register once and a panel keeps what it shows (Layers' collapsed layers and filter).
 */
export type WindowContext = AreaContext & {
  /** Asks before what changes more than the page shown (D7); AI apps' changes too, and close it. */
  readonly siteWide: Pick<
    SiteWideConfirm,
    "confirmSiteWide" | "current" | "answer" | "setBeforeSiteWideAction"
  >;
  /** The canvas toolbar's zoom and size readout (1.15). */
  readonly canvasView: CanvasView;
  /** What a panel points at on the canvas: an element to outline, a drop point (SP-8, SP-10). */
  readonly canvasPointer: CanvasPointer;
  /** The parts of the window's Settings dialog (LF-12). */
  readonly settings: SettingsRegistry;
  /** Dialogs the window draws once, whatever the panels show (Theme Studio, 2.3b). */
  readonly windowDialogs: WindowDialogRegistry;
  /** The code trust step (#649): asks before the site's code runs, and keeps what's trusted. */
  readonly codeTrust: CodeTrust;
  /** What the person ignored in Site Check for the open site (3.6), and how to remember a change. */
  readonly siteCheckIgnored: {
    readonly initial: readonly string[];
    readonly save: (ignored: readonly string[]) => void;
  };
  /**
   * Theme Studio's previews of each kind of section and element (3.12), drawn in the site's theme
   * with its look; none without a CSS compiler.
   */
  readonly kindPreviews?: KindPreviews | undefined;
  /**
   * *Style this ‹kind›…*'s previews of the item being styled (3.13a), on Desktop or Mobile, drawn
   * as the kind previews are, and Theme Studio's before and after (4.10); none without a CSS
   * compiler.
   */
  readonly itemPreviews?: ItemPreviews | undefined;
};

/** What the editor gives the areas it registers, around its canvas (Editor). */
export type EditorContext = AreaContext & {
  /** The selected element's own toolbars, in the row under the canvas toolbar (SP-4). */
  readonly toolbars: ContextualToolbarRegistry;
  /** The canvas engine, while the editor has one mounted. */
  readonly engine: EngineHandle;
  /** Asks before what changes more than the page shown (D7); without it, changes happen at once. */
  readonly siteWide?: Pick<
    SiteWideConfirm,
    "confirmSiteWide" | "current" | "setBeforeSiteWideAction"
  >;
  /** Compiles the site CSS for the canvas. */
  readonly compileCss: CompileCanvasCss;
  /**
   * The sections' larger previews in the Add panel (UX-10), drawn with the site's theme: made once
   * for the editor's session, so the drawings they keep outlive the areas registering again.
   */
  readonly sectionPreviews: (item: AddItem) => ReactNode;
  /** The edit-only previews the person turned on (UX-26), for this window. */
  readonly editPreviews: StoreApi<PreviewChoices>;
  /** The editor's own dialogs and panels, which an area's commands open. */
  readonly dialogs: EditorDialogs;
  /** Requests to open the Edit panel's image picker, from *Edit* on an image (F-ED-25). */
  readonly imagePicks: ImagePickRequests;
};

/** The dialogs and panels the editor shows when an area asks. */
export type EditorDialogs = {
  /** Asks for a shared section's name, to save one or rename one (1.29). */
  readonly nameSharedSection: (naming: SharedSectionNaming) => void;
  /** Asks for a layer's new name (F2, or the element menu's Rename). */
  readonly rename: (layer: Layer) => void;
  /** Opens the Edit panel's image picker for an image element (F-ED-25). */
  readonly pickImage: (nodeId: string) => void;
};

/**
 * Registers `areas` on `ctx` in their order (2.20, B1); returns how to remove them all, in the
 * opposite order.
 */
export function connectAreas<Context>(areas: readonly Area<Context>[], ctx: Context): () => void {
  const removers = areas.map((area) => area.register(ctx));
  return () => {
    for (const remove of removers.toReversed()) remove();
  };
}
