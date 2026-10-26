import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useEffect } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import type { EditorSession } from "../../editor/editor-session.js";
import { useDocument } from "../../editor/use-document.js";
import { addFontPreviews } from "../../fields/index.js";
import type { SiteWideConfirm } from "../../shell/confirm-site-wide.js";
import { TOKEN_CONTROLS, tokenKey } from "../theme-controls.js";
import {
  setBrandColours,
  setPaletteColor,
  setTextStep,
  setToken,
  switchPreset,
} from "../theme-edits.js";
import { StudioColours } from "./StudioColours.js";
import { StudioImagePalette } from "./StudioImagePalette.js";
import { StudioStyles } from "./StudioStyles.js";
import { StudioText } from "./StudioText.js";
import { StudioThemes } from "./StudioThemes.js";
import { STUDIO_SECTIONS, type StudioSection, type StudioState } from "./studio-state.js";

/** The links' underline token, which Theme Studio shows with the text. */
const LINKS = TOKEN_CONTROLS.find((control) => tokenKey(control) === "links.underline");

/** Props of {@link ThemeStudio}. */
export type ThemeStudioProps = {
  readonly session: EditorSession;
  readonly studio: StoreApi<StudioState>;
  /** Asks before a change to every page (D7): a preset, a colour. */
  readonly siteWide?: Pick<SiteWideConfirm, "confirmSiteWide"> | undefined;
};

/**
 * Theme Studio (F-DS-7, UI2): the site's theme in full, in a large dialog in the window (not a
 * window of its own, decided 2026-10-23). Its sections: the themes as cards, live in their own
 * colours, fonts and corners; every colour, the page's and reversed sections' side by side, with
 * shades and what their contrast lacks, and brand colours proposed from an image (PG-2); the text styles and links; and the other styles, the corner
 * and shadow scales drawn as samples. A theme or a colour is asked about first (D7); every change
 * is one labelled step in the site's history, so Ctrl/Cmd+Z undoes it here too (P5).
 */
export function ThemeStudio({ session, studio, siteWide }: ThemeStudioProps) {
  const { open, section } = useStore(studio);
  const theme = useDocument(session, (site) => site.theme);
  const media = useDocument(session, (site) => site.media);
  // The cards and text styles show each font in itself.
  useEffect(() => {
    if (open) addFontPreviews(document);
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={(next) => studio.setState({ open: next })}>
      <DialogContent className="flex h-[min(46rem,calc(100dvh-2rem))] max-w-[calc(100%-2rem)] flex-col gap-3 sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t("theme.studio.title")}</DialogTitle>
          <DialogDescription>{t("theme.studio.description")}</DialogDescription>
        </DialogHeader>
        <Tabs
          orientation="vertical"
          value={section}
          onValueChange={(next) => {
            const chosen = STUDIO_SECTIONS.find((each) => each === next);
            if (chosen !== undefined) studio.setState({ section: chosen as StudioSection });
          }}
          className="grid min-h-0 flex-1 grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-4"
        >
          <TabsList
            aria-label={t("theme.studio.sections")}
            className="flex h-auto flex-col items-stretch self-start"
          >
            {STUDIO_SECTIONS.map((each) => (
              <TabsTrigger key={each} value={each} className="justify-start">
                {t(`theme.studio.section.${each}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="themes" className="min-h-0 overflow-auto pr-1">
            <StudioThemes
              theme={theme}
              onChoose={(preset) => void switchPreset(session, siteWide, preset)}
            />
          </TabsContent>
          <TabsContent value="colors" className="min-h-0 overflow-auto pr-1">
            <StudioImagePalette
              media={media}
              theme={theme}
              onUse={(proposal, image) =>
                setBrandColours(session, siteWide, proposal, image.fileName)
              }
            />
            <StudioColours
              theme={theme}
              onChange={(palette, role, color) =>
                void setPaletteColor(session, siteWide, palette, role, color)
              }
            />
          </TabsContent>
          <TabsContent value="text" className="min-h-0 overflow-auto pr-1">
            <StudioText
              theme={theme}
              onStep={(style, change) => setTextStep(session, style, change)}
              onLinks={(underline) => {
                if (LINKS !== undefined) setToken(session, LINKS, underline);
              }}
            />
          </TabsContent>
          <TabsContent value="styles" className="min-h-0 overflow-auto pr-1">
            <StudioStyles
              theme={theme}
              onChange={(control, value) => setToken(session, control, value)}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
