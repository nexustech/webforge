import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  WithTooltip,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { EyeClosedIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { type MouseEvent, useState } from "react";
import { type Layer, type LayerShown, layerItem, layerShown } from "../editor/layers.js";

/** Each way a layer can show (UX-23), in the menu's order: its choice, how it is then, its icon. */
const SHOWN_CHOICES = [
  { shown: "shown", label: "layers.shown.shown", now: "layers.shownNow.shown", Icon: EyeIcon },
  {
    shown: "editorHidden",
    label: "layers.shown.editorHidden",
    now: "layers.shownNow.editorHidden",
    Icon: EyeClosedIcon,
  },
  {
    shown: "hidden",
    label: "layers.shown.hidden",
    now: "layers.shownNow.hidden",
    Icon: EyeOffIcon,
  },
] as const;

/**
 * A row's eye (UX-23, #864): how the layer shows, and a menu to change it. *Show*, *Hide while
 * editing* (not on the canvas, still on the website) or *Don't publish* (dimmed on the canvas, not
 * on the website). Out of the row's tab order, as the row's keys and the toolbar reach the same.
 */
export function ShownMenu({
  layer,
  disabled,
  canHideWhileEditing,
  onShown,
  onClosed,
}: {
  readonly layer: Layer;
  readonly disabled: boolean;
  readonly canHideWhileEditing: boolean;
  readonly onShown: (shown: LayerShown) => void;
  /** Once the menu has closed: it's gone with its button, so the row takes the focus back. */
  readonly onClosed: () => void;
}) {
  const [open, setOpen] = useState(false);
  const shown = layerShown(layer);
  const current = SHOWN_CHOICES.find((choice) => choice.shown === shown) ?? SHOWN_CHOICES[0];
  const label = t("layers.shownMenu", {
    item: layerItem(layer),
    shown: t(current.now),
  });
  const eye = {
    type: "button" as const,
    tabIndex: -1,
    disabled,
    "aria-label": label,
    "aria-haspopup": "menu" as const,
    className: cn(
      "flex size-5 shrink-0 items-center justify-center rounded-sm hover:bg-hover [&_svg]:size-3.5",
      shown === "shown" && "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
    ),
    // The row selects on a click: the eye only opens its menu.
    onDoubleClick: (event: MouseEvent) => event.stopPropagation(),
  };
  // A plain button until it's opened: a long page's every row holding a menu costs its opening
  // (the start screen's CPU budget for a new site, #923's CI). Its tooltip says how the layer shows
  // and what a click does, in place of the browser's `title` (F24, #1180).
  if (!open) {
    return (
      <WithTooltip tooltip={label} disableable>
        <button
          {...eye}
          onClick={(event) => {
            event.stopPropagation();
            setOpen(true);
          }}
        >
          <current.Icon />
        </button>
      </WithTooltip>
    );
  }
  return (
    <DropdownMenu
      open
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onClosed();
      }}
    >
      <DropdownMenuTrigger {...eye} onClick={(event) => event.stopPropagation()}>
        <current.Icon />
      </DropdownMenuTrigger>
      {/* Its events reach the row through the portal: the row neither selects nor moves on them. */}
      <DropdownMenuContent
        align="end"
        // Its button is gone once it closes: onClosed puts the focus on the row instead.
        onCloseAutoFocus={(event) => event.preventDefault()}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <DropdownMenuRadioGroup
          value={shown}
          onValueChange={(value) => {
            const choice = SHOWN_CHOICES.find((each) => each.shown === value);
            if (choice !== undefined) onShown(choice.shown);
          }}
        >
          {SHOWN_CHOICES.map((choice) => (
            <DropdownMenuRadioItem
              key={choice.shown}
              value={choice.shown}
              disabled={choice.shown === "editorHidden" && !canHideWhileEditing}
            >
              <choice.Icon aria-hidden className="size-3.5" />
              {t(choice.label)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
