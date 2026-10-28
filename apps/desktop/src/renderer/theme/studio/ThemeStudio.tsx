import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  type FieldRendererProps,
  type FieldRenderers,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { type ReactNode, useEffect, useState } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import type { EditorSession } from "../../editor/editor-session.js";
import { useDocument } from "../../editor/use-document.js";
import { addFontPreviews, ColourField } from "../../fields/index.js";
import type { SiteWideConfirm } from "../../shell/confirm-site-wide.js";
import type { OwnThemes } from "../own-themes.js";
import { useOwnThemeList } from "../own-themes-list.js";
import { TOKEN_CONTROLS, tokenKey } from "../theme-controls.js";
import {
  createOwnTheme,
  renameOwnTheme,
  setBrandColours,
  setLook,
  setPaletteColor,
  setTextStep,
  setToken,
  switchPreset,
  type ThemeAsks,
} from "../theme-edits.js";
import { StudioColours } from "./StudioColours.js";
import { StudioComponents } from "./StudioComponents.js";
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
  /**
   * My themes (2.23): listed first, with New theme, Rename and Delete, and asked for a name before
   * the first change to a built-in theme, which is read-only.
   */
  readonly ownThemes?: OwnThemes | undefined;
  /** Each kind of section and element drawn in the theme, for Components (3.12). */
  readonly kindPreviews?: ((type: string) => ReactNode) | undefined;
};

/**
 * Theme Studio (F-DS-7, UI2): the site's theme in full, in a large dialog in the window (not a
 * window of its own, decided 2026-10-23). Its sections: the themes as cards, live in their own
 * colours, fonts and corners; every colour, the page's and reversed sections' side by side, with
 * shades and what their contrast lacks, and brand colours proposed from an image (PG-2); the text styles and links; and the other styles, the corner
 * and shadow scales drawn as samples. A theme or a colour is asked about first (D7); every change
 * is one labelled step in the site's history, so Ctrl/Cmd+Z undoes it here too (P5). The person's
 * own themes come first; the first change to a built-in theme saves their own version of it, by a
 * name they choose (2.23, PH2-17). Components shows each kind's look, which every one of its kind
 * takes unless it has its own (3.12).
 */
export function ThemeStudio({
  session,
  studio,
  siteWide,
  ownThemes,
  kindPreviews,
}: ThemeStudioProps) {
  const { open, section, kind } = useStore(studio);
  // A look's colours are the theme's (ADR 0009): the colour field as Simple mode has it.
  const [renderers] = useState<FieldRenderers>(() => ({
    color: (props: FieldRendererProps<"color">) => <ColourField {...props} session={session} />,
  }));
  const theme = useDocument(session, (site) => site.theme);
  const media = useDocument(session, (site) => site.media);
  const own = useOwnThemeList(ownThemes, theme);
  const asks: ThemeAsks = { siteWide, names: ownThemes };
  // The cards and text styles show each font in itself; My themes is read again as it opens.
  useEffect(() => {
    if (!open) return;
    addFontPreviews(document);
    void ownThemes?.refresh();
  }, [open, ownThemes]);
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
              own={own}
              onChoose={(chosen) => void switchPreset(session, asks, chosen)}
              {...(ownThemes === undefined
                ? {}
                : {
                    onNew: async () => {
                      const created = await ownThemes.askNew();
                      if (created !== undefined) {
                        await createOwnTheme(session, asks, created.base, created.name);
                      }
                    },
                    onRename: async (mine) => {
                      const name = await ownThemes.askName({
                        title: t("theme.own.renameTitle"),
                        initial: mine.own.name,
                        confirm: t("theme.own.renameButton"),
                      });
                      if (name !== undefined) {
                        renameOwnTheme(session, mine, name, (kept) => ownThemes.keep(kept));
                      }
                    },
                    onDelete: async (mine) => {
                      const inUse = theme.own?.id === mine.own.id;
                      if (await ownThemes.confirmDelete(mine.own.name, inUse)) {
                        ownThemes.remove(mine.own.id);
                      }
                    },
                  })}
            />
          </TabsContent>
          <TabsContent value="colors" className="min-h-0 overflow-auto pr-1">
            <StudioImagePalette
              media={media}
              theme={theme}
              onUse={(proposal, image) => setBrandColours(session, asks, proposal, image.fileName)}
            />
            <StudioColours
              theme={theme}
              onChange={(palette, role, color) =>
                void setPaletteColor(session, asks, palette, role, color)
              }
            />
          </TabsContent>
          <TabsContent value="text" className="min-h-0 overflow-auto pr-1">
            <StudioText
              theme={theme}
              onStep={(style, change) => void setTextStep(session, asks, style, change)}
              onLinks={(underline) => {
                if (LINKS !== undefined) void setToken(session, asks, LINKS, underline);
              }}
            />
          </TabsContent>
          <TabsContent value="styles" className="min-h-0 overflow-auto pr-1">
            <StudioStyles
              theme={theme}
              onChange={(control, value) => void setToken(session, asks, control, value)}
            />
          </TabsContent>
          <TabsContent value="components" className="min-h-0 overflow-auto pr-1">
            <StudioComponents
              theme={theme}
              library={session.library}
              kind={kind}
              onKind={(next) => studio.setState({ kind: next })}
              onChange={(type, item, change) => void setLook(session, asks, type, item, change)}
              onToken={(control, value) => void setToken(session, asks, control, value)}
              preview={kindPreviews}
              renderers={renderers}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
