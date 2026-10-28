import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@webforge/editor-ui";
import { plural, t } from "@webforge/i18n";
import type { NodeDoc } from "@webforge/model";
import { type ReactNode, useId, useState } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import { lookChangeIn } from "../../clipboard/index.js";
import type { EditorSession } from "../../editor/editor-session.js";
import { ItemCss, type ItemCssServices } from "../../editor/ItemCssView.js";
import { useDocument, useUi } from "../../editor/use-document.js";
import { type PreferencesStore, usePreferences } from "../../shell/preferences-store.js";
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

/** The devices the item is previewed on, side by side (3.13a). */
const PREVIEW_DEVICES = ["desktop", "mobile"] as const;

/** Props of {@link StyleDialog}. */
export type StyleDialogProps = {
  readonly session: EditorSession;
  readonly state: StoreApi<StyleDialogState>;
  /** The colour field follows the editor level: Advanced mode adds a hex colour (ADR 0009). */
  readonly preferences: PreferencesStore;
  /** What applying asks with: D7 beyond the page, a theme's name. */
  readonly asks?: StyleAsks | undefined;
  /** The item drawn on a device, in the site's theme; none without a CSS compiler. */
  readonly itemPreviews?: ((node: NodeDoc, device: "desktop" | "mobile") => ReactNode) | undefined;
  /** The *CSS* tab beside the groups in Advanced mode (3.14); none without it. */
  readonly itemCss?: ItemCssServices | undefined;
};

/**
 * *Style this ‹kind›…* (3.13a, CT-2), in Theme Studio's chrome: the selected item's Appearance
 * fields as the Style tab has them, with their provenance (3.12), beside a live preview of the item
 * on Desktop and Mobile; a change shows there and on the canvas at once. At the bottom, where it
 * applies: this one only, every one of its kind on the page or the site (2.27), or the theme's look
 * for its kind (3.12). Apply makes it one labelled step; Cancel takes it back. 3.13b adds the
 * deeper groups beside the Appearance fields.
 */
export function StyleDialog({
  session,
  state,
  preferences,
  asks,
  itemPreviews,
  itemCss,
}: StyleDialogProps) {
  const { open, since, scope } = useStore(state);
  const advanced = usePreferences(
    preferences,
    (prefs) => prefs.preferences.editorLevel === "advanced",
  );
  const [busy, setBusy] = useState(false);
  // The item as the dialog changes it: the preview and the counts follow the site and selection.
  const site = useDocument(session, (doc) => doc);
  const selection = useUi(session, (ui) => ui);
  const item = styledItemIn(site, session.library, selection);
  if (!open || item === undefined) return null;
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
      <DialogContent className="flex h-[min(46rem,calc(100dvh-2rem))] max-w-[calc(100%-2rem)] flex-col gap-3 sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t("style.title", { item: name })}</DialogTitle>
          <DialogDescription>{t("style.description")}</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,20rem)_minmax(0,1fr)] gap-4">
          {/* The groups' column: the Appearance fields, and 3.13b's groups in StyleGroups; in
              Advanced mode, the item's CSS in a tab beside them (3.14). */}
          <div className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border">
            {advanced && itemCss !== undefined ? (
              <Tabs defaultValue="style" className="min-h-0 flex-1">
                <TabsList aria-label={t("style.tabs")}>
                  <TabsTrigger value="style">{t("editPanel.style")}</TabsTrigger>
                  <TabsTrigger value="css">{t("itemCss.tab")}</TabsTrigger>
                </TabsList>
                <TabsContent value="style" className="min-h-0 overflow-hidden">
                  <StyleGroups session={session} preferences={preferences} />
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
              <StyleGroups session={session} preferences={preferences} />
            )}
          </div>
          <section
            aria-label={t("style.preview")}
            className="flex min-h-0 flex-wrap content-start items-start gap-4 overflow-auto"
          >
            {PREVIEW_DEVICES.map((device) => (
              <figure key={device} className="flex flex-col gap-1">
                <figcaption className="text-xs text-muted-foreground">
                  {t(`device.${device}`)}
                </figcaption>
                {itemPreviews?.(node, device)}
              </figure>
            ))}
          </section>
        </div>
        <ScopeChoice
          others={(reach) =>
            lookChangeIn(site, session.library, selection.pageId, selection.nodeId, reach)?.targets
              .length ?? 0
          }
          item={name}
          scope={scope}
          onChange={(next) => state.setState({ scope: next })}
        />
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={cancel}>
            {t("style.cancel")}
          </Button>
          <Button disabled={busy} onClick={apply}>
            {t("style.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Where the changes apply (3.13a): each choice with how many others it reaches on the page or the
 * site, as 2.27 counts them, and what the theme's look does.
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
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-sm font-medium text-foreground">{t("style.scope")}</legend>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
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
