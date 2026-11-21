import type { CanvasEngine } from "@webforge/engine";
import { t } from "@webforge/i18n";
import type { SiteDoc } from "@webforge/model";
import { useEffect, useState } from "react";
import type { AppApi } from "../../shared/ipc/app.js";
import { canvasLayout } from "./shared-layout.js";
import { type CompileCanvasCss, classesOfHtml } from "./site-css.js";

/**
 * The home page is drawn for its picture as a desktop shows it, the top of it as tall as a
 * template's thumbnail (`pnpm template-thumbnails`): 1280 × 800.
 */
export const PICTURE = { width: 1280, height: 800 } as const;

/** How long the drawn page may take to load its fonts and first images before it's pictured. */
const SETTLE_TIMEOUT_MS = 1_500;

/** How long a drawing stays if the main process never says it's done with it. */
const STAY_MS = 5_000;

/** `value` safe in a double-quoted HTML attribute. */
const attribute = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");

/**
 * The site's home page as a document as the export draws it (#1175): the engine's static HTML of
 * it with its Header and Footer, as `pageDocument` lays them out, and the site CSS its classes
 * need. None without a home page or the engine's library, or when the CSS can't be compiled.
 */
export async function homePageDocument(
  site: SiteDoc,
  engine: Pick<CanvasEngine, "staticPage">,
  compileCss: CompileCanvasCss,
): Promise<string | undefined> {
  const home = site.pages[site.homePageId];
  if (home === undefined) return undefined;
  const drawn = engine.staticPage(
    home.doc,
    canvasLayout(site, site.homePageId),
    site.sharedSections,
  );
  if (drawn === undefined) return undefined;
  const body = [drawn.header, `<main id="main" class="flex-1">${drawn.main}</main>`, drawn.footer]
    .filter((part) => part !== "")
    .join("\n");
  const result = await compileCss({
    theme: site.theme,
    candidates: [...new Set(classesOfHtml(body))].sort(),
  });
  if (result.status === "failed") return undefined;
  return [
    "<!doctype html>",
    `<html data-theme="${attribute(site.theme.preset)}"><head><meta charset="utf-8"><style>`,
    result.css,
    "body { margin: 0; }",
    `</style></head><body class="${attribute(result.bodyClass)}">`,
    body,
    "</body></html>",
  ].join("\n");
}

/** Resolves after `ms`. */
const after = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Resolves once the browser has drawn what's on screen now. */
const painted = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

/**
 * `html` in a frame at the window's top left, 1280 × 800 scaled down to fit the window, for the
 * main process to capture (`[data-site-picture]`). `onDrawn` once its fonts and the images in view
 * have loaded, or {@link SETTLE_TIMEOUT_MS} has passed. The frame runs no scripts (an empty
 * `sandbox` but for reading what loaded); the markup is the site library's static HTML.
 */
function PictureFrame({ html, onDrawn }: { readonly html: string; readonly onDrawn: () => void }) {
  const scale = Math.min(1, window.innerWidth / PICTURE.width, window.innerHeight / PICTURE.height);
  const settle = (frame: HTMLIFrameElement) => {
    // Its fonts and the images in view, waited for as they load; pictured as it is after that.
    const loaded = async () => {
      const page = frame.contentDocument;
      const images = [...(page?.querySelectorAll("img") ?? [])]
        .filter((image) => image.getBoundingClientRect().top < PICTURE.height)
        .map((image) => image.decode().catch(() => undefined));
      await Promise.all([page?.fonts?.ready, ...images]);
    };
    void Promise.race([loaded().catch(() => undefined), after(SETTLE_TIMEOUT_MS)])
      .then(painted)
      .then(onDrawn);
  };
  return (
    <div
      data-site-picture=""
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: PICTURE.width * scale,
        height: PICTURE.height * scale,
        overflow: "hidden",
        pointerEvents: "none",
        background: "#fff",
        zIndex: 2147483647,
      }}
    >
      <iframe
        title={t("canvas.sitePicture")}
        tabIndex={-1}
        sandbox="allow-same-origin"
        srcDoc={html}
        onLoad={(event) => settle(event.currentTarget)}
        style={{
          width: PICTURE.width,
          height: PICTURE.height,
          border: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      />
    </div>
  );
}

/**
 * Draws the site's home page when the site is being left, for the main process to take its picture
 * for the Recent list (#1175, `app:site-picture`): never the editor's canvas, with its selection,
 * outlines and grips, or whichever page it shows. `draw` gives the page's document, none when it
 * can't be drawn; the drawing goes once the picture is taken, or after 5 s if that's never said.
 */
export function SitePictureStage({
  app,
  draw,
}: {
  readonly app: Pick<AppApi, "onSitePicture">;
  readonly draw: () => Promise<string | undefined>;
}) {
  const [shown, setShown] = useState<
    { readonly html: string; readonly onDrawn: () => void } | undefined
  >(undefined);
  useEffect(() => {
    let stay: ReturnType<typeof setTimeout> | undefined;
    // The answer still to give for the drawing shown: not drawn, if it goes first.
    let answer: ((drawn: boolean) => void) | undefined;
    const done = () => {
      clearTimeout(stay);
      answer?.(false);
      answer = undefined;
      setShown(undefined);
    };
    const stop = app.onSitePicture(async () => {
      const html = await draw();
      if (html === undefined) return false;
      return new Promise<boolean>((resolve) => {
        answer?.(false);
        answer = resolve;
        clearTimeout(stay);
        stay = setTimeout(done, STAY_MS);
        setShown({
          html,
          onDrawn: () => {
            if (answer === resolve) answer = undefined;
            resolve(true);
          },
        });
      });
    }, done);
    return () => {
      stop();
      done();
    };
  }, [app, draw]);
  return shown === undefined ? null : <PictureFrame html={shown.html} onDrawn={shown.onDrawn} />;
}
