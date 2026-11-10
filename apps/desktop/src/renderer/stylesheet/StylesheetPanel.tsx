import { Button } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { CrosshairIcon, PaintbrushIcon } from "lucide-react";
import { useEffect, useEffectEvent, useRef } from "react";
import type { CssEditor } from "./css-editor.js";
import type { CssLintData, CssSiteData } from "./css-language.js";

/** CodeMirror and the editor made with it, in a file of their own that loads with the panel. */
const loadEditor = () => import("./css-editor.js");

/** Props of {@link StylesheetPanel}. */
export type StylesheetPanelProps = {
  /** The site's `custom.css`, as the document has it when the panel opens. */
  readonly css: string;
  /**
   * Calls `show` with the stylesheet as it is now, then each time the document changes it (undo,
   * *Target this element*), at once, not on the next render: a render can come after more typing,
   * and would put older text back. Returns how to stop.
   */
  readonly followCss?: ((show: (css: string) => void) => () => void) | undefined;
  /** The person typed: the whole stylesheet as it is now. */
  readonly onChange: (css: string) => void;
  readonly siteData: () => CssSiteData;
  readonly lintData: () => CssLintData;
  /** Whether an element is selected, for the two buttons that work on it. */
  readonly hasSelection: boolean;
  readonly onTarget: () => void;
  readonly onMoveLook: () => void;
  /**
   * Where the caret should go, with the focus: set after *Target this element*, a new object each
   * time, once the stylesheet it is a position in is shown.
   */
  readonly caret?: { readonly at: number } | undefined;
};

/**
 * The Stylesheet panel (CT-8, 6.8): the site's `custom.css` in a code editor, with *Target this
 * element* and *Move this look to CSS* for the selected element above it. What's typed shows on
 * the canvas as it's typed.
 */
export function StylesheetPanel({
  css,
  followCss,
  onChange,
  siteData,
  lintData,
  hasSelection,
  onTarget,
  onMoveLook,
  caret,
}: StylesheetPanelProps) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<CssEditor | null>(null);
  // The editor is made once; what it calls are effect events, so it always has the latest.
  const changed = useEffectEvent((next: string) => onChange(next));
  const readSite = useEffectEvent(() => siteData());
  const readLint = useEffectEvent(() => lintData());
  const firstCss = useEffectEvent(() => css);
  const follow = useEffectEvent((show: (next: string) => void) => followCss?.(show));
  const pendingCaret = useEffectEvent(() => caret);

  useEffect(() => {
    const parent = host.current;
    if (parent === null) return;
    // CodeMirror loads with the panel, the first time it's shown: never when the window opens.
    let made: CssEditor | null = null;
    let stop: (() => void) | undefined;
    let gone = false;
    void loadEditor().then(({ createCssEditor }) => {
      if (gone) return;
      const shown = createCssEditor(parent, {
        css: firstCss(),
        onChange: changed,
        siteData: readSite,
        lintData: readLint,
      });
      made = shown;
      editor.current = shown;
      stop = follow((next) => shown.setCss(next));
      // A caret asked for while CodeMirror loaded (*Target this element* opening the panel).
      const pending = pendingCaret();
      if (pending !== undefined) shown.focusAt(pending.at);
    });
    return () => {
      gone = true;
      stop?.();
      made?.destroy();
      editor.current = null;
    };
  }, []);

  useEffect(() => {
    if (caret !== undefined) editor.current?.focusAt(caret.at);
  }, [caret]);

  return (
    <div className="flex h-full min-h-0 flex-col text-sm">
      <div role="toolbar" aria-label={t("stylesheet.toolbar")} className="flex gap-2 px-3 py-2">
        <Button size="sm" variant="outline" disabled={!hasSelection} onClick={onTarget}>
          <CrosshairIcon aria-hidden="true" />
          {t("stylesheet.target")}
        </Button>
        <Button size="sm" variant="outline" disabled={!hasSelection} onClick={onMoveLook}>
          <PaintbrushIcon aria-hidden="true" />
          {t("stylesheet.move")}
        </Button>
      </div>
      <div ref={host} className="min-h-0 flex-1 border-t border-border" />
    </div>
  );
}
