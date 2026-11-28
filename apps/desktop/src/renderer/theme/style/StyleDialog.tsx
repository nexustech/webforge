import {
  Button,
  Dialog,
  DialogCancel,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  UnsavedChanges,
} from "@webforge/editor-ui";
import { plural, t } from "@webforge/i18n";
import type { NodeDoc } from "@webforge/model";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import { lookChangeIn } from "../../clipboard/index.js";
import type { EditorSession } from "../../editor/editor-session.js";
import { ItemCss } from "../../editor/ItemCss.js";
import type { ItemCssServices } from "../../editor/ItemCssView.js";
import { useDocument, useUi } from "../../editor/use-document.js";
import { type PreferencesStore, usePreferences } from "../../shell/preferences-store.js";
import { PreviewStrip, StylingFrame } from "../StylingFrame.js";
import { StyleGroups } from "./StyleGroups.js";
import {
  applyStyle,
  cancelStyle,
  STYLE_SCOPES,
  type StyleAsks,
  type StyleScope,
  styledItemIn,
} from "./style-apply.js";
import type { StyleDialogState } from "./style-state.js";

/** Props of {@link StyleDialog}. */
export type StyleDialogProps = {
  readonly session: EditorSession;
  readonly state: StoreApi<StyleDialogState>;
  /** The editor level: Advanced mode adds the *CSS* tab (3.14). */
  readonly preferences: PreferencesStore;
  /** What applying asks with: D7 beyond the page, a theme's name. */
  readonly asks?: StyleAsks | undefined;
  /** The item drawn on a device, in the site's theme; none without a CSS compiler. */
  readonly itemPreviews?: ((node: NodeDoc, device: "desktop" | "mobile") => ReactNode) | undefined;
  /** The *CSS* tab beside the groups in Advanced mode (3.14); none without it. */
  readonly itemCss?: ItemCssServices | undefined;
};

/**
 * *Style this ‹kind›…* (3.13a, CT-2), in Theme Studio's frame (CT-11): the selected item's Appearance
 * fields as the Style tab has them and 3.13b's deeper groups, in one column at the dialog's full
 * height with their groups' headings in view and their provenance (3.12), and beside them a live
 * preview of the item on Desktop and Mobile (H3); a change shows in the preview and on the canvas at once. At the bottom, always in view,
 * where it applies: this one only, every one of its kind on the page or the site (2.27), or the
 * theme's look for its kind (3.12). Apply makes it one labelled step; Cancel takes it back.
 */
export function StyleDialog(props: StyleDialogProps) {
  const open = useStore(props.state, (dialog) => dialog.open);
  // Closed, it follows nothing of the document or the selection, which the canvas changes (R9).
  return open ? <OpenStyleDialog {...props} /> : null;
}

/** The dialog while it's open: the item as it is, its preview following the site. */
function OpenStyleDialog({
  session,
  state,
  preferences,
  asks,
  itemPreviews,
  itemCss,
}: StyleDialogProps) {
  const { since, scope } = useStore(state);
  const advanced = usePreferences(
    preferences,
    (prefs) => prefs.preferences.editorLevel === "advanced",
  );
  const [busy, setBusy] = useState(false);
  // The item as the dialog changes it: the preview and the counts follow the site and selection.
  const site = useDocument(session, (doc) => doc);
  const selection = useUi(session, (ui) => ui);
  // A step since it opened: changes that Esc, the X or Cancel would take back (#1439).
  const latest = useStore(
    session.history.state,
    ({ entries, cursor }) => entries[cursor - 1]?.id ?? null,
  );
  const item = styledItemIn(site, session.library, selection);
  if (item === undefined) return null;
  const { node } = item;
  const name = item.component.label;
  const close = () => state.setState({ open: false, since: null, scope: "this" });
  const cancel = () => {
    cancelStyle(session, since);
    close();
  };
  // Closed once applied; open still, with its changes, after a declined question.
  const apply = () => {
    setBusy(true);
    void applyStyle(session, since, scope, asks)
      .then((done) => {
        if (done) close();
      })
      .finally(() => setBusy(false));
  };
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !busy) cancel();
      }}
    >
      <StylingFrame
        title={t("style.title", { item: name })}
        description={t("style.description")}
        // Escape in the open choices of where it applies closes them, not the dialog (H3).
        onEscapeKeyDown={(event) => {
          if (event.target instanceof Element && event.target.closest("[data-scope-choices]")) {
            event.preventDefault();
          }
        }}
        preview={
          <PreviewStrip
            label={t("style.preview")}
            draw={(device) => itemPreviews?.(node, device)}
          />
        }
        actions={
          <>
            <ScopeChoice
              others={(reach) =>
                lookChangeIn(site, session.library, selection.pageId, selection.nodeId, reach)
                  ?.targets.length ?? 0
              }
              item={name}
              scope={scope}
              onChange={(next) => state.setState({ scope: next })}
            />
            <div className="ml-auto flex gap-2">
              <DialogCancel disabled={busy} onClick={cancel}>
                {t("style.cancel")}
              </DialogCancel>
              <Button disabled={busy} onClick={apply}>
                {t("style.apply")}
              </Button>
            </div>
          </>
        }
      >
        <UnsavedChanges changed={latest !== since} />
        {/* The groups, as wide as the dialog: the Appearance fields, and 3.13b's groups in
            StyleGroups; in Advanced mode, the item's CSS in a tab beside them (3.14). */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border">
          {advanced && itemCss !== undefined ? (
            <Tabs defaultValue="style" className="min-h-0 flex-1">
              <TabsList aria-label={t("style.tabs")}>
                <TabsTrigger value="style">{t("editPanel.style")}</TabsTrigger>
                <TabsTrigger value="css">{t("itemCss.tab")}</TabsTrigger>
              </TabsList>
              <TabsContent value="style" className="min-h-0 overflow-hidden">
                <StyleGroups session={session} />
              </TabsContent>
              <TabsContent value="css" className="min-h-0 overflow-auto">
                <ItemCss
                  session={session}
                  node={node}
                  component={item.component}
                  services={itemCss}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <StyleGroups session={session} />
          )}
        </div>
      </StylingFrame>
    </Dialog>
  );
}

