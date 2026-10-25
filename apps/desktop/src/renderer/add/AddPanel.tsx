import {
  Button,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  fieldControlClass,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  ScrollArea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useMenuDialog,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { SharedSectionId } from "@webforge/model";
import {
  BookmarkIcon,
  BoxIcon,
  ChevronRightIcon,
  EllipsisIcon,
  Link2Icon,
  PanelTopIcon,
  SearchIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { type AddItem, type AddTab, groupItems } from "./add-items.js";

/** What the "…" menu of a shared section offers (1.29): each opens a dialog. */
export type SharedSectionActions = {
  /** Asks for a new name for shared section `id`. */
  readonly rename: (id: SharedSectionId) => void;
  /** Deletes shared section `id`, asking first when pages have copies of it (D7). */
  readonly remove: (id: SharedSectionId) => void;
};

/** Which tab's items a list shows: each kind of item has its icon (LF-6). */
type ItemKind = "section" | "element";

/** An item's icon (LF-6): a shared section's link, a preset's mark, else its kind's. */
function iconOf(item: AddItem, kind: ItemKind) {
  if (item.sharedSectionId !== undefined) return Link2Icon;
  if (item.preset === true) return BookmarkIcon;
  return kind === "section" ? PanelTopIcon : BoxIcon;
}

/** The person's favourites (1.34): which items are, and switching one on or off. */
type AddFavourites = {
  readonly has: (type: string) => boolean;
  readonly toggle: (type: string) => void;
};

/** Props of {@link AddPanel}. */
export type AddPanelProps = {
  readonly sections: readonly AddItem[];
  readonly elements: readonly AddItem[];
  readonly tab: AddTab;
  readonly onTabChange: (tab: AddTab) => void;
  /** Adds a component of `type` to the page, where a click adds it. */
  readonly onAdd: (type: string) => void;
  /** Whether a click on `type` has somewhere to add it. */
  readonly canAdd: (type: string) => boolean;
  /**
   * Set while the canvas's + waits for a section to add at its place: after the named section, or
   * at the top of the page (`null`).
   */
  readonly point: { readonly after: string | null } | null;
  readonly onCancelPoint: () => void;
  /**
   * Makes an item's element drag a new `type` onto the canvas, until the returned call (the canvas
   * engine's `addDragSource`); left out while there is no canvas.
   */
  readonly dragSource?: ((element: HTMLElement, type: string) => () => void) | undefined;
  /** Rename and Delete for the shared sections listed (1.29); no menu when left out. */
  readonly sharedActions?: SharedSectionActions | undefined;
  /** Add to Favourites and Remove from Favourites on each item (1.34); no menu when left out. */
  readonly favourites?: AddFavourites | undefined;
  /** A larger preview of an item, shown on hover or focus (UX-10); none when it gives none. */
  readonly preview?: ((item: AddItem) => ReactNode) | undefined;
};

/**
 * One component to add: a click (or Enter) adds it, and it can be dragged onto the canvas. A shared
 * section is added by a click, as a linked copy.
 */
function AddButton({
  item,
  kind,
  disabled,
  onAdd,
  dragSource,
  withMenu,
  favourites,
  preview,
}: {
  readonly item: AddItem;
  readonly kind: ItemKind;
  readonly disabled: boolean;
  readonly onAdd: (type: string) => void;
  readonly dragSource: AddPanelProps["dragSource"];
  /** Leaves room for the item's "…" menu. */
  readonly withMenu: boolean;
  readonly favourites: AddPanelProps["favourites"];
  readonly preview: AddPanelProps["preview"];
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = ref.current;
    // A shared section and a preset are placed by a click only: the canvas drags in components.
    if (
      element === null ||
      dragSource === undefined ||
      disabled ||
      item.sharedSectionId !== undefined ||
      item.preset === true
    ) {
      return;
    }
    return dragSource(element, item.type);
  }, [dragSource, item.type, item.sharedSectionId, item.preset, disabled]);
  const card = preview?.(item);
  const hasCard = card !== undefined && card !== null;
  // The preview card opens on hover from the pointer's own events: the canvas's drag handle
  // covers the button, and React doesn't report entering a button through it (the handle is
  // Puck's). Focus opens it as usual; pressing (to add or drag) closes it.
  const [cardOpen, setCardOpen] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (element === null || !hasCard) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = (open: boolean, delay: number) => (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      clearTimeout(timer);
      timer = setTimeout(() => setCardOpen(open), delay);
    };
    const listeners = [
      ["pointerenter", later(true, HOVER_CARD_OPEN_DELAY)],
      ["pointerleave", later(false, HOVER_CARD_CLOSE_DELAY)],
      ["pointerdown", later(false, 0)],
    ] as const;
    for (const [type, listener] of listeners) element.addEventListener(type, listener);
    return () => {
      clearTimeout(timer);
      for (const [type, listener] of listeners) element.removeEventListener(type, listener);
    };
  }, [hasCard]);
  // The triggers nest around the button itself: a menu or card's root renders nothing to pass
  // a trigger's handlers to.
  const Icon = iconOf(item, kind);
  let trigger: ReactNode = (
    // A plain row (LF-6): no outline, its kind's icon, the hover colour of a list.
    <Button
      ref={ref}
      type="button"
      size="sm"
      variant="ghost"
      // Relative: the canvas's drag handle covers the button.
      className={cn("relative h-6 w-full justify-start px-1.5 font-normal", withMenu && "pr-8")}
      disabled={disabled}
      onClick={() => onAdd(item.type)}
    >
      <Icon aria-hidden className="text-muted-foreground" />
      {item.label}
    </Button>
  );
  // A suggested item is offered only under Suggested, so it can't be a favourite.
  const canFavour = favourites !== undefined && item.suggested !== true;
  if (canFavour) {
    trigger = <ContextMenuTrigger asChild>{trigger}</ContextMenuTrigger>;
  }
  if (hasCard) {
    trigger = (
      <HoverCard
        open={cardOpen}
        onOpenChange={setCardOpen}
        openDelay={HOVER_CARD_OPEN_DELAY}
        closeDelay={HOVER_CARD_CLOSE_DELAY}
      >
        <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
        <HoverCardContent>{card}</HoverCardContent>
      </HoverCard>
    );
  }
  if (favourites === undefined || !canFavour) return trigger;
  const favourite = favourites.has(item.type);
  // Right-click, or the keyboard's context-menu key (Shift+F10) on the focused item.
  return (
    <ContextMenu modal={false}>
      {trigger}
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => favourites.toggle(item.type)}>
          {t(favourite ? "add.favourite.remove" : "add.favourite.add")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** How long the pointer rests on an item before its preview shows, and leaves before it goes. */
const HOVER_CARD_OPEN_DELAY = 400;
const HOVER_CARD_CLOSE_DELAY = 100;

/**
 * The "…" menu of a shared section in the list (1.29), shown on hover or focus, as the Pages panel
 * shows a page's: Rename… and Delete…, each opening its dialog once the menu has closed.
 */
function SharedSectionMenu({
  item,
  onRename,
  onDelete,
  onCloseAutoFocus,
}: {
  readonly item: AddItem;
  readonly onRename: () => void;
  readonly onDelete: () => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}) {
  return (
    // Not modal, as the Pages panel's: a modal menu hides the window from screen readers.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("add.sharedActions", { name: item.label })}
          className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
        >
          <EllipsisIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onCloseAutoFocus={onCloseAutoFocus}>
        <DropdownMenuItem onSelect={onRename}>{t("add.sharedRename")}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          {t("add.sharedDelete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The Add panel (F-ED-1, UI1): Sections | Elements, a search box, and each tab's components in
 * categories. A click (or Enter) adds one where it fits: a section after the selected one, or where
 * the canvas's + was clicked; an element into the selected section. Or drag one onto the canvas,
 * where its drop indicators show where it may go. The site's shared sections come first under
 * Sections, each placed as a linked copy (F-ED-23), with a "…" menu to rename or delete it.
 * Header, Footer and child-only components are never offered (ADR 0005). Hidden in Content mode.
 */
export function AddPanel({
  sections,
  elements,
  tab,
  onTabChange,
  onAdd,
  canAdd,
  point,
  onCancelPoint,
  dragSource,
  sharedActions,
  favourites,
  preview,
}: AddPanelProps) {
  const [query, setQuery] = useState("");
  // The categories the person closed, by tab and name (LF-6); a search shows them all open.
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set());
  const searching = query.trim() !== "";
  // A shared section's dialog opens once its menu has closed, so focus stays in the dialog.
  const menuDialog = useMenuDialog(
    (next: { readonly kind: keyof SharedSectionActions; readonly id: SharedSectionId }) =>
      sharedActions?.[next.kind](next.id),
  );

  const list = (items: readonly AddItem[], kind: ItemKind, hint: string) => {
    const groups = groupItems(items, query);
    return (
      <ScrollArea className="min-h-0 flex-1">
        <p className="m-0 px-2 pb-1 text-xs text-muted-foreground">{hint}</p>
        {groups.length === 0 ? (
          <p className="m-0 px-2 text-xs text-muted-foreground">
            {t("add.noMatch", { query: query.trim() })}
          </p>
        ) : (
          groups.map((group) => {
            const name = group.category || t("add.other");
            const key = `${kind}:${name}`;
            return (
              // A category the person can close (LF-6), with its triangle; a search opens all.
              <details
                key={group.category}
                open={searching || !closed.has(key)}
                className="group/category px-2 pb-1"
              >
                <summary
                  // The panel keeps which are open, not the page: a click toggles that, and the
                  // <details> follows. A search shows every category, so a click there does
                  // nothing (#421 review). On the way down, so the toggle is cancelled before
                  // anything on the way up could act on it.
                  onClickCapture={(event) => {
                    event.preventDefault();
                    if (searching) return;
                    setClosed((current) => {
                      const next = new Set(current);
                      if (!next.delete(key)) next.add(key);
                      return next;
                    });
                  }}
                  className="flex cursor-default list-none items-center gap-1 rounded-sm py-1 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
                >
                  <ChevronRightIcon
                    aria-hidden
                    className="size-3 shrink-0 transition-transform group-open/category:rotate-90"
                  />
                  {name}
                </summary>
                <ul aria-label={name} className="m-0 grid list-none gap-px p-0 pb-1">
                  {group.items.map((item) => {
                    const shared = sharedActions === undefined ? undefined : item.sharedSectionId;
                    return (
                      <li key={item.type} className="group relative">
                        <AddButton
                          item={item}
                          kind={kind}
                          disabled={!canAdd(item.type)}
                          onAdd={onAdd}
                          dragSource={dragSource}
                          withMenu={shared !== undefined}
                          favourites={favourites}
                          preview={preview}
                        />
                        {shared !== undefined && (
                          <SharedSectionMenu
                            item={item}
                            onRename={() => menuDialog.choose({ kind: "rename", id: shared })}
                            onDelete={() => menuDialog.choose({ kind: "remove", id: shared })}
                            onCloseAutoFocus={menuDialog.onCloseAutoFocus}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </details>
            );
          })
        )}
      </ScrollArea>
    );
  };

  const elementsHint = elements.some((item) => canAdd(item.type))
    ? t("add.elementsHint")
    : t("add.noSection");

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => onTabChange(value === "elements" ? "elements" : "sections")}
      className="h-full min-h-0"
    >
      <TabsList aria-label={t("add.kinds")}>
        <TabsTrigger value="sections">{t("add.sections")}</TabsTrigger>
        <TabsTrigger value="elements">{t("add.elements")}</TabsTrigger>
      </TabsList>
      <div className="relative px-2 py-1.5">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          aria-label={t("add.search")}
          placeholder={t("add.searchPlaceholder")}
          className={`${fieldControlClass} pl-7`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <TabsContent value="sections" className="flex flex-col">
        {point !== null && (
          <div role="status" className="mx-2 mb-2 flex items-center gap-2 rounded-sm bg-tabs p-2">
            <p className="m-0 flex-1 text-xs">
              {point.after === null
                ? t("add.point.start")
                : t("add.point.after", { item: point.after })}
            </p>
            <Button type="button" size="sm" variant="ghost" onClick={onCancelPoint}>
              {t("add.point.cancel")}
            </Button>
          </div>
        )}
        {list(sections, "section", t("add.sectionsHint"))}
      </TabsContent>
      <TabsContent value="elements" className="flex flex-col">
        {list(elements, "element", elementsHint)}
      </TabsContent>
    </Tabs>
  );
}
