import { plural, t } from "@webforge/i18n";
import { SearchIcon } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { cn } from "../../lib/cn.js";
import { fieldControlClass } from "../edit/text-field.js";
import { Button } from "./button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog.js";
import { ScrollArea } from "./scroll-area.js";

/** Something a {@link Picker} offers: an image, an icon, a font. */
export type PickerItem = {
  /** Unique among the items. */
  readonly id: string;
  /** Its name: found by search, and what assistive technology reads for it. */
  readonly label: string;
  /** Its category, one of the picker's `categories`. */
  readonly category?: string;
  /** More words it is found by (an image's alt text, an icon's synonyms). */
  readonly keywords?: readonly string[];
};

/** Props of {@link Picker}. */
/**
 * A grid's columns, as whole class names so Tailwind finds them (R11): the picker has no inline
 * styles.
 */
const GRID_COLUMNS = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
} as const;

export type PickerProps<Item extends PickerItem> = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  /** What choosing does; read out with the title. */
  readonly description: string;
  readonly items: readonly Item[];
  /** Tabs that show one category each, after *All*; none when left out. */
  readonly categories?: readonly string[];
  /** Tiles in `columns` columns (images, icons), or one item per row (fonts). */
  readonly layout?: "grid" | "list";
  readonly columns?: keyof typeof GRID_COLUMNS;
  /** An item's tile, beside or above its name; the name itself is drawn by the picker. */
  readonly renderItem: (item: Item) => ReactNode;
  /** A larger look at the item the person is on (a font's sample text, a photo); none when left out. */
  readonly renderPreview?: (item: Item) => ReactNode;
  /** The current choice, which the picker starts on. */
  readonly value?: string | null;
  /** Called with the chosen item; the picker closes. */
  readonly onChoose: (item: Item) => void;
  /** Buttons at the start of the footer, such as *Add new…*. */
  readonly actions?: ReactNode;
  /** Shown when there are no items at all. */
  readonly emptyText: string;
};

/** Whether `item` matches every word of `words` in its name, category or keywords. */
const matches = (item: PickerItem, words: readonly string[]) => {
  const text = [item.label, item.category ?? "", ...(item.keywords ?? [])]
    .join(" ")
    .toLocaleLowerCase();
  return words.every((word) => text.includes(word));
};

/** A key that types a character, which the grid hands to the search field. */
const isTyping = (event: KeyboardEvent) =>
  event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

/**
 * The one picker dialog (UX-15) for images, icons and fonts: a search field, category tabs, the
 * items and a preview of the one the person is on. One keyboard behaviour for all of them:
 * - in the search field, typing filters, ↓ goes to the items, and Enter chooses the first match;
 * - among the items, the arrows, Home and End move, Enter chooses, and typing searches;
 * - a click picks an item, a double-click or *Choose* chooses it;
 * - Esc clears the search, then closes. Focus goes back to what opened the picker.
 */
