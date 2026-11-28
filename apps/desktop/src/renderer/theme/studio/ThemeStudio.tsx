import {
  Dialog,
  type FieldRendererProps,
  type FieldRenderers,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { type Oklch, type OneOffUse, oneOffUsesIn, type ThemeTokens } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import { hexToOklch, nearestColour, ownColorIssues } from "@webforge/themes";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import type { ItemPreviews } from "../../editor/areas.js";
import type { EditorSession } from "../../editor/editor-session.js";
import { elementPlaceName } from "../../editor/element-place.js";
import type { OwnThemes } from "../../editor/own-themes.js";
import { canShowElement, showElement } from "../../editor/show-element.js";
import { endThemePreview, followThemeChange, previewTheme } from "../../editor/theme-preview.js";
import { useDocument } from "../../editor/use-document.js";
import { addFontPreviews, ColourField, type ThemeColorPreview } from "../../fields/index.js";
import { useOwnThemeList } from "../own-themes-list.js";
import { PreviewStrip, StylingFrame } from "../StylingFrame.js";
import { TOKEN_CONTROLS, tokenKey } from "../theme-controls.js";
import {
  addOneOffToOwnColors,
  addOwnColor,
  applyNearestOwnColor,
  colorFieldsOf,
  createOwnTheme,
  deleteOwnColor,
  ownColorUseCount,
  renameOwnColor,
  renameOwnTheme,
  setBrandColours,
  setLook,
  setOwnColor,
  setPaletteColor,
  setTextStep,
  setToken,
  switchPreset,
  type ThemeAsks,
  type ThemeSiteWide,
  withOwnColor,
  withPaletteColor,
} from "../theme-edits.js";
import { changeDraft, draftChange, draftChanges, themeWithDraft } from "./look-draft.js";
import { StudioColours } from "./StudioColours.js";
import {
  changedKinds,
  KindChoice,
  lookIn,
  lookKinds,
  previewNode,
  previewTypeOf,
  ResetLook,
  StudioComponents,
  shownKind,
} from "./StudioComponents.js";
import { StudioImagePalette } from "./StudioImagePalette.js";
import { StudioOneOffColours } from "./StudioOneOffColours.js";
import { StudioOwnColours } from "./StudioOwnColours.js";
import { StudioStyles } from "./StudioStyles.js";
import { StudioText } from "./StudioText.js";
import { StudioThemes } from "./StudioThemes.js";
import { STUDIO_SECTIONS, type StudioSection, type StudioState } from "./studio-state.js";

/** The links' underline token, which Theme Studio shows with the text. */
const LINKS = TOKEN_CONTROLS.find((control) => tokenKey(control) === "links.underline");

/**
 * The sample page Colours, Text and Styles draw their changes on (CT-11): the sections whose
 * definitions place them on it (`studioSample`, #982), in that order, with their defaults. Between
 * them, every colour role, text style, button and card.
 */
const samplePageOf = (library: ComponentLibrary): readonly string[] =>
  Object.entries(library.components)
    .flatMap(([type, def]) =>
      def.studioSample === undefined ? [] : [[type, def.studioSample] as const],
    )
    .sort(([, a], [, b]) => a - b)
    .map(([type]) => type);

/** Props of {@link ThemeStudio}. */
export type ThemeStudioProps = {
  readonly session: EditorSession;
  readonly studio: StoreApi<StudioState>;
  /** Asks before another theme changes every page (D7); a kind's look says so after (M1). */
  readonly siteWide?: ThemeSiteWide | undefined;
  /**
   * My themes (2.23): listed first, with New theme, Rename and Delete, and asked for a name before
   * the first change to a built-in theme, which is read-only.
   */
  readonly ownThemes?: OwnThemes | undefined;
  /**
   * Draws a section or element on Desktop or Mobile, in the site's theme or another (3.13a, 4.10):
   * the preview strip's. No strip without it (no CSS compiler).
   */
  readonly itemPreviews?: ItemPreviews | undefined;
};

/**
 * What shows a colour while it's dragged in Theme Studio (5.30, OL-18): the theme as `change` makes
 * it with that colour, on the canvas and the sample page, until the picker closes.
 */
const previewOf = (
  change: (tokens: ThemeTokens, color: Oklch) => ThemeTokens,
  session: EditorSession,
): ThemeColorPreview => ({
  show: (color) => previewTheme(session, change(session.history.document.getState().theme, color)),
  end: (chosen) => endThemePreview(session, chosen),
});

/**
 * Theme Studio (F-DS-7, UI2): the site's theme in full, in a dialog that fills the window (not a
 * window of its own, decided 2026-10-23), in *Style this ‹kind›…*'s frame (CT-11). Its sections are
 * tabs in the bar at the top: the themes as cards, live in their own colours, fonts and corners;
 * every colour, the page's and reversed sections' side by side, with shades and what their contrast
 * lacks, and brand colours proposed from an image (PG-2); the text styles and links; and the other
 * styles, the corner and shadow scales drawn as samples. Under the bar, all but Themes keep a preview
 * in view while their controls scroll: Colours, Text and Styles a sample page in the theme, and
 * Components the kind chosen beside the tabs. A theme is asked about first (D7), a colour applies
 * at once with a toast that offers Undo (LF-15); every
 * change is one labelled step in the site's history, so Ctrl/Cmd+Z undoes it here too (P5). The
 * person's own themes come first; the first change to a built-in theme saves their own version of
 * it, by a name they choose (2.23, PH2-17). Components shows each kind's look, which every one of
 * its kind takes unless it has its own (3.12). As on every tab, a change there applies at once, with
 * no question, and a notice says how far it reached, with Undo (M1, in place of 4.10's draft): the
 * field in use holds its run of changes, which the preview draws, and leaving the field writes it
 * as one step. Choosing another kind or tab, closing, or Ctrl/Cmd+Z writes a run still open first.
 */
export function ThemeStudio({
  session,
  studio,
  siteWide,
  ownThemes,
  itemPreviews,
}: ThemeStudioProps) {
  const { open, section, kind, draft: kept } = useStore(studio);
  // A look's colours are the theme's (ADR 0009): the colour field without another colour.
  const [renderers] = useState<FieldRenderers>(() => ({
    color: (props: FieldRendererProps<"color">) => (
      <ColourField {...props} session={session} themeOnly />
    ),
  }));
  const theme = useDocument(session, (site) => site.theme);
  const media = useDocument(session, (site) => site.media);
  const own = useOwnThemeList(ownThemes, theme);
  const { library } = session;
  const groups = useMemo(() => lookKinds(library), [library]);
  const shown = shownKind(groups, kind);
  // A change cancelled at a question says so (#614).
  const asks: ThemeAsks = { siteWide, names: ownThemes, notify: (message) => toast(message) };
  // Components' run of changes in the field in use, while it would still change the theme.
  const draft = draftChanges(theme, kept) ? kept : undefined;
  // The theme with it, the same object while neither changes, so its previews draw it once.
  const drafted = useMemo(
    () => (draft === undefined ? undefined : { look: draft, theme: themeWithDraft(theme, draft) }),
    [theme, draft],
  );
  /**
   * Writes the run of changes in the field in use as one step, at once, saying so after with Undo
   * (M1); whether it's in the theme now. Nothing to write is done.
   */
  const apply = async (): Promise<boolean> => {
    // Read now, not as drawn: a choice changes the run and leaves its field in the same moment.
    const run = studio.getState().draft;
    const now = session.history.document.getState().theme;
    if (!draftChanges(now, run)) {
      studio.setState({ draft: undefined });
      return true;
    }
    // Kept until written, so the preview never flicks back to the look before it; a change made
    // meanwhile makes another run, which stays.
    const applied = await setLook(session, asks, run.type, run.item, draftChange(now, run), {
      notice: true,
    });
    if (studio.getState().draft === run) studio.setState({ draft: undefined });
    return applied;
  };
  /** Closes, writing a run still open first, then does `then`: goes to a colour's use (TC-4). */
  const closeThen = (then?: () => void) => {
    void apply().then(() => {
      studio.setState({ open: false });
      then?.();
    });
  };
  // Colours outside the theme (TC-4): every one-off on the site, with where it's used.
  const isColorField = useMemo(() => colorFieldsOf(library), [library]);
  // Read only while the Colours tab shows: Studio is drawn, closed, under every edit.
  const listing = open && section === "colors";
  const doc = useDocument(session, (site) => (listing ? site : undefined));
  const oneOffs = useMemo(
    () => (doc === undefined ? [] : oneOffUsesIn(doc, isColorField)),
    [doc, isColorField],
  );
  const keyOfUse = (use: OneOffUse) => `${use.on} ${use.nodeId} ${use.field}`;
  /** Sets fields of `type`'s look in the run, by name; `undefined` takes one off. */
  const changeLook = (type: string, item: string, change: Readonly<Record<string, unknown>>) =>
    studio.setState((state) => ({
      draft: changeDraft(
        session.history.document.getState().theme,
        state.draft,
        type,
        item,
        change,
      ),
    }));
  // The look shown, as its controls show it, and the kinds whose look is changed (#1517).
  const shownTheme = drafted?.theme ?? theme;
  const shownLook = shown === undefined ? {} : lookIn(shownTheme, shown.type);
  const changed = useMemo(() => changedKinds(shownTheme), [shownTheme]);
  /** Shows another kind, writing a run still open in this one first. */
  const chooseKind = (next: string) => {
    void apply().then(() => studio.setState({ kind: next }));
  };
  // The cards and text styles show each font in itself; My themes is read again as it opens.
  useEffect(() => {
    if (!open) return;
    addFontPreviews(document);
    void ownThemes?.refresh();
  }, [open, ownThemes]);

  /** The strip at the top: none for Themes, whose cards show each theme in full. */
  const preview = (() => {
    if (itemPreviews === undefined || section === "themes") return undefined;
    if (section === "components") {
      if (shown === undefined) return undefined;
      const node = previewNode(library, previewTypeOf(library, shown));
      // Always a theme of its own: one given anew draws the preview again (#613). The run in the
      // field in use shows as it goes.
      const drawnIn = drafted?.theme ?? theme;
      return (
        <PreviewStrip
          label={t("theme.components.preview", { item: shown.label })}
          draw={(device) => itemPreviews(node, device, drawnIn)}
        />
      );
    }
    return (
      <PreviewStrip
        label={t("theme.studio.samplePage")}
        draw={(device) => (
          <div className="flex flex-col">
            {samplePageOf(library).map((type) => (
              <Fragment key={type}>
                {itemPreviews(previewNode(library, type), device, theme)}
              </Fragment>
            ))}
          </div>
        )}
      />
    );
  })();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Closing writes a run of changes still open first (M1).
        if (next) studio.setState({ open: true });
        else closeThen();
      }}
    >
      {/* The sections' tabs are in the bar at the top, their content under the preview: the
            tabs' root holds the whole frame. */}
      <Tabs
        asChild
        value={section}
        onValueChange={(next) => {
          const chosen = STUDIO_SECTIONS.find((each) => each === next);
          if (chosen === undefined) return;
          void apply().then(() => studio.setState({ section: chosen as StudioSection }));
        }}
      >
        <StylingFrame
          // Ctrl/Cmd+Z with a run of changes still open writes it, then undoes it, so the person
          // sees their own change reversed, as in the Edit panel (M1).
          onKeyDownCapture={(event) => {
            if (studio.getState().draft === undefined) return;
            if (!(event.ctrlKey || event.metaKey) || event.shiftKey) return;
            if (event.key.toLowerCase() !== "z") return;
            event.preventDefault();
            event.stopPropagation();
            void apply().then((applied) => {
              if (applied) session.history.undo();
            });
          }}
          title={t("theme.studio.title")}
          description={t("theme.studio.description")}
          bar={
            <>
              <TabsList aria-label={t("theme.studio.sections")} className="rounded-sm">
                {STUDIO_SECTIONS.map((each) => (
                  <TabsTrigger key={each} value={each}>
                    {t(`theme.studio.section.${each}`)}
                  </TabsTrigger>
                ))}
              </TabsList>
              {section === "components" && shown !== undefined ? (
                <>
                  <KindChoice groups={groups} shown={shown} changed={changed} onKind={chooseKind} />
                  {/* Takes the whole look off, as one step at once (M1). */}
                  <ResetLook
                    shown={shown}
                    look={shownLook}
                    onReset={() => {
                      changeLook(
                        shown.type,
                        shown.label,
                        Object.fromEntries(Object.keys(shownLook).map((name) => [name, undefined])),
                      );
                      void apply();
                    }}
                  />
                </>
              ) : null}
            </>
          }
          preview={preview}
        >
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
            <StudioOwnColours
              colors={theme.ownColors ?? []}
              startColor={theme.colors.primary}
              issues={ownColorIssues(theme)}
              onAdd={(name, color) => void addOwnColor(session, asks, name, color)}
              onRename={(id, name) => void renameOwnColor(session, asks, id, name)}
              onSetColor={(id, color) =>
                void followThemeChange(session, setOwnColor(session, asks, id, color))
              }
              usesOf={(id) => ownColorUseCount(session, id, colorFieldsOf(session.library))}
              onDelete={(id, uses) =>
                void deleteOwnColor(session, asks, id, uses, colorFieldsOf(session.library))
              }
              preview={(id) =>
                previewOf((tokens, color) => withOwnColor(tokens, id, color), session)
              }
            />
            <StudioOneOffColours
              colours={oneOffs.map(({ hex, uses }) => ({
                hex,
                uses: uses.map((use) => ({
                  key: keyOfUse(use),
                  where:
                    doc === undefined ? "" : elementPlaceName(doc, library, use.on, use.nodeId),
                  canShow: canShowElement(session, use.on, use.nodeId),
                })),
              }))}
              own={theme.ownColors ?? []}
              nearest={(hex) => nearestColour(hexToOklch(hex), theme.ownColors ?? [])}
              onAdd={async (hex, name) =>
                (await addOneOffToOwnColors(session, asks, hex, name, isColorField)) !== undefined
              }
              onUseNearest={(hex) => void applyNearestOwnColor(session, asks, hex, isColorField)}
              onShow={(hex, key) => {
                const use = oneOffs
                  .find((each) => each.hex === hex)
                  ?.uses.find((each) => keyOfUse(each) === key);
                if (use !== undefined && canShowElement(session, use.on, use.nodeId)) {
                  closeThen(() => showElement(session, use.on, use.nodeId));
                }
              }}
            />
            <StudioColours
              theme={theme}
              onChange={(palette, role, color) =>
                void followThemeChange(
                  session,
                  setPaletteColor(session, asks, palette, role, color),
                )
              }
              preview={(palette, role) =>
                previewOf(
                  (tokens, color) => withPaletteColor(tokens, palette, role, color),
                  session,
                )
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
          {/* The kind's look, its tokens and its fields scroll here, as one (H3): a field the focus
                moves to scrolls clear of its group's heading, which stays in view. */}
          <TabsContent value="components" className="min-h-0 scroll-pt-8 overflow-auto pr-1">
            {shown === undefined ? null : (
              <StudioComponents
                theme={theme}
                library={library}
                shown={shown}
                draft={drafted}
                onChange={changeLook}
                onCommit={() => void apply()}
                onToken={(control, value) => void setToken(session, asks, control, value)}
                renderers={renderers}
              />
            )}
          </TabsContent>
        </StylingFrame>
      </Tabs>
    </Dialog>
  );
}
