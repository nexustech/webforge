import {
  Button,
  cn,
  EditPanel,
  type EditPanelField,
  type FieldRenderers,
  FieldRenderersProvider,
  fieldControlClass,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { LOOK_FIELDS, type NodeDoc, type ThemeTokens } from "@webforge/model";
import { type ComponentLibrary, fieldsHiddenBy } from "@webforge/site-components";
import { lookFieldsOf } from "../../clipboard/index.js";
import { specOf } from "../../editor/edit-panel-fields.js";
import { isOverridden, valueAt, withValueAt } from "../../editor/responsive-value.js";
import { TOKEN_CONTROLS, type TokenControl, tokenKey } from "../theme-controls.js";
import type { LookDraft } from "./studio-state.js";
import { TokenRow } from "./TokenRow.js";

/** The card style's own entry: cards are list items without an Appearance group (CT-1). */
const CARD_KIND = "Card";

/** The section drawn for the Card entry: one with cards. */
const CARD_PREVIEW = "Features";

/** A kind Components lists: a component type and its name, or the theme's card style. */
export type Kind = { readonly type: string; readonly label: string };

/** The kinds by category, as {@link lookKinds} lists them. */
export type KindGroups = readonly { readonly category: string; readonly kinds: readonly Kind[] }[];

/**
 * The kinds with a look (3.12, CT-1): every component whose Appearance group has fields a look
 * holds, by the Add panel's categories (its sections together, as the Add panel lists them), and
 * the theme's card style.
 */
export function lookKinds(library: ComponentLibrary): KindGroups {
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

/** The kind `kind` names in `groups`, or the first while it names none. */
export function shownKind(groups: KindGroups, kind: string | undefined): Kind | undefined {
  const all = groups.flatMap((group) => group.kinds);
  return all.find((each) => each.type === kind) ?? all[0];
}

/** The type drawn for a kind: the card style draws a section with cards. */
export const previewTypeOf = (kind: Kind): string =>
  kind.type === CARD_KIND ? CARD_PREVIEW : kind.type;

/** Props of {@link StudioComponents}. */
type StudioComponentsProps = {
  readonly theme: ThemeTokens;
  readonly library: ComponentLibrary;
  /** The kind shown ({@link shownKind}). */
  readonly shown: Kind;
  /**
   * The look's changes not applied yet (4.10), and the theme with them; the controls show them for
   * their kind.
   */
  readonly draft?: { readonly look: LookDraft; readonly theme: ThemeTokens } | undefined;
  /** Sets fields of `type`'s draft look, by name; `undefined` takes one off. */
  readonly onChange: (
    type: string,
    item: string,
    change: Readonly<Record<string, unknown>>,
  ) => void;
  /** Sets a theme token shown beside a look: the buttons', the card style. */
  readonly onToken: (control: TokenControl, value: unknown) => void;
  /** The colour fields' control: the theme's colours only, as a look holds (ADR 0009). */
  readonly renderers: FieldRenderers;
};

/** Props of {@link KindChoice}. */
type KindChoiceProps = {
  readonly groups: KindGroups;
  readonly shown: Kind;
  readonly onKind: (type: string) => void;
};

/**
 * Which kind Components shows (CT-11): a list by category in Theme Studio's top bar, so no column
 * is lost to it. Typing a kind's first letters picks it.
 */
export function KindChoice({ groups, shown, onKind }: KindChoiceProps) {
  return (
    <select
      aria-label={t("theme.components.kinds")}
      value={shown.type}
      onChange={(event) => onKind(event.currentTarget.value)}
      className={cn(fieldControlClass, "w-auto min-w-48")}
    >
      {groups.map(({ category, kinds }) => (
        <optgroup key={category} label={category}>
          {kinds.map((each) => (
            <option key={each.type} value={each.type}>
              {each.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/** Each kind's node as its larger preview draws it, with its defaults: made once, so kept. */
const previewNodes = new WeakMap<ComponentLibrary, Map<string, NodeDoc>>();

/** `type`'s node in `library`, with its defaults, the same object each time. */
export function previewNode(library: ComponentLibrary, type: string): NodeDoc {
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
 * Theme Studio's Components (3.12, CT-1): the chosen kind's look, so a kind is styled without
 * selecting one on a page. A look is the Appearance group's fields, here in columns as wide as the
 * dialog (CT-11); its controls change a draft, which the preview strip above draws, until **Apply
 * Changes** in the bar below writes it as one step (4.10), or **Discard** drops it. A Button's look
 * also shows the theme's button tokens, and Card the card style, which stay where they are in the
 * theme and change at once (product/11, 3.12 note 5).
 */
export function StudioComponents({
  theme,
  library,
  shown,
  draft,
  onChange,
  onToken,
  renderers,
}: StudioComponentsProps) {
  const def = library.components[shown.type];
  // The draft for this kind, if there is one: what its controls show.
  const drafted = draft?.look.type === shown.type ? draft : undefined;
  const look: Readonly<Record<string, unknown>> =
    (drafted?.theme ?? theme).looks?.[shown.type] ?? {};
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
    <section aria-label={shown.label} className="flex min-w-0 flex-col gap-3 pb-2">
      <div>
        <h3 className="m-0 text-sm font-semibold">{shown.label}</h3>
        <p className="m-0 text-xs text-muted-foreground">
          {shown.type === CARD_KIND
            ? t("theme.components.cardHelp")
            : t("theme.components.help", { item: shown.label })}
        </p>
      </div>
      {tokens.length === 0 ? null : (
        <div>
          {shown.type === "Button" ? (
            <h4 className="m-0 mb-1 text-xs font-semibold">{t("theme.components.buttons")}</h4>
          ) : null}
          {tokens.map((control) => (
            <TokenRow key={tokenKey(control)} control={control} theme={theme} onChange={onToken} />
          ))}
        </div>
      )}
      {fields.length === 0 ? null : (
        <FieldRenderersProvider renderers={renderers}>
          <EditPanel
            heading={t("theme.components.look", { item: shown.label })}
            single
            columns
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
  );
}
