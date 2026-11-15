import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip.js";

/**
 * Button styles (UI1: small corners; a standard button 24.5 px high at the editor's 14 px rem,
 * #1015). Disabled, a button of any variant has muted text and icons, a colour-coded icon too; one
 * with a fill has a muted fill as well, not its own colour behind grey text (#1010).
 */
export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:text-disabled [&:disabled_svg]:text-disabled aria-invalid:ring-2 aria-invalid:ring-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover disabled:bg-muted",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:bg-muted",
        outline: "border border-border bg-transparent hover:bg-hover",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:bg-muted",
        ghost: "hover:bg-hover",
        link: "text-info underline-offset-4 hover:underline",
      },
      size: {
        default: "h-7 px-2.5",
        sm: "h-6 px-2 text-xs",
        icon: "size-7",
        "icon-sm": "size-6",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

/** Props of {@link Button}. `asChild` renders the child element with the button's styles. */
export type ButtonProps = Omit<ComponentProps<"button">, "title"> &
  VariantProps<typeof buttonVariants> & {
    readonly asChild?: boolean;
    /**
     * What the button does, shown on hover and on keyboard focus, disabled or not (#1011). The
     * browser's `title` is slow, unstyled and never shown on focus, so a button has none. It
     * doesn't name the button: an icon-only one still needs its `aria-label`.
     */
    readonly tooltip?: ReactNode;
  };

/** A button. Defaults to `type="button"` so it never submits a form by accident. */
export function Button({
  className,
  variant,
  size,
  asChild = false,
  type = "button",
  tooltip,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  const button = (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...(asChild ? {} : { type })}
      {...props}
    />
  );
  if (tooltip === undefined) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A disabled button gets no pointer events, so its tooltip hangs on a wrapper. */}
        {props.disabled === true ? <span className="inline-flex">{button}</span> : button}
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
