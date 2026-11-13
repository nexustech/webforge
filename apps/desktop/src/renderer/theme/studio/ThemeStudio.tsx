import {
  Button,
  Dialog,
  type FieldRendererProps,
  type FieldRenderers,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ToggleGroup,
  ToggleGroupItem,
  toast,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import type { ItemPreviews } from "../../editor/areas.js";
import type { EditorSession } from "../../editor/editor-session.js";
import { useDocument } from "../../editor/use-document.js";
import { addFontPreviews, ColourField } from "../../fields/index.js";

import type { OwnThemes } from "../own-themes.js";
import { useOwnThemeList } from "../own-themes-list.js";
import { PreviewStrip, StylingFrame } from "../StylingFrame.js";
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
  type ThemeSiteWide,
} from "../theme-edits.js";
import { changeDraft, draftChange, draftChanges, themeWithDraft } from "./look-draft.js";
import { StudioColours } from "./StudioColours.js";
import {
  KindChoice,
  lookKinds,
  previewNode,
  previewTypeOf,
  StudioComponents,
  shownKind,
} from "./StudioComponents.js";
import { StudioDraftQuestion } from "./StudioDraftQuestion.js";
import { StudioImagePalette } from "./StudioImagePalette.js";
import { StudioStyles } from "./StudioStyles.js";
import { StudioText } from "./StudioText.js";
import { StudioThemes } from "./StudioThemes.js";
import {
  type DraftPending,
  STUDIO_SECTIONS,
  type StudioSection,
  type StudioState,
} from "./studio-state.js";

/** The links' underline token, which Theme Studio shows with the text. */
const LINKS = TOKEN_CONTROLS.find((control) => tokenKey(control) === "links.underline");

/**
 * The sample page Colours, Text and Styles draw their changes on (CT-11): a Hero, Features and a
 * Call to action with their defaults, between them every colour role, text style, button and card.
 */
const SAMPLE_PAGE = ["Hero", "Features", "CallToAction"] as const;

/** Which look Components' preview shows: the theme's now, or with the changes not applied yet. */
type Compared = "now" | "draft";

/** Props of {@link ThemeStudio}. */
export type ThemeStudioProps = {
  readonly session: EditorSession;
  readonly studio: StoreApi<StudioState>;
  /** Asks before a change to every page (D7): a preset, a colour. */
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
 * Theme Studio (F-DS-7, UI2): the site's theme in full, in a dialog that fills the window (not a
 * window of its own, decided 2026-10-23), in *Style this ‹kind›…*'s frame (CT-11). Its sections are
 * tabs in the bar at the top: the themes as cards, live in their own colours, fonts and corners;
 * every colour, the page's and reversed sections' side by side, with shades and what their contrast
 * lacks, and brand colours proposed from an image (PG-2); the text styles and links; and the other
 * styles, the corner and shadow scales drawn as samples. Under the bar, all but Themes keep a preview
 * in view while their controls scroll: Colours, Text and Styles a sample page in the theme, and
 * Components the kind chosen beside the tabs. A theme or a colour is asked about first (D7); every
 * change is one labelled step in the site's history, so Ctrl/Cmd+Z undoes it here too (P5). The
 * person's own themes come first; the first change to a built-in theme saves their own version of
 * it, by a name they choose (2.23, PH2-17). Components shows each kind's look, which every one of
 * its kind takes unless it has its own (3.12); its changes are a draft until applied together from
 * the bar at the bottom (4.10), the preview showing the theme now or with them, and leaving the kind
 * or closing with one asks to apply or discard it.
 */
