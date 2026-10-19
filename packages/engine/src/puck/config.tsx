import type { ComponentConfig, Config, Field } from "@puckeditor/core";
import {
  type ComponentDef,
  type ComponentLibrary,
  EDITOR_RENDER_CONTEXT,
  type FieldDef,
} from "@webforge/site-components";
import { type ComponentType, Fragment, type ReactNode } from "react";

function toPuckField(field: FieldDef): Field {
  switch (field.kind) {
    case "text":
      return { type: "text", label: field.label, contentEditable: field.inline ?? false };
    case "richtext":
      return { type: "richtext", label: field.label, contentEditable: field.inline ?? true };
    case "select":
      return { type: "select", label: field.label, options: [...field.options] };
    case "media":
      // Phase 0: the media id as text; Phase 1 adds a media picker field.
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

function toPuckComponent(def: ComponentDef, revision: EditorRevision): ComponentConfig {
  const fieldsOfKind = (kind: FieldDef["kind"]) =>
    Object.entries(def.fields)
      .filter(([, field]) => field.kind === kind)
      .map(([name]) => name);
  const slotNames = fieldsOfKind("slot");
  const richTextNames = fieldsOfKind("richtext");
  return {
    label: def.label,
    fields: Object.fromEntries(
      Object.entries(def.fields).map(([name, field]) => [name, toPuckField(field)]),
    ),
    defaultProps: { ...def.defaults },
    render: (props: Record<string, unknown>) => {
      const { puck: _puck, id: rawId, ...values } = props;
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
      return <>{def.render({ id, values, slots, context: EDITOR_RENDER_CONTEXT })}</>;
    },
  };
}

/**
 * Translates Webforge's component library into a Puck config.
 *
 * `revision` keys each node's inline rich-text editors. Puck's editor ignores a value change from
 * outside while it believes the user's last keystrokes are still being saved, which can swallow
 * the first undo after a text session; the engine bumps the revision to remount the editor with
 * the right content instead (ADR 0004).
 */
export function toPuckConfig(
  library: ComponentLibrary,
  revision: EditorRevision = () => 0,
): Config {
  return {
    // No page-level fields yet (Puck's default root has a "title" field).
    root: { fields: {} },
    components: Object.fromEntries(
      Object.entries(library.components).map(([type, def]) => [
        type,
        toPuckComponent(def, revision),
      ]),
    ),
  };
}

/** Field kinds whose edits form a text-editing session (D1). */
export function isTextField(library: ComponentLibrary, type: string, field: string): boolean {
  const kind = library.components[type]?.fields[field]?.kind;
  return kind === "text" || kind === "richtext";
}
