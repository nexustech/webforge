import { Tooltip as TooltipPrimitive } from "radix-ui";
import {
  type ComponentProps,
  cloneElement,
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn.js";

/** Whether a {@link TooltipProvider} is above: the app's, a story's or a test's. */
const Provided = createContext(false);

/** Shares tooltip timing across the app; wrap the app once. */
export function TooltipProvider({
  delayDuration = 400,
  children,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} {...props}>
      <Provided value>{children}</Provided>
    </TooltipPrimitive.Provider>
  );
}

/**
 * A tooltip: a {@link TooltipTrigger} and its {@link TooltipContent}. It shares the app's
 * {@link TooltipProvider}, so moving along a toolbar shows each tooltip at once after the first; a
 * panel rendered on its own (a test's) gets one of its own (#1011).
 */
export function Tooltip(props: ComponentProps<typeof TooltipPrimitive.Root>) {
  const root = <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
  return useContext(Provided) ? root : <TooltipProvider>{root}</TooltipProvider>;
}

/**
 * Whether `element` has the focus the keyboard gave it (`:focus-visible`), not a click's or the
 * focus a dialog gives back after a click.
 */
function focusVisible(element: Element): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    // A DOM without the selector (a test's): as a keyboard's.
    return true;
  }
}

/**
 * The element the tooltip describes; use `asChild` around a button. Focus opens the tooltip only
 * when it's the keyboard's (5.5): a dialog closed with the mouse gives its button the focus back,
 * and a tooltip shown then would sit over whatever is clicked next.
 */
export function TooltipTrigger({
  onFocus,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      {...props}
      onFocus={(event) => {
        onFocus?.(event);
        // Radix opens the tooltip on focus unless the event's default is prevented. The element
        // focused, not the trigger: a wrapper's trigger hears its button's focus.
        if (event.target instanceof Element && !focusVisible(event.target)) {
          event.preventDefault();
        }
      }}
    />
  );
}

/** Whether `element`'s text, or text in it cut short with an ellipsis (`truncate`), doesn't fit. */
function cut(element: Element | null): boolean {
  if (element === null) return false;
  return [element, ...element.querySelectorAll(".truncate")].some(
    (each) => each.scrollWidth > each.clientWidth,
  );
}

/**
 * A tooltip's root, whether it's open, and the ref for its trigger. With `whenCut` it opens only
 * while the trigger's text is cut short: a label whose tooltip shows the whole of it.
 */
export function useTooltipRoot(whenCut: boolean) {
  // The element under the trigger, whatever it is: Radix types it as a button.
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const root: ComponentProps<typeof Tooltip> = {
    open,
    onOpenChange: (next) => setOpen(next && (!whenCut || cut(trigger.current))),
  };
  return { trigger, root, open };
}

/**
 * `children`, one element, with a tooltip: on pointing at it, and on the keyboard's focus when it
 * takes focus. In place of the browser's `title`, which is slow, unstyled and never shown on focus
 * (#1011); it names nothing, so an icon still needs its `aria-label`.
 *
 * - `disableable`: the element is a control that can be disabled. A disabled one gets no pointer
 *   events, so the tooltip hangs on a wrapper, enabled or not: a wrapper that came and went would
 *   remount the control, closing a menu it had open. Radix describes the wrapper by the tooltip, so
 *   the control gets the description itself while it's open, as a control under the trigger would.
 * - `whenCut`: only while its text is cut short, to show the whole of it.
 *
 * Not for an element that sets `data-state` itself (a toggle or a tab): the tooltip's would
 * replace it. `ToggleGroupItem` takes a `tooltip` of its own.
 */
export function WithTooltip({
  tooltip,
  disableable = false,
  whenCut = false,
  children,
}: {
  readonly tooltip: ReactNode;
  readonly disableable?: boolean;
  readonly whenCut?: boolean;
  readonly children: ReactElement<{ "aria-describedby"?: string }>;
}) {
  const { trigger, root, open } = useTooltipRoot(whenCut);
  const description = useId();
  if (!disableable) {
    return (
      <Tooltip {...root}>
        <TooltipTrigger asChild ref={trigger}>
          {children}
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    );
  }
  const describedBy = [children.props["aria-describedby"], open ? description : undefined]
    .filter((each) => each !== undefined)
    .join(" ");
  return (
    <Tooltip {...root}>
      <TooltipTrigger asChild ref={trigger}>
        <span className="inline-flex">
          {cloneElement(children, {
            "aria-describedby": describedBy === "" ? undefined : describedBy,
          })}
          {open && (
            // A description is read from a hidden element too, and this one isn't read twice.
            <span id={description} hidden>
              {tooltip}
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

/** The tooltip's text. */
export function TooltipContent({
  className,
  sideOffset = 4,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 rounded-sm border border-border-strong bg-popover px-2 py-1 text-xs",
          "text-popover-foreground shadow-md animate-in fade-in-0",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}
