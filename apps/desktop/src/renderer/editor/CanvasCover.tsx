import type { CanvasEngine } from "@webforge/engine";
import { t } from "@webforge/i18n";
import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { reportFailure } from "../log.js";

/**
 * The longest the canvas stays covered (#1013): a compile that fails, or never answers, still
 * shows the page, unstyled, rather than a cover that never goes. Opening a site takes 3 s at most on
 * a usual machine (architecture §10); this allows a busy one.
 */
export const CANVAS_COVER_TIMEOUT_MS = 15_000;

/**
 * How long the cover is plain before it says the site is opening (#1167): a site that draws sooner
 * shows no message flashing past, and one slower says so, rather than an empty area.
 */
export const CANVAS_COVER_MESSAGE_MS = 500;

/**
 * Covers the canvas until it shows the site with its CSS and fonts (#1013): the page's markup is
 * drawn before its compiled styles arrive, and unstyled it looks broken. After
 * {@link CANVAS_COVER_MESSAGE_MS} it says the site is opening, with a spinner, as a status, so a
 * screen reader hears it too. A canvas started again is covered again.
 */
export function CanvasCover({ engine }: { readonly engine: CanvasEngine | null }) {
  // The engine whose canvas has shown the site styled, or given up waiting for it.
  const [shown, setShown] = useState<CanvasEngine | null>(null);
  // Whether the cover has been up long enough to say why (#1167).
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), CANVAS_COVER_MESSAGE_MS);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (engine === null) return;
    const timer = setTimeout(() => {
      reportFailure("canvas styles", new Error("The site's styles didn't arrive in time"));
      setShown(engine);
    }, CANVAS_COVER_TIMEOUT_MS);
    const stop = engine.onStyled(() => {
      clearTimeout(timer);
      setShown(engine);
    });
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, [engine]);

  if (engine !== null && shown === engine) return null;
  return (
    <div className="editor__canvas-cover" role="status">
      {slow ? (
        <>
          <LoaderCircle aria-hidden="true" className="size-5 motion-safe:animate-spin" />
          {t("canvas.opening")}
        </>
      ) : null}
    </div>
  );
}
