import {
  Button,
  cn,
  EditPanel,
  type EditPanelField,
  type FieldRenderers,
  FieldRenderersProvider,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { LOOK_FIELDS, type NodeDoc, type ThemeTokens } from "@webforge/model";
import { type ComponentLibrary, fieldsHiddenBy } from "@webforge/site-components";
import { useState } from "react";
import { lookFieldsOf } from "../../clipboard/index.js";
import type { ItemPreviews, KindPreviews } from "../../editor/areas.js";
import { specOf } from "../../editor/EditPanelHost.js";
import { isOverridden, valueAt, withValueAt } from "../../editor/responsive-value.js";
import { TOKEN_CONTROLS, type TokenControl, tokenKey } from "../theme-controls.js";
import { StudioLookPreview } from "./StudioLookPreview.js";
import { TokenRow } from "./StudioStyles.js";
import type { LookDraft } from "./studio-state.js";

/** The card style's own entry: cards are list items without an Appearance group (CT-1). */
const CARD_KIND = "Card";

/** The section drawn for the Card entry: one with cards. */
const CARD_PREVIEW = "Features";

/** A kind Components lists: a component type and its name, or the theme's card style. */
type Kind = { readonly type: string; readonly label: string };

/**
 * The kinds with a look (3.12, CT-1): every component whose Appearance group has fields a look
 * holds, by the Add panel's categories (its sections together, as the Add panel lists them), and
 * the theme's card style.
 */
function lookKinds(
  library: ComponentLibrary,
): readonly { readonly category: string; readonly kinds: readonly Kind[] }[] {
  const groups = new Map<string, Kind[]>();
  const add = (category: string, kind: Kind) =>
    groups.set(category, [...(groups.get(category) ?? []), kind]);
  for (const [type, def] of Object.entries(library.components)) {
    if (!lookFieldsOf(def).some((name) => (LOOK_FIELDS as readonly string[]).includes(name))) {
      continue;
    }
    add(
      def.place === "section"
        ? t("theme.components.sections")
        : (def.category ?? t("theme.components.otherElements")),
      {
        type,
        label: def.label,
      },
    );
  }
  add(t("theme.components.sections"), { type: CARD_KIND, label: t("theme.components.card") });
  return [...groups].map(([category, kinds]) => ({ category, kinds }));
}

/** Whether a look's `value` differs on Tablet or Mobile. */
const perDevice = (value: unknown) =>
  isOverridden(value, "tablet") || isOverridden(value, "mobile");

/** The theme's tokens drawn beside a kind's look: the buttons' for Button, the card style. */
const tokensOf = (type: string): readonly TokenControl[] =>
  TOKEN_CONTROLS.filter(
    (control) =>
      (type === "Button" && control.group === "buttons") ||
      (type === CARD_KIND && tokenKey(control) === "cards.style"),
  );

/** Props of {@link StudioComponents}. */
type StudioComponentsProps = {
  readonly theme: ThemeTokens;
  readonly library: ComponentLibrary;
  /** The kind shown, a component type; the first while none is chosen. */
  readonly kind: string | undefined;
  readonly onKind: (type: string) => void;
  /**
   * The look's changes not applied yet (4.10), and the theme with them, which the previews draw;
   * the controls show them for their kind.
   */
  readonly draft?: { readonly look: LookDraft; readonly theme: ThemeTokens } | undefined;
  /** Sets fields of `type`'s draft look, by name; `undefined` takes one off. */
  readonly onChange: (
    type: string,
    item: string,
    change: Readonly<Record<string, unknown>>,
  ) => void;
  /** Applies the draft to the theme: one step (4.10). */
  readonly onApply: () => void;
  /** Drops the draft. */
  readonly onDiscard: () => void;
  /** Sets a theme token shown beside a look: the buttons', the card style. */
  readonly onToken: (control: TokenControl, value: unknown) => void;
  /** Draws a kind in the theme, with its look; nothing without one. */
  readonly preview?: KindPreviews | undefined;
  /** Draws a kind larger, on Desktop and Mobile, before and after the draft (4.10). */
  readonly enlarge?: ItemPreviews | undefined;
  /** The colour fields' control: the theme's colours only, as a look holds (ADR 0009). */
  readonly renderers: FieldRenderers;
};

/** Each kind's node as its larger preview draws it, with its defaults: made once, so kept. */
const previewNodes = new WeakMap<ComponentLibrary, Map<string, NodeDoc>>();

/** `type`'s node in `library`, with its defaults, the same object each time. */
function previewNode(library: ComponentLibrary, type: string): NodeDoc {
  let nodes = previewNodes.get(library);
  if (nodes === undefined) {
    nodes = new Map();
    previewNodes.set(library, nodes);
  }
  let node = nodes.get(type);
  if (node === undefined) {
    const defaults = library.components[type]?.defaults ?? {};
    node = { type, props: { ...structuredClone(defaults), id: "preview" } };
    nodes.set(type, node);
  }
  return node;
}

/**
 * Theme Studio's Components (3.12, CT-1): every kind of section and element with a look, by
 * category, and for the one chosen, it drawn live in the theme beside its look's controls, so a
 * kind is styled without selecting one on a page. A look is the Appearance group's fields; its
 * controls change a draft, which the preview draws, until **Apply changes** writes it as one step
 * (4.10), or **Discard** drops it. The preview opens larger, on Desktop and Mobile, before and
 * after. A Button's look also shows the theme's button tokens, and Card the card style, which stay
 * where they are in the theme and change at once (product/11, 3.12 note 5).
 */
export function StudioComponents({
  theme,
  library,
  kind,
  onKind,
  draft,
  onChange,
  onApply,
  onDiscard,
  onToken,
  preview,
  enlarge,
  renderers,
}: StudioComponentsProps) {
  const [enlarged, setEnlarged] = useState(false);
  const groups = lookKinds(library);
  const all = groups.flatMap((group) => group.kinds);
  const shown = all.find((each) => each.type === kind) ?? all[0];
  if (shown === undefined) return null;
  const def = library.components[shown.type];
  // The draft for this kind, if there is one: what its controls and previews show.
  const drafted = draft?.look.type === shown.type ? draft : undefined;
  const look: Readonly<Record<string, unknown>> =
    drafted?.look.look ?? theme.looks?.[shown.type] ?? {};
  const previewType = shown.type === CARD_KIND ? CARD_PREVIEW : shown.type;
  const names =
    def === undefined
      ? []
      : lookFieldsOf(def).filter((name) => (LOOK_FIELDS as readonly string[]).includes(name));
  const hidden =
    def === undefined ? new Set<string>() : fieldsHiddenBy(def, { ...def.defaults, ...look });
  const fields = names.flatMap((name): EditPanelField[] => {
    const field = def?.fields[name];
    const spec = field === undefined ? undefined : specOf(field);
    if (spec === undefined || hidden.has(name)) return [];
    const value = valueAt(look[name] ?? def?.defaults[name], "desktop");
    return [
      {
        ...spec,
        name,
        // The panel's one list, as the Theme tab's (2.3a).
        group: "content",
        value,
        ...(field?.optionGroup === undefined ? {} : { optionGroup: field.optionGroup }),
        ...(look[name] === undefined ? {} : { changed: true }),
        // A look set per device (from a file, or CT-2's dialog): this page changes Desktop's alone.
        ...(perDevice(look[name]) ? { help: t("theme.components.perDevice") } : {}),
      },
    ];
  });
  const tokens = tokensOf(shown.type);
  return (
    // The kinds and the chosen one's look scroll on their own: the list is long.
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,11rem)_minmax(0,1fr)] gap-4">
      <nav
        aria-label={t("theme.components.kinds")}
        className="flex min-h-0 flex-col gap-2 overflow-auto pr-1"
      >
        {groups.map(({ category, kinds }) => (
          <section key={category} aria-label={category}>
            <h3 className="m-0 mb-1 text-2xs font-semibold text-muted-foreground uppercase">
              {category}
            </h3>
            <ul className="m-0 flex list-none flex-col p-0">
              {kinds.map((each) => (
                <li key={each.type}>
                  <button
                    type="button"
                    aria-current={each.type === shown.type ? "true" : undefined}
                    className={cn(
                      "w-full rounded-sm px-2 py-1 text-left text-xs hover:bg-accent",
                      each.type === shown.type && "bg-accent font-semibold",
                    )}
                    onClick={() => onKind(each.type)}
                  >
                    {each.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
      <section
        aria-label={shown.label}
        className="flex min-h-0 min-w-0 flex-col gap-3 overflow-auto pr-1"
      >
        <h3 className="m-0 text-sm font-semibold">{shown.label}</h3>
        <p className="m-0 text-xs text-muted-foreground">
          {shown.type === CARD_KIND
            ? t("theme.components.cardHelp")
            : t("theme.components.help", { item: shown.label })}
        </p>
        {preview === undefined ? null : (
          <figure
            aria-label={t("theme.components.preview", { item: shown.label })}
            className="m-0 rounded-md border border-border bg-panel p-2"
          >
            {enlarge === undefined ? (
              preview(previewType, drafted?.theme)
            ) : (
              // Clicked, it opens larger, before and after (4.10).
              <button
                type="button"
                aria-label={t("theme.components.enlarge", { item: shown.label })}
                title={t("theme.components.enlarge", { item: shown.label })}
                className="block cursor-zoom-in rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
                onClick={() => setEnlarged(true)}
              >
                {preview(previewType, drafted?.theme)}
              </button>
            )}
          </figure>
        )}
        {enlarge === undefined ? null : (
          <StudioLookPreview
            // Each opening starts on the changes, whatever was shown last time.
            key={enlarged ? "open" : "closed"}
            open={enlarged}
            onOpenChange={setEnlarged}
            item={shown.label}
            node={previewNode(library, previewType)}
            theme={theme}
            draft={drafted?.theme}
            previews={enlarge}
          />
        )}
        {drafted === undefined ? null : (
          // The changes aren't in the theme until they are applied (4.10).
          <div
            role="status"
            className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2"
          >
            <p className="m-0 flex-1 text-xs">
              {t("theme.components.draft", { item: shown.label })}
            </p>
            <Button type="button" size="sm" variant="outline" onClick={onDiscard}>
              {t("theme.components.discard")}
            </Button>
            <Button type="button" size="sm" onClick={onApply}>
              {t("theme.components.apply")}
            </Button>
          </div>
        )}
        {tokens.length === 0 ? null : (
          <div>
            {shown.type === "Button" ? (
              <h4 className="m-0 mb-1 text-xs font-semibold">{t("theme.components.buttons")}</h4>
            ) : null}
            {tokens.map((control) => (
              <TokenRow
                key={tokenKey(control)}
                control={control}
                theme={theme}
                onChange={onToken}
              />
            ))}
          </div>
        )}
        {fields.length === 0 ? null : (
          <FieldRenderersProvider renderers={renderers}>
            <EditPanel
              heading={t("theme.components.look", { item: shown.label })}
              single
              itemKey={shown.type}
              fields={fields}
              onChange={(name, value) =>
                onChange(shown.type, shown.label, {
                  [name]: withValueAt(look[name], "desktop", value),
                })
              }
              onCommit={() => undefined}
              onResetToDefault={(reset) =>
                onChange(
                  shown.type,
                  shown.label,
                  Object.fromEntries(reset.map((name) => [name, undefined])),
                )
              }
            />
          </FieldRenderersProvider>
        )}
        {Object.keys(look).length === 0 ? (
          fields.length === 0 ? null : (
            <p className="m-0 text-xs text-muted-foreground">
              {t("theme.components.none", { item: shown.label })}
            </p>
          )
        ) : (
          <div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                onChange(
                  shown.type,
                  shown.label,
                  Object.fromEntries(Object.keys(look).map((name) => [name, undefined])),
                )
              }
            >
              {t("theme.components.reset")}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
