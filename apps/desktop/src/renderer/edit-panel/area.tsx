import { FieldRenderersProvider } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { SlidersHorizontalIcon } from "lucide-react";
import type { EditPanelPreferences } from "../../shared/ipc/prefs.js";
import { APPEARANCE_GROUP_ID, LOOK_COMMANDS } from "../clipboard/index.js";
import type { Area, EditorContext } from "../editor/areas.js";
import { EditPanelHost, type EditPanelHostProps } from "../editor/EditPanelHost.js";
import { type ItemCssServices, itemCssThrough } from "../editor/ItemCssView.js";
import { fieldRenderers } from "../fields/index.js";
import { useCommand, useCommandRegistry } from "../shell/command-context.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { type PreferencesStore, usePreferences } from "../shell/preferences-store.js";
import { THEME_PANEL_ID } from "../theme/index.js";

/** `preferences` with `closed` as the option groups closed for component `type` (UX-13). */
function withClosedGroups(
  preferences: EditPanelPreferences,
  type: string,
  closed: readonly string[],
): EditPanelPreferences {
  const others = Object.entries(preferences.closedGroups).filter(([each]) => each !== type);
  return {
    closedGroups: Object.fromEntries(
      closed.length === 0 ? others : [...others, [type, [...closed]]],
    ),
  };
}

/**
 * The Edit panel as the preferences have it: with the Advanced tab in Advanced mode, the Content
 * tab only in Content mode (R9), and the option groups the person closed (UX-13). The Appearance
 * group's right-click menu has *Apply Look to Every…* (2.27), the Edit menu's own commands, and the
 * Style tab *Style this ‹kind›…* (3.13a).
 */
function PreferredEditPanel({
  preferences,
  itemCss,
  ...props
}: Omit<
  EditPanelHostProps,
  | "advanced"
  | "contentOnly"
  | "closedGroups"
  | "onClosedGroupsChange"
  | "groupActions"
  | "styleAction"
  | "itemCss"
> & {
  readonly preferences: PreferencesStore;
  /** The CSS tab's worker and clipboard (#668), in Advanced mode. */
  readonly itemCss: Omit<ItemCssServices, "onOpenCustomCode">;
}) {
  const advanced = usePreferences(
    preferences,
    (state) => state.preferences.editorLevel === "advanced",
  );
  const contentOnly = usePreferences(preferences, (state) => state.mode !== "design");
  const closedGroups = usePreferences(
    preferences,
    (state) => state.preferences.editPanel.closedGroups,
  );
  const registry = useCommandRegistry();
  // The Appearance group's own actions (2.27): its look given to every other one of the kind.
  const onPage = useCommand(LOOK_COMMANDS.page);
  const onSite = useCommand(LOOK_COMMANDS.site);
  // The Style tab's *Style this ‹kind›…* (3.13a), while the selection has a look to style.
  const styleThis = useCommand(COMMAND_IDS.styleThis);
  // The Advanced tab's CSS points at Custom Code (3.14).
  const customCode = useCommand(COMMAND_IDS.customCode);
  const appearance = [onPage, onSite].flatMap((command) =>
    command === undefined
      ? []
      : [
          {
            label: command.label,
            enabled: command.enabled !== false,
            onSelect: () => void registry.run(command.id),
          },
        ],
  );
  return (
    <EditPanelHost
      {...props}
      groupActions={(id) => (id === APPEARANCE_GROUP_ID ? appearance : [])}
      styleAction={
        styleThis === undefined || styleThis.enabled === false
          ? undefined
          : { label: styleThis.label, onSelect: () => void registry.run(styleThis.id) }
      }
      advanced={advanced}
      contentOnly={contentOnly}
      itemCss={
        advanced
          ? {
              ...itemCss,
              onOpenCustomCode:
                customCode === undefined ? undefined : () => void registry.run(customCode.id),
            }
          : undefined
      }
      closedGroups={closedGroups}
      onClosedGroupsChange={(type, closed) =>
        preferences.change({
          editPanel: withClosedGroups(preferences.getState().preferences.editPanel, type, closed),
        })
      }
    />
  );
}

/**
 * The Edit panel (1.14), in place of Puck's own fields, in the right column's top (#668, A21).
 * Registered once: it follows the editor level and the mode (Content shows its Content tab only)
 * itself, so a switch redraws it alone (R9). The fields the app draws itself (R11, fields/) reach
 * main through `ctx.api`.
 */
export const editPanelArea: Area<EditorContext> = {
  id: "editPanel",
  register: ({ api, session, panels, preferences, engine, imagePicks }) => {
    // Images, links, icons, and colours with the theme's own colours and a contrast warning (1.37,
    // UX-25).
    const renderers = fieldRenderers({ api, session, preferences, imagePicks });
    const itemCss = itemCssThrough(api);
    function Edit() {
      return (
        <FieldRenderersProvider renderers={renderers}>
          <PreferredEditPanel
            session={session}
            preferences={preferences}
            itemCss={itemCss}
            flush={() => engine.flush()}
            // An Appearance field's source shows in the Theme tab, or a kind's look in Theme
            // Studio, which the Theme tab's registration opens (3.12, CT-3).
            revealSource={(target) => panels.show(THEME_PANEL_ID, target)}
          />
        </FieldRenderersProvider>
      );
    }
    return panels.register({
      id: "edit",
      slot: "right.top",
      title: t("editPanel.title"),
      icon: SlidersHorizontalIcon,
      component: Edit,
    });
  },
};