export function Picker<Item extends PickerItem>({
  open,
  onOpenChange,
  title,
  description,
  items,
  categories,
  layout = "grid",
  columns = 4,
  renderItem,
  renderPreview,
  value,
  onChoose,
  actions,
  emptyText,
}: PickerProps<Item>) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(value ?? null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  // What had the focus when it opened, which gets it back.
  const opener = useRef<HTMLElement | null>(null);
  const listId = useId();

  // Each time it opens: no search, every category, on the current choice, scrolled into view.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCategory(null);
    setActiveId(value ?? null);
    if (value == null) return;
    // Once the dialog has drawn its items.
    const frame = requestAnimationFrame(() => {
      list.current
        ?.querySelector(`[data-picker-item="${CSS.escape(value)}"]`)
        ?.scrollIntoView?.({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, value]);
  /** A new search starts on its first match, which Enter chooses; an empty one on the choice. */
  const searchFor = (next: string) => {
    setQuery(next);
    setActiveId(next.trim() === "" ? (value ?? null) : null);
  };

  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const shown = items.filter(
    (item) => (category === null || item.category === category) && matches(item, words),
  );
  const active = shown.find((item) => item.id === activeId) ?? shown[0];
  const step = layout === "grid" ? columns : 1;

  const choose = (item: Item | undefined) => {
    if (item === undefined) return;
    onChoose(item);
    onOpenChange(false);
  };
  /** Makes `item` the one the person is on, and gives it the focus. */
  const moveTo = (item: Item | undefined) => {
    if (item === undefined) return;
    setActiveId(item.id);
    list.current
      ?.querySelector<HTMLElement>(`[data-picker-item="${CSS.escape(item.id)}"]`)
      ?.focus();
  };

  const onItemKeyDown = (event: KeyboardEvent) => {
    const at = active === undefined ? -1 : shown.indexOf(active);
    // A list moves up and down only; a grid also along its rows.
    const moves: Readonly<Record<string, number>> =
      layout === "grid"
        ? { ArrowRight: 1, ArrowLeft: -1, ArrowDown: step, ArrowUp: -step }
        : { ArrowDown: 1, ArrowUp: -1 };
    const move = moves[event.key];
    if (move !== undefined) {
      event.preventDefault();
      const next = at + move;
      // Up from the first row goes back to the search field.
      if (next < 0 && event.key === "ArrowUp") search.current?.focus();
      else moveTo(shown[Math.min(Math.max(next, 0), shown.length - 1)]);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      moveTo(event.key === "Home" ? shown[0] : shown.at(-1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(active);
    } else if (isTyping(event)) {
      // The search field takes the character, as it gets the focus before the key is typed.
      search.current?.focus();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[min(36rem,calc(100vh-4rem))] flex-col gap-2 sm:max-w-3xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          opener.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
          search.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          // Back to what opened it, such as the field's button.
          event.preventDefault();
          opener.current?.focus();
        }}
        onEscapeKeyDown={(event) => {
          // Esc clears the search first, then closes.
          if (query !== "") {
            event.preventDefault();
            searchFor("");
            search.current?.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={search}
            type="search"
            aria-label={t("ui.picker.search")}
            aria-controls={listId}
            placeholder={t("ui.picker.search")}
            className={cn(fieldControlClass, "h-8 w-full pl-8")}
            value={query}
            onChange={(event) => searchFor(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                moveTo(active);
              } else if (event.key === "Enter") {
                event.preventDefault();
                choose(active);
              }
            }}
          />
        </div>
        {categories === undefined || categories.length === 0 ? null : (
          // Toggle buttons rather than tabs: each filters the one list below.
          // biome-ignore lint/a11y/useSemanticElements: a row of filter buttons, not a form group.
          <div role="group" aria-label={t("ui.picker.categories")} className="flex flex-wrap gap-1">
            {[null, ...categories].map((each) => (
              <Button
                key={each ?? ""}
                type="button"
                size="sm"
                variant={category === each ? "secondary" : "ghost"}
                aria-pressed={category === each}
                onClick={() => setCategory(each)}
              >
                {each ?? t("ui.picker.all")}
              </Button>
            ))}
          </div>
        )}
        <div className="flex min-h-0 flex-1 gap-3">
          {/* How many match, read out as the person types; the list itself isn't. */}
          <p role="status" className="sr-only">
            {query.trim() === ""
              ? ""
              : shown.length === 0
                ? t("ui.picker.noMatch", { query: query.trim() })
                : plural("ui.picker.match", shown.length)}
          </p>
          <ScrollArea className="min-h-0 flex-1 rounded-md border border-border">
            {items.length === 0 || shown.length === 0 ? (
              <p className="m-0 p-4 text-center text-sm text-muted-foreground">
                {items.length === 0 ? emptyText : t("ui.picker.noMatch", { query: query.trim() })}
              </p>
            ) : null}
            <div
              ref={list}
              id={listId}
              role="listbox"
              aria-label={title}
              className={cn(
                "p-1.5",
                layout === "grid"
                  ? ["grid gap-1.5", GRID_COLUMNS[columns]]
                  : "flex flex-col gap-0.5",
                shown.length === 0 && "hidden",
              )}
            >
              {shown.map((item) => {
                const isActive = item.id === active?.id;
                return (
                  <div
                    key={item.id}
                    role="option"
                    data-picker-item={item.id}
                    aria-selected={isActive}
                    // The current choice, as "current" rather than selected.
                    aria-current={item.id === value ? "true" : undefined}
                    tabIndex={isActive ? 0 : -1}
                    title={item.label}
                    className={cn(
                      "flex min-w-0 cursor-default rounded-sm border border-transparent p-1 text-xs outline-none",
                      "hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring",
                      layout === "grid" ? "flex-col gap-1" : "items-center gap-2",
                      isActive && "border-ring bg-accent text-accent-foreground",
                    )}
                    onClick={() => setActiveId(item.id)}
                    onDoubleClick={() => choose(item)}
                    onKeyDown={onItemKeyDown}
                  >
                    {renderItem(item)}
                    <span className="truncate">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          {renderPreview === undefined || active === undefined ? null : (
            // Not announced: the item's own name is read as the person moves to it.
            <div className="hidden w-60 shrink-0 flex-col gap-2 sm:flex">
              {renderPreview(active)}
            </div>
          )}
        </div>
        <DialogFooter className="items-center">
          <div className="flex flex-1 flex-wrap gap-1.5">{actions}</div>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("ui.picker.cancel")}
          </Button>
          <Button type="button" disabled={active === undefined} onClick={() => choose(active)}>
            {t("ui.picker.choose")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
