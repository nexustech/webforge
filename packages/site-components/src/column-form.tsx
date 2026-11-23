import {
  cloneElement,
  createContext,
  isValidElement,
  type ReactElement,
  type ReactNode,
  use,
} from "react";

/**
 * Whether what's drawn is in a column of the Footer (HF-4, 5.39): a section that fits a column
 * (Contact details, Newsletter signup) draws its column form there, without its section's frame.
 */
export const FooterColumnContext = createContext(false);

/** `element` with `added` props it doesn't set itself, and `added`'s classes after its own. */
function withRootProps(element: ReactElement, added: Readonly<Record<string, unknown>>) {
  const own = element.props as Readonly<Record<string, unknown>>;
  const { className, ...rest } = added;
  const classes =
    typeof className === "string" && className !== ""
      ? {
          className:
            typeof own.className === "string" && own.className !== ""
              ? `${own.className} ${className}`
              : className,
        }
      : {};
  return cloneElement(element, {
    ...Object.fromEntries(Object.entries(rest).filter(([name]) => own[name] === undefined)),
    ...classes,
  } as Record<string, unknown>);
}

/**
 * A section's frame, or its column form in a Footer column (5.39): which one, React's context
 * says, so a section placed in a column needs no field of its own to say so. What's set on it, as
 * on a root element (its anchor, Advanced classes and attributes, the canvas's marks), goes on the
 * root of the one it draws: see {@link hasElementRoot}.
 */
export function FramedOrColumn({
  framed,
  column,
  ...root
}: {
  readonly framed: ReactNode;
  readonly column: ReactNode;
  readonly [name: string]: unknown;
}) {
  const drawn = use(FooterColumnContext) ? column : framed;
  return isValidElement(drawn) ? withRootProps(drawn, root) : drawn;
}

/**
 * Whether `output`'s root takes an element's props: an HTML element, or a section's
 * {@link FramedOrColumn}, which passes them to the element it draws. Code that sets an anchor, a
 * class or an attribute on a component's root checks this rather than for an HTML element alone.
 */
export function hasElementRoot(output: ReactNode): output is ReactElement {
  return (
    isValidElement(output) && (typeof output.type === "string" || output.type === FramedOrColumn)
  );
}
