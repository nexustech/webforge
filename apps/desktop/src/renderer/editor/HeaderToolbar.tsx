import { ToggleGroup, ToggleGroupItem } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import type { ContextualToolbar } from "../shell/contextual-toolbars.js";
import { type PreviewChoices, showsSmallScreens } from "./edit-previews.js";
import type { EditorSession } from "./editor-session.js";
import { useUi } from "./use-document.js";

/** The one item of the toggle, which is a toggle group of one so it looks like the others. */
const MOBILE_MENU = "mobileMenu";

/**
 * *Show mobile menu* (UX-26): a toggle that shows the Header's small-screen menu open on the
 * canvas, to see and select what's in it. Only the canvas shows it; the site doesn't change.
 */
function MobileMenuToggle({
  pressed,
  onChange,
}: {
  readonly pressed: boolean;
  readonly onChange: (pressed: boolean) => void;
}) {
  return (
    <ToggleGroup
      type="multiple"
      aria-label={t("headerToolbar.label")}
      value={pressed ? [MOBILE_MENU] : []}
      onValueChange={(next) => onChange(next.includes(MOBILE_MENU))}
    >
      <ToggleGroupItem value={MOBILE_MENU}>{t("headerToolbar.showMobileMenu")}</ToggleGroupItem>
    </ToggleGroup>
  );
}

/**
 * The selected Header's toolbar under the canvas toolbar (SP-4): *Show mobile menu* while the
 * canvas shows small screens (the Mobile view, or a custom width below the site's wide layout).
 * View state in `previews`, never an undo step (U6); shown in Content mode too, as it changes
 * nothing.
 */
export function headerToolbar({
  session,
  previews,
}: {
  readonly session: EditorSession;
  readonly previews: StoreApi<PreviewChoices>;
}): ContextualToolbar {
  return {
    id: "headerMobileMenu",
    types: ["Header"],
    inContentMode: true,
    component: function HeaderPreview() {
      const small = useUi(session, (ui) => showsSmallScreens(ui.viewport));
      const pressed = useStore(previews, (choices) => choices.mobileMenu);
      if (!small) return null;
      return (
        <MobileMenuToggle
          pressed={pressed}
          onChange={(mobileMenu) => previews.setState({ mobileMenu })}
        />
      );
    },
  };
}