export function ThemeStudio({
  session,
  studio,
  siteWide,
  ownThemes,
  itemPreviews,
}: ThemeStudioProps) {
  const { open, section, kind, draft: kept, pending: asked } = useStore(studio);
  // A look's colours are the theme's (ADR 0009): the colour field as Simple mode has it.
  const [renderers] = useState<FieldRenderers>(() => ({
    color: (props: FieldRendererProps<"color">) => <ColourField {...props} session={session} />,
  }));
  const theme = useDocument(session, (site) => site.theme);
  const media = useDocument(session, (site) => site.media);
  const own = useOwnThemeList(ownThemes, theme);
  const { library } = session;
  const groups = useMemo(() => lookKinds(library), [library]);
  const shown = shownKind(groups, kind);
  // A change cancelled at a question says so (#614).
  const asks: ThemeAsks = { siteWide, names: ownThemes, notify: (message) => toast(message) };
  // Components' draft, while it would still change the theme (an undo can make it the look again).
  const draft = draftChanges(theme, kept) ? kept : undefined;
  // The theme with it, the same object while neither changes, so its previews draw it once.
  const drafted = useMemo(
    () => (draft === undefined ? undefined : { look: draft, theme: themeWithDraft(theme, draft) }),
    [theme, draft],
  );
  // The preview shows the changes while there are some: they are what the person is looking at.
  // Each new draft starts on them again, whatever was shown last time (4.10).
  const [compared, setCompared] = useState<Compared>("draft");
  const [hadDraft, setHadDraft] = useState(draft !== undefined);
  if ((draft !== undefined) !== hadDraft) {
    setHadDraft(draft !== undefined);
    if (draft !== undefined) setCompared("draft");
  }
  const showing: Compared = drafted === undefined ? "now" : compared;
  // The question about the draft, while there is one to ask about: an undo can end it meanwhile.
  const pending = draft === undefined ? undefined : asked;
  useEffect(() => {
    if (asked !== undefined && draft === undefined) studio.setState({ pending: undefined });
  }, [asked, draft, studio]);
  const setPending = (next: DraftPending | undefined) => studio.setState({ pending: next });
  /** Writes the draft as one step, once asked (D7); whether it is in the theme now. */
  const apply = async (): Promise<boolean> => {
    if (draft === undefined) return true;
    const applied = await setLook(session, asks, draft.type, draft.item, draftChange(theme, draft));
    if (applied) studio.setState({ draft: undefined });
    return applied;
  };
  const discard = () => studio.setState({ draft: undefined });
  /** Does what waited on the question: closes, or shows the other kind. */
  const go = (after: DraftPending) =>
    studio.setState("close" in after ? { open: false } : { kind: after.kind });
  /** Shows another kind; with a draft for this one, asks to apply or discard it first (4.10). */
  const chooseKind = (next: string) => {
    if (draft !== undefined && draft.type !== next) setPending({ kind: next });
    else studio.setState({ kind: next });
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
      const node = previewNode(library, previewTypeOf(shown));
      // Always a theme of its own: one given anew draws the preview again (#613).
      const drawnIn = showing === "draft" && drafted !== undefined ? drafted.theme : theme;
      return (
        <PreviewStrip
          label={t("theme.components.preview", { item: shown.label })}
          toolbar={
            <ToggleGroup
              type="single"
              aria-label={t("theme.components.previewShow")}
              className="self-start"
              value={showing}
              onValueChange={(next) => {
                if (next === "now" || next === "draft") setCompared(next);
              }}
            >
              <ToggleGroupItem value="now" className="px-3">
                {t("theme.components.previewNow")}
              </ToggleGroupItem>
              <ToggleGroupItem value="draft" className="px-3" disabled={drafted === undefined}>
                {t("theme.components.previewDraft")}
              </ToggleGroupItem>
            </ToggleGroup>
          }
          draw={(device) => itemPreviews(node, device, drawnIn)}
        />
      );
    }
    return (
      <PreviewStrip
        label={t("theme.studio.samplePage")}
        draw={(device) => (
          <div className="flex flex-col">
            {SAMPLE_PAGE.map((type) => (
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
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          // Closing with a draft asks to apply or discard it first (4.10).
          if (!next && draft !== undefined) setPending({ close: true });
          else studio.setState({ open: next });
        }}
      >
        {/* The sections' tabs are in the bar at the top, their content under the preview: the
            tabs' root holds the whole frame. */}
        <Tabs
          asChild
          value={section}
          onValueChange={(next) => {
            const chosen = STUDIO_SECTIONS.find((each) => each === next);
            if (chosen !== undefined) studio.setState({ section: chosen as StudioSection });
          }}
        >
          <StylingFrame
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
                  <KindChoice groups={groups} shown={shown} onKind={chooseKind} />
                ) : null}
              </>
            }
            preview={preview}
            actions={
              section === "components" && shown !== undefined ? (
                <>
                  {/* The changes aren't in the theme until they are applied (4.10). */}
                  <p role="status" className="m-0 min-w-0 flex-1 self-center text-xs">
                    {drafted === undefined
                      ? null
                      : t("theme.components.draft", { item: drafted.look.item })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={drafted === undefined}
                      onClick={discard}
                    >
                      {t("theme.components.discard")}
                    </Button>
                    <Button
                      type="button"
                      disabled={drafted === undefined}
                      onClick={() => void apply()}
                    >
                      {t("theme.components.apply")}
                    </Button>
                  </div>
                </>
              ) : undefined
            }
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
                onUse={(proposal, image) =>
                  setBrandColours(session, asks, proposal, image.fileName)
                }
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
              {shown === undefined ? null : (
                <StudioComponents
                  theme={theme}
                  library={library}
                  shown={shown}
                  draft={drafted}
                  onChange={(type, item, change) =>
                    studio.setState({ draft: changeDraft(theme, draft, type, item, change) })
                  }
                  onToken={(control, value) => void setToken(session, asks, control, value)}
                  renderers={renderers}
                />
              )}
            </TabsContent>
          </StylingFrame>
        </Tabs>
      </Dialog>
      <StudioDraftQuestion
        item={pending === undefined ? undefined : draft?.item}
        onApply={async () => {
          const after = pending;
          setPending(undefined);
          if (after !== undefined && (await apply())) go(after);
        }}
        onDiscard={() => {
          const after = pending;
          setPending(undefined);
          discard();
          if (after !== undefined) go(after);
        }}
        onCancel={() => setPending(undefined)}
      />
    </>
  );
}
