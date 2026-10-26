import { type KeyboardEvent, useId, useRef, useState } from "react";
import { cn } from "../../lib/cn.js";
import { fieldControlClass } from "./text-field.js";

/** The word under the caret in a list of classes: where it starts and ends, and what it is. */
export type WordAt = { readonly start: number; readonly end: number; readonly word: string };

/** The class `caret` is in or just after, in `text`: the run of non-space characters there. */
export function wordAt(text: string, caret: number): WordAt {
  let start = caret;
  while (start > 0 && !/\s/.test(text.charAt(start - 1))) start -= 1;
  let end = caret;
  while (end < text.length && !/\s/.test(text.charAt(end))) end += 1;
  return { start, end, word: text.slice(start, end) };
}

/**
 * `text` with the word at `at` replaced by `replacement`, and a space after it unless one is there
 * already, and where the caret goes: after that space, ready for the next class. A variant
 * (`hover:`) gets no space: its class follows it.
 */
export function replaceWord(
  text: string,
  at: WordAt,
  replacement: string,
): { readonly text: string; readonly caret: number } {
  const after = text.slice(at.end);
  const before = `${text.slice(0, at.start)}${replacement}`;
  if (replacement.endsWith(":")) return { text: `${before}${after}`, caret: before.length };
  const spaced = after.startsWith(" ") ? after : ` ${after}`;
  return { text: `${before}${spaced}`, caret: before.length + 1 };
}

/** Props of {@link ClassesInput}. */
export type ClassesInputProps = {
  readonly id: string;
  readonly value: string;
  /** What's typed, at every keystroke, a suggestion taken included. */
  readonly onValueChange: (value: string) => void;
  /** The person is done: the field lost focus, or Enter with no suggestion chosen. */
  readonly onDone: () => void;
  /** Esc with no suggestions open: back to the value the field had. */
  readonly onRevert: () => void;
  /** The suggestions for the word under the caret, best first; none for an empty word. */
  readonly suggest: (word: string) => readonly string[];
  /** The suggestions' list's name, for assistive technology ("Suggested classes"). */
  readonly listLabel: string;
  readonly placeholder?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly invalid?: boolean | undefined;
  readonly describedBy?: string | undefined;
};

/**
 * A text box of CSS classes with suggestions (#276): an APG combobox (`role="combobox"`, a list of
 * options it points at with `aria-activedescendant`). The class under the caret is looked up as it's
 * typed; Up and Down move through the suggestions, Enter or Tab puts the one chosen in place of the
 * word, and Esc closes them. With none showing, Enter is done and Esc goes back.
 */
export function ClassesInput({
  id,
  value,
  onValueChange,
  onDone,
  onRevert,
  suggest,
  listLabel,
  placeholder,
  disabled = false,
  invalid = false,
  describedBy,
}: ClassesInputProps) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  // The word looked up and its suggestions, until the person moves on or takes one.
  const [open, setOpen] = useState<{ readonly at: WordAt; readonly options: readonly string[] }>();
  const [active, setActive] = useState(0);

  /** Looks up the word at the caret in `text`, showing its suggestions if it has any. */
  const lookUp = (text: string, caret: number) => {
    const at = wordAt(text, caret);
    const options = at.word === "" ? [] : suggest(at.word);
    setOpen(options.length === 0 ? undefined : { at, options });
    setActive(0);
  };

  /** Puts `option` in place of the word looked up. */
  const take = (option: string) => {
    if (open === undefined) return;
    const next = replaceWord(value, open.at, option);
    onValueChange(next.text);
    setOpen(undefined);
    // After React has the new value: the caret after the class taken.
    requestAnimationFrame(() => input.current?.setSelectionRange(next.caret, next.caret));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (open !== undefined) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((active + step + open.options.length) % open.options.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const option = open.options[active];
        if (option !== undefined) {
          event.preventDefault();
          take(option);
        }
        return;
      }
      if (event.key === "Escape") {
        // Closes the suggestions only: the panel keeps the key from going further.
        event.preventDefault();
        event.stopPropagation();
        setOpen(undefined);
        return;
      }
    }
    if (event.key === "Enter") onDone();
    if (event.key === "Escape") onRevert();
  };

  const optionId = (index: number) => `${listId}-${index}`;
  return (
    <div className="relative">
      <input
        ref={input}
        id={id}
        role="combobox"
        aria-expanded={open !== undefined}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open === undefined ? undefined : optionId(active)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={fieldControlClass}
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        disabled={disabled}
        onChange={(event) => {
          onValueChange(event.currentTarget.value);
          lookUp(event.currentTarget.value, event.currentTarget.selectionStart ?? 0);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setOpen(undefined);
          onDone();
        }}
      />
      <div
        id={listId}
        role="listbox"
        aria-label={listLabel}
        hidden={open === undefined}
        className="absolute inset-x-0 top-full z-50 mt-0.5 max-h-56 overflow-y-auto rounded-sm border border-border-strong bg-popover p-0.5 shadow-md"
      >
        {open?.options.map((option, index) => (
          <div
            key={option}
            id={optionId(index)}
            role="option"
            aria-selected={index === active}
            // Pointed at from the field (`aria-activedescendant`), never focused itself.
            tabIndex={-1}
            className={cn(
              "cursor-default truncate rounded-sm px-1.5 py-0.5 font-mono text-xs text-popover-foreground",
              index === active && "bg-accent text-accent-foreground",
            )}
            // Taken without the field losing focus first.
            onMouseDown={(event) => {
              event.preventDefault();
              take(option);
            }}
            onMouseEnter={() => setActive(index)}
          >
            {option}
          </div>
        ))}
      </div>
    </div>
  );
}
