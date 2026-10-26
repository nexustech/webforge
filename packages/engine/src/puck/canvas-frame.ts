import type { EditorMode, ViewOptions } from "../canvas-engine.js";
import { keepElementsGroups } from "./element-roles.js";
import { keepElementsEnabled } from "./enabled-elements.js";
import { NO_VIEW_OPTIONS } from "./engine-support.js";
import { applySiteStyles, type SiteStyles } from "./site-styles.js";
import { applyViewOptions } from "./view-options.js";

/** What the canvas's document says it is (#465): the site's name as its title, and its language. */
type CanvasDocumentInfo = { readonly title: string; readonly language?: string };

/**
 * The canvas iframe's document and what the editor shows in it: the site's CSS, the View menu's
 * options (F-ED-25), Content mode's enabled elements, its title and language, and the elements'
 * wrappers kept as groups (#465). Each is set any time, and applied to the document whenever there
 * is one.
 */
export type CanvasFrame = {
  /** The canvas iframe's document, once Puck has created it. */
  document(): Document | null;
  /** Puck created the canvas's document (or has none, without an iframe): shows the editor's state in it. */
  attach(document: Document | undefined): void;
  /** Stops what `attach` showed, as the document goes. */
  detach(): void;
  mode(): EditorMode;
  setMode(mode: EditorMode): void;
  setViewOptions(options: ViewOptions): void;
  setSiteStyles(styles: SiteStyles): void;
  setDocumentInfo(info: CanvasDocumentInfo): void;
  /** The canvas went away. */
  forget(): void;
};

/** A new {@link CanvasFrame}, in Design mode, labelling elements in the View menu with `nameOf`. */
export function createCanvasFrame(nameOf: (id: string) => string | undefined): CanvasFrame {
  let frameDocument: Document | null = null;
  let mode: EditorMode = "design";
  let viewOptions: ViewOptions = NO_VIEW_OPTIONS;
  let siteStyles: SiteStyles | null = null;
  /** Stops keeping the canvas's elements enabled; set in Content mode (see `keepElementsEnabled`). */
  let stopKeepingEnabled: (() => void) | null = null;
  let stopViewOptions: (() => void) | null = null;
  let stopGroups: (() => void) | null = null;
  let documentInfo: CanvasDocumentInfo | null = null;

  /** Gives `document` the site's name as its title, and its language (#465). */
  const applyDocumentInfo = (document: Document, info: CanvasDocumentInfo) => {
    document.title = info.title;
    if (info.language === undefined || info.language === "") {
      document.documentElement.removeAttribute("lang");
    } else {
      document.documentElement.lang = info.language;
    }
  };

  const followMode = () => {
    stopKeepingEnabled?.();
    stopKeepingEnabled =
      mode === "content" && frameDocument !== null ? keepElementsEnabled(frameDocument) : null;
  };
  const followViewOptions = () => {
    stopViewOptions?.();
    stopViewOptions =
      frameDocument === null ? null : applyViewOptions(frameDocument, viewOptions, nameOf);
  };

  return {
    document: () => frameDocument,
    attach(document) {
      frameDocument = document ?? null;
      if (document !== undefined && siteStyles !== null) applySiteStyles(document, siteStyles);
      if (document !== undefined && documentInfo !== null)
        applyDocumentInfo(document, documentInfo);
      stopGroups?.();
      stopGroups = document === undefined ? null : keepElementsGroups(document);
      followMode();
      followViewOptions();
    },
    detach() {
      stopGroups?.();
      stopGroups = null;
      stopKeepingEnabled?.();
      stopKeepingEnabled = null;
      stopViewOptions?.();
      stopViewOptions = null;
    },
    mode: () => mode,
    setMode(next) {
      mode = next;
      followMode();
    },
    setViewOptions(options) {
      viewOptions = options;
      followViewOptions();
    },
    setSiteStyles(styles) {
      siteStyles = styles;
      if (frameDocument !== null) applySiteStyles(frameDocument, styles);
    },
    setDocumentInfo(info) {
      documentInfo = info;
      if (frameDocument !== null) applyDocumentInfo(frameDocument, info);
    },
    forget() {
      frameDocument = null;
    },
  };
}
