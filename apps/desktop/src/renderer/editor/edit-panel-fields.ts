import {
  type EditPanelField,
  type FieldSpec,
  type OptionGroup,
  type PlainFieldKind,
  sameValue,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import {
  BOX_SIDES,
  type Breakpoint,
  findNode,
  type NodeDoc,
  type PageId,
  type SiteDoc,
  SPACING_TOKENS,
} from "@webforge/model";
import {
  APPEARANCE_FIELDS,
  type ComponentLibrary,
  type FieldDef,
  fieldsHiddenBy,
  MAX_TEXT_LENGTH,
  textStylesOf,
  withLook,
} from "@webforge/site-components";
import { advancedFields } from "./advanced-fields.js";
import { withBindingChoice } from "./binding-fields.js";
import { arranged, gradientSource } from "./dialog-fields.js";
import { fieldGroupOf } from "./field-group.js";
import { type FieldTarget, fieldTarget } from "./field-target.js";
import { type EditableList, editableList, listItems } from "./list-edit.js";
import { overlayWarning } from "./overlay-warning.js";
import { provenanceOf } from "./provenance.js";
import {
  DEVICES,
  differsFromDefault,
  isOverridden,
  sourceOf,
  valueAt,
} from "./responsive-value.js";
import { shownLayout } from "./shared-layout.js";
import { anchorsTakenInSection } from "./shared-sections.js";

/**
 * The Edit panel's spec for a field (R11): its kind with everything its renderer needs, or undefined
 * for fields edited elsewhere. Rich text is edited on the canvas (1.23), slots by dragging elements
 * in. Lists, and slots of one type, are drawn as lists by {@link listField} (see editableList).
 */
export function specOf(field: FieldDef): FieldSpec | undefined {
  const { label } = field;
  switch (field.kind) {
    // The input stops at the longest text the field takes, as a change past it isn't recorded.
    case "text":
      return { kind: "text", label, maxLength: MAX_TEXT_LENGTH };
    case "toggle":
      return { kind: "toggle", label };
    case "select":
      return { kind: "select", label, options: field.options };
    case "color":
      return { kind: "color", label, options: field.options };
    case "spacing":
      return { kind: "spacing", label, options: field.options };
    case "slider":
      return { kind: "slider", label, steps: field.steps };
    // Padding or margin per side (1.32): a spacing token for each side.
    case "box":
      return {
        kind: "box",
        label,
        options: SPACING_TOKENS.map((value) => ({ label: t(`field.spacing.${value}`), value })),
        sides: (field.sides ?? BOX_SIDES).map((value) => ({
          label: t(`field.side.${value}`),
          value,
        })),
      };
    // A Media image, with alt text for this placement (1.16): see ImageField.
    case "media":
      return { kind: "image", label };
    // Where a link goes (1.19): see LinkField.
    case "link":
      return { kind: "link", label };
    // One of Lucide's icons (F-ED-22): see IconField.
    case "icon":
      return { kind: "icon", label };
    case "code":
      return { kind: "code", label };
    case "list":
    case "richtext":
    case "slot":
      return undefined;
  }
}

/** The spec of a field an item of a list can have: a plain value. */
function itemSpecOf(field: FieldDef): FieldSpec<PlainFieldKind> | undefined {
  const spec = specOf(field);
  switch (spec?.kind) {
    case "text":
    case "select":
    case "toggle":
    case "slider":
    case "color":
    case "spacing":
      return spec;
    default:
      return undefined;
  }
}

/** The Edit panel field for a list: its items, and the fields of an item's row. */
function listField(
  name: string,
  field: FieldDef,
  list: EditableList,
  stored: unknown,
): EditPanelField {
  return {
    name,
    kind: "list",
    label: field.label,
    group: field.group ?? "content",
    value: listItems(stored, list),
    itemLabel: list.itemLabel,
    itemFields: Object.entries(list.fields).flatMap(([itemName, def]) => {
      const spec = itemSpecOf(def);
      return spec === undefined ? [] : [{ ...spec, name: itemName }];
    }),
  };
}

/**
 * The anchors other elements use (Advanced tab, F-ED-11): in a copy, those its shared section's
 * anchors may not repeat; else the page's own, including the shared Header and Footer, and for an
 * element of the Header or Footer, every page that shows it.
 */
function takenAnchors(site: SiteDoc, target: FieldTarget): string[] {
  if (target.inCopy !== undefined) {
    return anchorsTakenInSection(site, target.inCopy.shared.id, target.inCopy.node.props.id);
  }
  const taken: string[] = [];
  const { region } = target;
  const pages =
    region === undefined
      ? [target.page]
      : Object.values(site.pages)
          .filter((other) => shownLayout(site, other.id)[region].length > 0)
          .map((other) => other.doc);
  const nodes = pages.flatMap((other) => other.content);
  findNode([...site.layout.header, ...nodes, ...site.layout.footer], (other) => {
    const anchor = other.props.advanced?.anchorId;
    if (anchor !== undefined && other.props.id !== target.id) taken.push(anchor);
    return false;
  });
  return taken;
}

/** What the panel draws of the site: the selected element, and in Advanced mode the anchors taken. */
export type PanelSlice = { readonly target: FieldTarget | undefined; readonly anchors: string[] };

/** The slice of `site` the panel draws for element `nodeId` of page `pageId`. */
export function panelSlice(
  site: SiteDoc,
  library: ComponentLibrary,
  at: { readonly pageId: PageId; readonly nodeId: string | null },
  advanced: boolean,
): PanelSlice {
  const target = fieldTarget(site, library, at.pageId, at.nodeId);
  return { target, anchors: advanced && target ? takenAnchors(site, target) : [] };
}

/**
 * Whether `a` and `b`, two states of the element of component `component`, look the same in the
 * panel: the same values, besides the elements in its slots, which the panel doesn't show (unless
 * it edits them as a list). Typing in a Section's Heading leaves the Section's panel as it is.
 */
function samePanelValues(
  a: NodeDoc,
  b: NodeDoc,
  component: FieldTarget["component"],
  library: ComponentLibrary,
): boolean {
  if (a === b) return true;
  const names = new Set([...Object.keys(a.props), ...Object.keys(b.props)]);
  for (const name of names) {
    const field = component.fields[name];
    const shown = field?.kind !== "slot" || editableList(field, library) !== undefined;
    if (shown && !sameValue(a.props[name], b.props[name])) return false;
  }
  return true;
}

/**
 * Whether the panel would draw the same: the same element, with the same values, in the same place
 * (R9). Anything else in the document, such as typing in another element, leaves it as it is.
 */
export function sameSlice(a: PanelSlice, b: PanelSlice, library: ComponentLibrary): boolean {
  const x = a.target;
  const y = b.target;
  if (x === undefined || y === undefined) return x === y && sameValue(a.anchors, b.anchors);
  return (
    x.id === y.id &&
    x.component === y.component &&
    x.region === y.region &&
    x.copyLabel === y.copyLabel &&
    samePanelValues(x.node, y.node, x.component, library) &&
    sameValue(a.anchors, b.anchors)
  );
}

/** How *Style this ‹component›…* arranges the fields (3.13b): its groups, and each field's group. */
export type DialogGroups = {
  readonly order: readonly OptionGroup[];
  readonly of: (name: string, field: FieldDef) => OptionGroup | undefined;
};

/** What {@link fieldsFor} draws the fields with, besides the element. */
export type FieldsOptions = {
  readonly library: ComponentLibrary;
  /** The theme the element's looks and its section's overlay warning come from (2.26, 3.12). */
  readonly theme: SiteDoc["theme"];
  /** The device the canvas shows, whose value a field set per device shows (F-ED-4). */
  readonly breakpoint: Breakpoint;
  /** Advanced mode's fields: classes, attributes and the anchor, with the anchors taken. */
  readonly advanced: boolean;
  readonly anchors: readonly string[];
  /** Only the Appearance group's fields, as *Style this Feature…*'s one list (3.13a). */
  readonly appearanceOnly: boolean;
  /** With {@link appearanceOnly}, *Style this ‹component›…*'s groups (3.13b). */
  readonly dialogGroups?: DialogGroups | undefined;
  /** The Style tab's *Style this Feature…*, which a gradient's words open (CT-4). */
  readonly openStyle?: (() => void) | undefined;
  /** Shows where an Appearance field's value comes from (CT-3). */
  readonly revealSource?: ((target: string) => void) | undefined;
};

/**
 * The Edit panel's fields for `target`, the selected element (1.14): each field the panel edits,
 * with its value for the device shown, whether it's changed or overridden there, its value per
 * device (SP-5), and where an Appearance value comes from (CT-3). A layout that doesn't use a field
 * hides it (#311).
 */
export function fieldsFor(target: FieldTarget, options: FieldsOptions): EditPanelField[] {
  const { node, component, storedOr } = target;
  const { library, theme, breakpoint, dialogGroups, revealSource } = options;
  // What a field's `unavailable` is asked about: the element's values, over its kind's look from
  // the theme (3.12) and its defaults.
  const values = { ...component.defaults, ...withLook(node.props, node.type, theme.looks) };
  // A layout that doesn't use a field hides it; its value stays for the layouts that do (#311).
  const hidden = fieldsHiddenBy(component, values);
  // What the Appearance group's words say its values come from (3.12, CT-3).
  const look: Readonly<Record<string, unknown>> = theme.looks?.[node.type] ?? {};
  const textStyles = textStylesOf(node, library, theme.looks);
  const provenance = (name: string, label: string, own: unknown, responsive: boolean) => {
    const found = provenanceOf({
      name,
      label,
      own,
      look: look[name],
      initial: component.defaults[name],
      responsive,
      breakpoint,
      type: node.type,
      item: component.label,
      corners: component.themeCorners,
      classes: node.props.advanced?.className ?? "",
      textStyle: textStyles.length === 1 ? textStyles[0] : undefined,
      theme,
    });
    if (found === undefined) return {};
    const { text, reveal } = found;
    return {
      source: {
        text,
        ...(reveal === undefined || revealSource === undefined
          ? {}
          : { onReveal: () => revealSource(reveal) }),
      },
    };
  };
  const fields = Object.entries(component.fields).flatMap(([name, field]): EditPanelField[] => {
    // Style this ‹component›…'s deeper groups (3.13b) are the dialog's own: the Style tab keeps
    // the Appearance basics.
    if (hidden.has(name) || (field.inDialog === true && dialogGroups === undefined)) return [];
    const list = editableList(field, library);
    if (list !== undefined) {
      return [listField(name, field, list, node.props[name])];
    }
    const spec = specOf(field);
    if (spec === undefined) {
      return [];
    }
    // What it draws with (its own value, else its kind's look, else the default), and what it
    // sets itself: only that is set for a device or reset per device (3.12).
    const own = node.props[name];
    const stored = storedOr(name, own);
    const responsive = field.responsive === true;
    const unavailable = field.unavailable?.(values);
    const help = unavailable ?? field.help;
    const warning = overlayWarning(field, values, theme, component);
    // A text field that can show a Site Settings value gets a choice of what it shows (1.17).
    return withBindingChoice(name, field, node.props.bindings, [
      {
        ...spec,
        name,
        group: fieldGroupOf(field),
        value: responsive ? valueAt(stored, breakpoint) : stored,
        ...(field.optionGroup === undefined ? {} : { optionGroup: field.optionGroup }),
        ...(help === undefined ? {} : { help }),
        ...(warning === undefined ? {} : { warning }),
        // Where its value comes from (CT-3), on the Appearance basics and the dialog's deeper
        // groups; and, on the Colour of a background drawn as a gradient, that (CT-4).
        ...(field.optionGroup?.id === APPEARANCE_FIELDS.lookShadow.optionGroup.id ||
        field.inDialog === true
          ? provenance(name, field.label, own, responsive)
          : {}),
        ...(name === "lookBackground"
          ? gradientSource(
              values,
              breakpoint,
              dialogGroups === undefined
                ? {
                    item: component.label,
                    ...(options.openStyle === undefined ? {} : { open: options.openStyle }),
                  }
                : { inDialog: true },
            )
          : {}),
        // Its Reset leaves it to its kind's look, where the theme has one for it (3.12): on
        // Desktop, while no other device keeps a value of its own (#567).
        ...(look[name] !== undefined &&
        breakpoint === "desktop" &&
        !isOverridden(own, "tablet") &&
        !isOverridden(own, "mobile")
          ? { resetLabel: t("editPanel.resetToLook") }
          : {}),
        ...(unavailable === undefined ? {} : { disabled: true }),
        ...(responsive && breakpoint !== "desktop" ? { responsive: true } : {}),
        ...(differsFromDefault(stored, storedOr(name, undefined), responsive, breakpoint)
          ? { changed: true }
          : {}),
        ...(responsive && isOverridden(own, breakpoint) ? { overridden: true } : {}),
        // Its value on each device, in rows of their own (SP-5).
        ...(responsive
          ? {
              devices: DEVICES.map((each) => ({
                id: each,
                label: t(`device.${each}`),
                value: valueAt(stored, each),
                own: each === "desktop" || isOverridden(own, each),
                inEffect: each === sourceOf(own, breakpoint),
              })),
            }
          : {}),
      },
    ]);
  });

  if (options.advanced && !options.appearanceOnly) {
    fields.push(...advancedFields(node.props.advanced, [...options.anchors]));
  }
  if (!options.appearanceOnly) return fields;
  // The dialog's one list: the Appearance group, in the list a panel without tabs shows (3.13a).
  return dialogGroups === undefined
    ? fields.flatMap((field) =>
        field.optionGroup?.id === APPEARANCE_FIELDS.lookShadow.optionGroup.id
          ? [{ ...field, group: "content" as const }]
          : [],
      )
    : arranged(fields, dialogGroups, component.fields);
}
