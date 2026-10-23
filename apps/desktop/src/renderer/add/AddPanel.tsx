import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  fieldControlClass,
  ScrollArea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { SharedSectionId } from "@webforge/model";
import { EllipsisIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMenuDialog } from "../shell/use-menu-dialog.js";
import { type AddItem, type AddTab, groupItems } from "./add-items.js";

/** What the "…" menu of a shared section offers (1.29): each opens a dialog. */
export type SharedSectionActions = {
  /** Asks for a new name for shared section `id`. */
  readonly rename: (id: SharedSectionId) => void;
  /** Deletes shared section `id`, asking first when pages have copies of it (D7). */
  readonly remove: (id: SharedSectionId) => void;
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
};

/**
 * One component to add: a click (or Enter) adds it, and it can be dragged onto the canvas. A shared
 * section is added by a click, as a linked copy.
 */
function AddButton({
  item,
  disabled,
  onAdd,
  dragSource,
  withMenu,
}: {
  readonly item: AddItem;
  readonly disabled: boolean;
  readonly onAdd: (type: string) => void;
  readonly dragSource: AddPanelProps["dragSource"];
  /** Leaves room for the item's "…" menu. */
  readonly withMenu: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = ref.current;
    // A shared section is placed by a click only: the canvas drags in components, not copies.
    if (
      element === null ||
      dragSource === undefined ||
      disabled ||
      item.sharedSectionId !== undefined
    ) {
      return;
    }
    return dragSource(element, item.type);
  }, [dragSource, item.type, item.sharedSectionId, disabled]);
  return (
    <Button
      ref={ref}
      type="button"
      size="sm"
      variant="outline"
      // Relative: the canvas's drag handle covers the button.
      className={withMenu ? "relative w-full justify-start pr-8" : "relative w-full justify-start"}
      disabled={disabled}
      onClick={() => onAdd(item.type)}
    >
      <PlusIcon aria-hidden />
      {item.label}
    </Button>
  );
}

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
}: AddPanelProps) {
  const [query, setQuery] = useState("");
  // A shared section's dialog opens once its menu has closed, so focus stays in the dialog.
  const menuDialog = useMenuDialog(
    (next: { readonly kind: keyof SharedSectionActions; readonly id: SharedSectionId }) =>
      sharedActions?.[next.kind](next.id),
  );

  const list = (items: readonly AddItem[], hint: string) => {
    const groups = groupItems(items, query);
    return (
      <ScrollArea className="min-h-0 flex-1">
        <p className="m-0 px-2 pb-1 text-xs text-muted-foreground">{hint}</p>
        {groups.length === 0 ? (
          <p className="m-0 px-2 text-xs text-muted-foreground">
            {t("add.noMatch", { query: query.trim() })}
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.category} className="px-2 pb-2">
              <h3 className="m-0 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {group.category || t("add.other")}
              </h3>
              <ul
                aria-label={group.category || t("add.other")}
                className="m-0 grid list-none gap-1 p-0"
              >
                {group.items.map((item) => {
                  const shared = sharedActions === undefined ? undefined : item.sharedSectionId;
                  return (
                    <li key={item.type} className="group relative">
                      <AddButton
                        item={item}
                        disabled={!canAdd(item.type)}
                        onAdd={onAdd}
                        dragSource={dragSource}
                        withMenu={shared !== undefined}
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
            </div>
          ))
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
        <TabsTrigger value="sections" className="normal-case tracking-normal">
          {t("add.sections")}
        </TabsTrigger>
        <TabsTrigger value="elements" className="normal-case tracking-normal">
          {t("add.elements")}
        </TabsTrigger>
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
        {list(sections, t("add.sectionsHint"))}
      </TabsContent>
      <TabsContent value="elements" className="flex flex-col">
        {list(elements, elementsHint)}
      </TabsContent>
    </Tabs>
  );
}
