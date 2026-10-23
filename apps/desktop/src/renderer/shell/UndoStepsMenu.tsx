import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@webforge/editor-ui";
import type { HistoryState, ReadonlyStore } from "@webforge/history";
import { t } from "@webforge/i18n";
import { ChevronDownIcon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { useCommand } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";

/** How many of the latest steps the menu lists; the Undo History panel lists them all. */
const UNDO_STEPS_SHOWN = 10;

/** Props of {@link UndoStepsMenu}. */
export type UndoStepsMenuProps = {
  /** The site's history state: its steps and how many are applied. */
  readonly state: ReadonlyStore<HistoryState<unknown>>;
  /**
   * Undoes the step `entryId` and every later one, as one jump; the open site's, once its editor
   * is there (off until then).
   */
  readonly undoTo: ((entryId: string) => boolean) | undefined;
};

/**
 * The arrow beside the title bar's Undo (UX-16): the latest steps that can be undone, newest
 * first. Choosing one undoes it and every later one in one jump, as Undo History does, so nothing
 * is recorded and Redo brings them back. Off whenever Undo is.
 */
export function UndoStepsMenu({ state: store, undoTo }: UndoStepsMenuProps) {
  const undo = useCommand(COMMAND_IDS.undo);
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  // The step the pointer or focus is on: it and every later one are undone together.
  const [focused, setFocused] = useState<number | null>(null);
  const steps = state.entries.slice(0, state.cursor).toReversed().slice(0, UNDO_STEPS_SHOWN);
  const disabled =
    undoTo === undefined || undo === undefined || undo.enabled === false || steps.length === 0;

  return (
    <DropdownMenu
      modal={false}
      onOpenChange={(open) => {
        if (!open) setFocused(null);
      }}
    >
      <Tooltip>
        {/* A disabled button gets no pointer events, so the tooltip hangs on a wrapper. */}
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="-ml-0.5 w-4 [&:disabled_svg]:text-disabled [&_svg]:size-3"
                disabled={disabled}
                aria-label={t("shell.undoSteps")}
              >
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
          </span>
        </TooltipTrigger>
        <TooltipContent>{t("shell.undoSteps")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>{t("shell.undoSteps.title")}</DropdownMenuLabel>
        {steps.map((entry, index) => (
          <DropdownMenuItem
            key={entry.id}
            // Everything above the step in focus goes with it.
            className={cn(focused !== null && index < focused && "bg-hover")}
            onFocus={() => setFocused(index)}
            onSelect={() => undoTo?.(entry.id)}
          >
            <span className="truncate">{entry.label}</span>
            <span className="sr-only">
              ,{" "}
              {index === 0
                ? t("shell.undoSteps.one")
                : t("shell.undoSteps.many", { count: index + 1 })}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <p aria-hidden className="m-0 px-2 py-1 text-xs text-muted-foreground">
          {focused === null
            ? t("shell.undoSteps.hint")
            : focused === 0
              ? t("shell.undoSteps.one")
              : t("shell.undoSteps.many", { count: focused + 1 })}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
