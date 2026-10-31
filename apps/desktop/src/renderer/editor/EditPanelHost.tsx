import { EditPanel, type GroupAction } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useEffect, useMemo, useRef } from "react";
import { createEditPanelController } from "./edit-panel-controller.js";
import { type DialogGroups, fieldsFor, panelSlice, sameSlice } from "./edit-panel-fields.js";
import type { EditorSession } from "./editor-session.js";
import { ItemCss, type ItemCssServices } from "./ItemCssView.js";
import { breakpointOf, DEVICES } from "./responsive-value.js";
import { useDocument, useUi } from "./use-document.js";

/** Props of {@link EditPanelHost}. */
export type EditPanelHostProps = {
  readonly session: EditorSession;
  /** Ends a canvas text session before the panel changes the document. */
  readonly flush: () => void;
  /** Shows the Advanced tab: classes, attributes and the anchor (Advanced mode, F-ED-11). */
  readonly advanced?: boolean;
  /** Shows the Content tab only: Content mode locks styles and the Advanced settings (M3). */
  readonly contentOnly?: boolean;
  /**
   * The option groups the person closed, by component type (UX-13), and how to change them: UI
   * state, kept in the preferences, never in the document.
   */
  readonly closedGroups?: Readonly<Record<string, readonly string[]>>;
  readonly onClosedGroupsChange?: (type: string, closed: readonly string[]) => void;
  /** The app's actions in an option group's right-click menu: Apply Look to Every… (2.27). */
  readonly groupActions?: (id: string) => readonly GroupAction[];
  /**
   * Shows where an Appearance field's value comes from (CT-3): a Theme tab field, or a kind's look
   * (`look:‹type›`). Without it, the words say so but show nothing.
   */
  readonly revealSource?: (target: string) => void;
  /**
   * Only the Appearance group's fields, as one list without tabs or a heading: *Style this
   * Feature…*'s (3.13a), which names the element itself.
   */
  readonly appearanceOnly?: boolean;
  /**
   * With {@link appearanceOnly}, how *Style this ‹component›…* arranges the fields (3.13b): its
   * groups in order, and each field's group, or none to leave it out. The deeper groups' fields,
   * which the Style tab leaves out, show then. Without it, the Appearance group alone.
   */
  readonly dialogGroups?: DialogGroups | undefined;
  /** The Style tab's *Style this Feature…* button (3.13a); none without it. */
  readonly styleAction?: { readonly label: string; readonly onSelect: () => void } | undefined;
  /** The Advanced tab's read-only *CSS* of the item (3.14); none without it. */
  readonly itemCss?: ItemCssServices | undefined;
};

/**
 * The Edit panel for the element selected on the canvas (1.14): the fields `fieldsFor` draws for
 * it, and their changes, which `createEditPanelController` makes into history steps.
 */
export function EditPanelHost({
  session,
  flush,
  advanced = false,
  contentOnly = false,
  closedGroups,
  onClosedGroupsChange,
  groupActions,
  revealSource,
  appearanceOnly = false,
  dialogGroups,
  styleAction,
  itemCss,
}: EditPanelHostProps) {
  const { library } = session;
  const { pageId, nodeId, viewport, others = [] } = useUi(session, (ui) => ui);
  const { target, anchors } = useDocument(
    session,
    (site) => panelSlice(site, library, { pageId, nodeId }, advanced),
    (a, b) => sameSlice(a, b, library),
  );
  // The theme the section's overlay warning checks its text against (2.26).
  const theme = useDocument(session, (site) => site.theme);
  const breakpoint = breakpointOf(viewport);

  // The latest `flush`, which the host's owner may make anew on every drawing.
  const latestFlush = useRef(flush);
  useEffect(() => {
    latestFlush.current = flush;
  });
  const controller = useMemo(
    () => createEditPanelController(session, () => latestFlush.current()),
    [session],
  );
  // A run ends when the selection or the device view moves on while its field keeps focus (undo,
  // the canvas); closing the panel mid-drag cancels the drag (U2).
  const selectedId = target?.id;
  useEffect(() => controller.follow(selectedId, breakpoint), [controller, selectedId, breakpoint]);
  useEffect(() => () => controller.dispose(), [controller]);

  if (others.length > 0) {
    // Several selected elements (1.31): editing their fields together comes later.
    return (
      <p
        role="status"
        className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground"
      >
        {t("editPanel.several", { count: others.length + 1 })}
      </p>
    );
  }
  if (target === undefined) {
    return <EditPanel fields={[]} onChange={() => undefined} onCommit={() => undefined} />;
  }
  const { node, component, id } = target;
  const fields = fieldsFor(target, {
    library,
    theme,
    breakpoint,
    advanced,
    anchors,
    appearanceOnly,
    dialogGroups,
    openStyle: styleAction?.onSelect,
    revealSource,
  });

  return (
    <EditPanel
      heading={component.label}
      headingHidden={appearanceOnly}
      fields={fields}
      device={t(`device.${breakpoint}`)}
      onChange={(name, value) => controller.change(name, value)}
      onChangeOn={(name, device, value) => {
        const at = DEVICES.find((each) => each === device);
        if (at !== undefined) controller.change(name, value, at);
      }}
      onCommit={(name) => controller.commit(name)}
      onReset={(name) => controller.reset(name)}
      onResetToDefault={(names, group) => controller.resetToDefault(names, group)}
      onPaste={(values, group) => controller.paste(values, group)}
      {...(groupActions === undefined ? {} : { groupActions })}
      {...(closedGroups === undefined
        ? {}
        : {
            closedGroups: closedGroups[node.type] ?? [],
            onClosedGroupsChange: (closed: readonly string[]) =>
              onClosedGroupsChange?.(node.type, closed),
          })}
      advanced={advanced && !appearanceOnly}
      contentOnly={contentOnly}
      single={appearanceOnly}
      itemKey={id}
      styleAction={styleAction}
      advancedFooter={
        itemCss === undefined ? undefined : (
          <ItemCss session={session} node={node} component={component} services={itemCss} />
        )
      }
    />
  );
}