/**
 * Where the changes apply (3.13a): one line, "Applies to: ‹the choice› · Change" (H3), so the
 * controls keep the height; **Change** opens the choices in place, each with how many others it
 * reaches on the page or the site, as 2.27 counts them, and what the theme's look does. Opening them
 * moves the focus to the one chosen; choosing one with the pointer, or Escape, closes them and gives
 * the focus back to **Change**. The keyboard's arrows choose as they move, so they leave them open.
 */
function ScopeChoice({
  others: count,
  item,
  scope,
  onChange,
}: {
  /** How many others of the kind the item's look reaches on the page or the site. */
  readonly others: (reach: "page" | "site") => number;
  readonly item: string;
  readonly scope: StyleScope;
  readonly onChange: (scope: StyleScope) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const change = useRef<HTMLButtonElement>(null);
  const choices = useRef<HTMLFieldSetElement>(null);
  // Opened, the focus goes to the choice made; closed by a choice or Escape, back to Change.
  const [focusChange, setFocusChange] = useState(false);
  useEffect(() => {
    if (open) choices.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
    else if (focusChange) change.current?.focus();
  }, [open, focusChange]);
  const close = () => {
    setFocusChange(true);
    setOpen(false);
  };
  if (!open) {
    return (
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 text-sm text-foreground">
        <span id={`${id}-summary`}>{t(`style.scope.summary.${scope}`, { item })}</span>
        <span aria-hidden className="text-muted-foreground">
          ·
        </span>
        {/* A link to look at, but a button's 24 px height to click (LF-18, #1454). */}
        <Button
          ref={change}
          variant="link"
          className="px-0"
          aria-expanded={false}
          aria-describedby={`${id}-summary`}
          onClick={() => {
            setFocusChange(false);
            setOpen(true);
          }}
        >
          {t("style.scope.change")}
        </Button>
      </div>
    );
  }
  const others = (reach: "page" | "site") => {
    const reached = count(reach);
    return reached === 0 ? t("style.scope.noOthers") : plural("style.scope.others", reached);
  };
  const detail: Readonly<Record<StyleScope, string | undefined>> = {
    this: undefined,
    page: others("page"),
    site: others("site"),
    theme: t("style.scope.theme.hint", { item }),
  };
  return (
    <fieldset
      ref={choices}
      data-scope-choices=""
      className="flex min-w-0 flex-1 flex-col gap-1.5"
      // Escape closes the choices, not the dialog (which leaves it to them, above).
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        close();
      }}
    >
      <legend className="mb-1 text-sm font-medium text-foreground">{t("style.scope")}</legend>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-x-4 gap-y-1.5">
        {STYLE_SCOPES.map((each) => {
          const detailId = `${id}-${each}`;
          const said = detail[each];
          return (
            <label key={each} className="flex items-start gap-2 text-sm text-foreground">
              <input
                type="radio"
                name={id}
                value={each}
                checked={scope === each}
                onChange={() => onChange(each)}
                // A click (by the pointer, or Space) chooses and closes; arrows only choose.
                onClick={(event) => {
                  if (event.detail > 0 || event.clientX !== 0 || event.clientY !== 0) close();
                }}
                onKeyDown={(event) => {
                  if (event.key === " " || event.key === "Enter") {
                    onChange(each);
                    close();
                  }
                }}
                className="mt-0.5 accent-primary"
                {...(said === undefined ? {} : { "aria-describedby": detailId })}
              />
              <span className="flex flex-col">
                {t(`style.scope.${each}`, { item })}
                {said === undefined ? null : (
                  <span id={detailId} className="text-xs text-muted-foreground">
                    {said}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
