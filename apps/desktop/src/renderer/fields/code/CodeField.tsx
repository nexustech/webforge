import { cn, type FieldRendererProps, fieldControlClass } from "@webforge/editor-ui";

/**
 * The Edit panel's code field (Custom Code's HTML, F-ED-15): a box of lines in a monospace font,
 * not spell-checked or corrected, kept as typed, its lines unwrapped so code keeps its shape.
 */
export function CodeField({
  id,
  labelId,
  helpId,
  disabled,
  value,
  onChange,
  onCommit,
}: FieldRendererProps<"code">) {
  return (
    <textarea
      id={id}
      aria-labelledby={labelId}
      aria-describedby={helpId}
      disabled={disabled}
      rows={10}
      wrap="off"
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      className={cn(fieldControlClass, "h-auto py-1.5 font-mono text-xs leading-relaxed")}
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onCommit}
    />
  );
}
