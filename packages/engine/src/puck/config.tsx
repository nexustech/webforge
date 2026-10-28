import type { ComponentConfig, Config, Field, PuckContext } from "@puckeditor/core";
import type { Extensions } from "@tiptap/core";
import { HIDDEN_ATTRIBUTE, isNodeDoc, type NodeDoc } from "@webforge/model";
import {
  type ComponentDef,
  type ComponentLibrary,
  EDITOR_RENDER_CONTEXT,
  type FieldDef,
  type RenderContext,
  withAdvanced,
  withLook,
} from "@webforge/site-components";
import { type ComponentType, cloneElement, Fragment, isValidElement, type ReactNode } from "react";
import { FormatToolbar, richTextField } from "./rich-text.js";
import { ROOT_ZONE } from "./tree.js";

/**
 * What rich text being edited has: the format toolbar over it, as Puck takes it, and the editor's
 * extensions (the text keys).
 */
export type RichTextTools = {
  readonly toolbar: Parameters<typeof richTextField>[2];
  readonly extensions: Extensions;
};

const DEFAULT_RICH_TEXT_TOOLS: RichTextTools = { toolbar: FormatToolbar, extensions: [] };

function toPuckField(field: FieldDef, richText: RichTextTools): Field {
  switch (field.kind) {
    case "text":
      return { type: "text", label: field.label, contentEditable: field.inline ?? false };
    case "richtext":
      return richTextField(
        field.label,
        field.inline ?? true,
        richText.toolbar,
        richText.extensions,
      );
    case "select":
      return { type: "select", label: field.label, options: [...field.options] };
    case "media":
    case "code":
    case "link":
    case "icon":
    // The Edit panel (1.14) edits these; Puck only needs to know the field exists.
    case "toggle":
    case "slider":
    case "color":
    case "spacing":
    case "box":
    case "list":
      return { type: "text", label: field.label };
    case "slot":
      return {
        type: "slot",
        label: field.label,
        ...(field.allow === undefined ? {} : { allow: [...field.allow] }),
      };
  }
}

/** Gives the rich-text editors of a node a new identity; see {@link toPuckConfig}. */
export type EditorRevision = (nodeId: string) => number;

function toPuckComponent(
  type: string,
  def: ComponentDef,
  revision: EditorRevision,
  context: () => RenderContext,
  richText: RichTextTools,
): ComponentConfig {
  const fieldsOfKind = (kind: FieldDef["kind"]) =>
    Object.entries(def.fields)
      .filter(([, field]) => field.kind === kind)
      .map(([name]) => name);
  const slotNames = fieldsOfKind("slot");
  const richTextNames = fieldsOfKind("richtext");
  const fields: Record<string, Field> = Object.fromEntries(
    Object.entries(def.fields).map(([name, field]) => [name, toPuckField(field, richText)]),
  );
  if (Object.values(def.fields).some((field) => field.kind === "text" && field.bindable)) {
    // Puck walks a prop it has no field for with the element's own fields, so it would take
    // `bindings.text` for the inline `text` field and put its editor there. An object field with
    // no fields of its own keeps the bindings as they are (1.17).
    fields.bindings = { type: "object", objectFields: {} };
  }
  return {
    label: def.label,
    fields,
    defaultProps: withoutChildIds(def.defaults),
    render: (props: Record<string, unknown>) => {
      const { puck: _puck, id: rawId, ...own } = props;
      // The theme's look for its kind under what it sets itself (3.12, CT-1), as the export does.
      const values = withLook(own, type, context().looks);
      const id = typeof rawId === "string" ? rawId : "";
      for (const name of richTextNames) {
        values[name] = <Fragment key={revision(id)}>{values[name] as ReactNode}</Fragment>;
      }
      const slots = Object.fromEntries(
        slotNames
          .map((name) => [name, values[name]] as const)
          .filter(
            (entry): entry is readonly [string, ComponentType] => typeof entry[1] === "function",
          ),
      );
      const output = withAdvanced(
        def.render({ id, values, slots, context: context() }),
        values.advanced,
      );
      return <>{values.hidden === true ? markedHidden(output) : output}</>;
    },
  };
}

/**
 * A hidden element's output (Layers' Hide, F-ED-12), marked so the canvas shows it dimmed: it stays
 * on the canvas, and selectable, so it can be shown again. The export leaves it out instead.
 * Output whose root isn't an HTML element is left as it is.
 */
function markedHidden(output: ReactNode): ReactNode {
  return isValidElement(output) && typeof output.type === "string"
    ? cloneElement(output, { [HIDDEN_ATTRIBUTE]: "" } as Record<string, unknown>)
    : output;
}

/** `node` and the elements in its slots without their ids. */
function withoutIds(node: NodeDoc): Omit<NodeDoc, "props"> & { props: Record<string, unknown> } {
  const { id: _id, ...props } = node.props;
  return { type: node.type, props: withoutChildIds(props) };
}

/**
 * A component's defaults with the elements in its slots (a Columns' columns, a List's items) left
 * without ids, so Puck gives each placed copy ids of its own: it keeps an id a default has.
 */
function withoutChildIds(defaults: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(defaults).map(([name, value]) => [
      name,
      Array.isArray(value) && value.length > 0 && value.every(isNodeDoc)
        ? value.map(withoutIds)
        : value,
    ]),
  );
}

/**
 * Translates Webforge's component library into a Puck config.
 *
 * `revision` keys each node's inline rich-text editors. Puck's editor ignores a value change from
 * outside while it believes the user's last keystrokes are still being saved, which can swallow
 * the first undo after a text session; the engine bumps the revision to remount the editor with
 * the right content instead (ADR 0004).
 *
 * `context` is read on every render, so a newer one (the site's Media images) shows when the page
 * is drawn again. `richText` is what rich text being edited has: the format toolbar over it, and
 * the editor's extensions.
 */
export function toPuckConfig(
  library: ComponentLibrary,
  revision: EditorRevision = () => 0,
  context: () => RenderContext = () => EDITOR_RENDER_CONTEXT,
  richText: RichTextTools = DEFAULT_RICH_TEXT_TOOLS,
): Config {
  // The page's top level takes sections only (F-ED-1): elements go inside them, and the shared
  // Header and Footer and an FAQ's questions are never added there. Puck then shows no drop place
  // for anything else between sections, whether dragged from the Add panel or the canvas.
  const sections = Object.entries(library.components)
    .filter(([, def]) => def.place === "section")
    .map(([type]) => type);
  return {
    root: {
      // No page-level fields yet (Puck's default root has a "title" field).
      fields: {},
      // Puck's own top level when not editing (static HTML). While editing, the page's drop zone
      // is marked (`wf-sections`), so a theme's alternating sections show on the canvas too, where
      // each section is in a wrapper of Puck's (2.13d).
      render: ({ puck, children }: { puck: PuckContext; children: ReactNode }) => (
        <>
          {puck.isEditing
            ? puck.renderDropZone({ zone: ROOT_ZONE, allow: sections, className: "wf-sections" })
            : children}
        </>
      ),
    },
    components: Object.fromEntries(
      Object.entries(library.components).map(([type, def]) => [
        type,
        toPuckComponent(type, def, revision, context, richText),
      ]),
    ),
  };
}

/** Field kinds whose edits form a text-editing session (D1). */
export function isTextField(library: ComponentLibrary, type: string, field: string): boolean {
  const kind = library.components[type]?.fields[field]?.kind;
  return kind === "text" || kind === "richtext";
}
