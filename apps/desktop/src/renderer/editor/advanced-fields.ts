import type { EditPanelField, ListChange, ListItem } from "@webforge/editor-ui";
import { type MessageKey, t } from "@webforge/i18n";
import {
  anchorIdSchema,
  attributeNameSchema,
  classNamesSchema,
  type NodeAdvanced,
  nodeAdvancedSchema,
} from "@webforge/model";

/**
 * The Advanced tab's fields (Advanced mode, F-ED-11), named by what they set in a node's
 * `advanced`: extra CSS classes, the anchor that section links point at, and HTML attributes.
 */
export const ADVANCED_FIELDS = {
  className: "advanced.className",
  anchorId: "advanced.anchorId",
  attributes: "advanced.attributes",
} as const;

/** How an undo label names each field: "Changed Heading CSS classes". */
const LABEL_KEYS: Readonly<Record<string, MessageKey>> = {
  [ADVANCED_FIELDS.className]: "history.field.className",
  [ADVANCED_FIELDS.anchorId]: "history.field.anchorId",
  [ADVANCED_FIELDS.attributes]: "history.field.attributes",
};

/** Whether `name` is one of the Advanced tab's fields. */
export function isAdvancedField(name: string): boolean {
  return name in LABEL_KEYS;
}

/** The field an undo label names for the Advanced tab's field `name`. */
export function advancedFieldLabel(name: string): string {
  const key = LABEL_KEYS[name];
  return key === undefined ? name : t(key);
}

/** Classes as the user typed them, with single spaces between them. */
const normaliseClasses = (value: string) => value.trim().split(/\s+/).filter(Boolean).join(" ");

/** A placeholder name for an added attribute, not yet used on the element. */
function newAttributeName(taken: readonly string[]): string {
  let name = "data-attribute";
  for (let number = 2; taken.includes(name); number++) {
    name = `data-attribute-${number}`;
  }
  return name;
}

/**
 * The Advanced tab's fields for a node's `advanced`. Each text field accepts only what a site file
 * accepts (see `nodeAdvancedSchema`), so nothing invalid can be stored, and the anchor none of
 * `takenAnchors`: the other elements' on the page, so links to it reach one place.
 */
export function advancedFields(
  advanced: NodeAdvanced | undefined,
  takenAnchors: readonly string[] = [],
): EditPanelField[] {
  const attributes = Object.entries(advanced?.attributes ?? {});
  const names = attributes.map(([name]) => name);
  return [
    {
      name: ADVANCED_FIELDS.className,
      kind: "text",
      group: "advanced",
      label: t("editPanel.advanced.className"),
      placeholder: t("editPanel.advanced.classNamePlaceholder"),
      value: advanced?.className ?? "",
      validate: (value) =>
        classNamesSchema.safeParse(normaliseClasses(value)).success
          ? undefined
          : t("editPanel.advanced.classNameInvalid"),
    },
    {
      name: ADVANCED_FIELDS.anchorId,
      kind: "text",
      group: "advanced",
      label: t("editPanel.advanced.anchorId"),
      placeholder: t("editPanel.advanced.anchorIdPlaceholder"),
      value: advanced?.anchorId ?? "",
      validate: (value) =>
        value !== "" && !anchorIdSchema.safeParse(value).success
          ? t("editPanel.advanced.anchorIdInvalid")
          : takenAnchors.includes(value)
            ? t("editPanel.advanced.anchorIdTaken")
            : undefined,
    },
    {
      name: ADVANCED_FIELDS.attributes,
      kind: "list",
      group: "advanced",
      label: t("editPanel.advanced.attributes"),
      itemLabel: t("editPanel.advanced.attribute"),
      orderless: true,
      itemFields: [
        {
          name: "name",
          kind: "text",
          label: t("editPanel.advanced.attributeName"),
          validate: (value) =>
            !attributeNameSchema.safeParse(value).success
              ? t("editPanel.advanced.attributeNameInvalid")
              : names.includes(value)
                ? t("editPanel.advanced.attributeNameTaken")
                : undefined,
        },
        {
          name: "value",
          kind: "text",
          label: t("editPanel.advanced.attributeValue"),
          validate: (value) =>
            value.length > 1000 ? t("editPanel.advanced.attributeValueTooLong") : undefined,
        },
      ],
      // Keyed by position: an attribute keeps its row while its name is edited.
      value: attributes.map(
        ([name, value], index): ListItem => ({ id: String(index), name, value }),
      ),
    },
  ];
}

/** `attributes` with one change from the Attributes list. */
function withAttributeChange(
  attributes: Readonly<Record<string, string>> | undefined,
  change: ListChange,
): Record<string, string> {
  const entries = Object.entries(attributes ?? {});
  const index = change.type === "add" ? -1 : Number(change.id);
  const entry = entries[index];
  switch (change.type) {
    case "add":
      entries.push([newAttributeName(entries.map(([name]) => name)), ""]);
      break;
    case "remove":
      entries.splice(index, 1);
      break;
    case "move":
      if (entry !== undefined) {
        entries.splice(index, 1);
        entries.splice(change.to, 0, entry);
      }
      break;
    case "edit":
      if (entry !== undefined) {
        entries[index] =
          change.name === "name"
            ? [String(change.value), entry[1]]
            : [entry[0], String(change.value)];
      }
      break;
  }
  return Object.fromEntries(entries);
}

/** `advanced` without its empty options; undefined if none is left. */
function compact(advanced: NodeAdvanced): NodeAdvanced | undefined {
  const { className, anchorId, attributes } = advanced;
  const result: NodeAdvanced = {
    ...(className === undefined || className === "" ? {} : { className }),
    ...(anchorId === undefined || anchorId === "" ? {} : { anchorId }),
    ...(attributes === undefined || Object.keys(attributes).length === 0 ? {} : { attributes }),
  };
  return Object.keys(result).length === 0 ? undefined : result;
}

/**
 * `advanced` with the Advanced tab's field `name` set to `value` (for Attributes, a list change).
 * Anything a site file wouldn't accept leaves `advanced` as it was.
 */
export function withAdvancedChange(
  advanced: NodeAdvanced | undefined,
  name: string,
  value: unknown,
): NodeAdvanced | undefined {
  const current: NodeAdvanced = {
    ...(advanced?.className === undefined ? {} : { className: advanced.className }),
    ...(advanced?.anchorId === undefined ? {} : { anchorId: advanced.anchorId }),
    ...(advanced?.attributes === undefined ? {} : { attributes: { ...advanced.attributes } }),
  };
  let next: NodeAdvanced;
  switch (name) {
    case ADVANCED_FIELDS.className:
      next = { ...current, className: normaliseClasses(String(value)) };
      break;
    case ADVANCED_FIELDS.anchorId:
      next = { ...current, anchorId: String(value) };
      break;
    case ADVANCED_FIELDS.attributes:
      next = {
        ...current,
        attributes: withAttributeChange(current.attributes, value as ListChange),
      };
      break;
    default:
      return advanced;
  }
  const result = compact(next);
  return result === undefined || nodeAdvancedSchema.safeParse(result).success ? result : advanced;
}
