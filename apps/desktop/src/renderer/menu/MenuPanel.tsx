import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { MENU_LABEL_MAX, type MenuItem, type MenuItemId, type SiteDoc } from "@webforge/model";
import {
  ChevronDownIcon,
  EllipsisIcon,
  EyeOffIcon,
  FileIcon,
  HashIcon,
  Link2Icon,
  MousePointerClickIcon,
  PlusIcon,
} from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";
import { LinkDialog } from "../links/LinkDialog.js";
import type { LinkFieldChange } from "../links/link-change.js";
import type { PageTarget } from "../links/link-targets.js";
import { useMenuDialog } from "../shell/use-menu-dialog.js";
import { useRowDrag } from "../shell/use-row-drag.js";
import { NameDialog } from "../site/NameDialog.js";
import { itemLabel, type MenuPosition, type NewMenuItem } from "./menu-actions.js";

/** What the menu editor can do; the host binds them to the editor session. */
export type MenuPanelActions = {
  add(item: NewMenuItem): void;
  rename(id: MenuItemId, label: string): void;
  editLink(id: MenuItemId, label: string, change: LinkFieldChange): void;
  setHidden(id: MenuItemId, hidden: boolean): void;
  move(id: MenuItemId, to: MenuPosition): void;
  remove(id: MenuItemId): void;
  followPages(): void;
};

/** Props of {@link MenuPanel}. */
export type MenuPanelProps = {
  readonly site: SiteDoc;
  /**
   * The site as it is now, with where links can go (its pages and their sections), read when a
   * link dialog opens: `site` may predate sections added since.
   */
  readonly linkContext: () => { readonly site: SiteDoc; readonly targets: readonly PageTarget[] };
  readonly actions: MenuPanelActions;
};

/** A dropdown of the menu. */
type GroupItem = Extract<MenuItem, { kind: "group" }>;

/** One item as a row: the dropdown it is in (`null` for the menu itself) and its place there. */
type Row = {
  readonly item: MenuItem;
  readonly group: MenuItemId | null;
  readonly index: number;
  readonly siblings: number;
};

function rowsOf(items: readonly MenuItem[], group: MenuItemId | null = null): Row[] {
  return items.flatMap((item, index) => [
    { item, group, index, siblings: items.length },
    ...(item.kind === "group" ? rowsOf(item.children, item.id) : []),
  ]);
}

const ICONS = {
  page: FileIcon,
  link: Link2Icon,
  section: HashIcon,
  button: MousePointerClickIcon,
  group: ChevronDownIcon,
} as const;

/** The MIME type a dragged menu item travels as, so drops from elsewhere are ignored. */
const DRAG_TYPE = "application/x-webforge-menu-item";

/** What the dialogs are open for. */
type Dialog =
  | { readonly kind: "addLink" | "addButton" | "addGroup" }
  | { readonly kind: "edit"; readonly id: MenuItemId };

/**
 * The menu editor (F-ED-17, G2), in the Site panel: the navigation menu's items, built from the
 * pages until edited. Add links (to a page, a section, an address), buttons such as "Book now"
 * and dropdowns; rename, relink, hide and remove items; reorder them by drag or Alt+↑/↓, and move
 * them into and out of dropdowns. A click on an item edits it. Every change is one undo step.
 */
export function MenuPanel({ site, linkContext, actions }: MenuPanelProps) {
  const { menu } = site;
  const rows = rowsOf(menu.items);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  // Kept while a dialog closes, so its text doesn't change during the closing animation.
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const openDialog = (next: Dialog) => {
    setDialog(next);
    setOpen(true);
  };
  // Dialogs chosen from a menu open once it has closed, so their field keeps the focus.
  const menuDialog = useMenuDialog(openDialog);
  const close = () => setOpen(false);
  const editing =
    dialog?.kind === "edit" ? rows.find((row) => row.item.id === dialog.id)?.item : undefined;
  const groups = menu.items.filter((item): item is GroupItem => item.kind === "group");
  const linkOpen =
    open &&
    (dialog?.kind === "addLink" ||
      dialog?.kind === "addButton" ||
      (editing !== undefined && editing.kind !== "page" && editing.kind !== "group"));
  // Read once per opening, not on every keystroke in the dialog.
  const links = linkOpen && dialog !== null ? linkContext() : { site, targets: [] };

  const focusRow = (id: MenuItemId) =>
    listRef.current?.querySelector<HTMLElement>(`[data-menu-item="${CSS.escape(id)}"]`)?.focus();

  const onKeyDown = (event: KeyboardEvent, row: Row) => {
    const at = rows.indexOf(row);
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const step = event.key === "ArrowUp" ? -1 : 1;
      if (event.altKey) {
        actions.move(row.item.id, { group: row.group, index: row.index + step });
      } else {
        const next = rows[at + step];
        if (next !== undefined) focusRow(next.item.id);
      }
    } else if (event.key === "Delete") {
      event.preventDefault();
      actions.remove(row.item.id);
    } else if (event.key === "F2") {
      event.preventDefault();
      openDialog({ kind: "edit", id: row.item.id });
    }
  };

  const rowDrag = useRowDrag<Row>({
    type: DRAG_TYPE,
    keyOf: (row) => row.item.id,
    // Before or after a row, or into a dropdown from the middle of its row; nowhere else.
    place: (from, row, y) => {
      if (from.item.id === row.item.id) return null;
      if (row.item.kind === "group" && from.item.kind !== "group" && y > 0.25 && y < 0.75) {
        return "into";
      }
      // Dropdowns hold no dropdowns.
      if (from.item.kind === "group" && row.group !== null) return null;
      return y < 0.5 ? "before" : "after";
    },
    onDrop: (from, row, place) => {
      if (place === "into") {
        const group = row.item.kind === "group" ? row.item : undefined;
        actions.move(from.item.id, { group: row.item.id, index: group?.children.length ?? 0 });
        return;
      }
      const target = row.index + (place === "after" ? 1 : 0);
      // Counted once the item has left its place, when it moves down its own list.
      const index = from.group === row.group && from.index < target ? target - 1 : target;
      actions.move(from.item.id, { group: row.group, index });
    },
  });

  const itemRow = (row: Row) => {
    const { item } = row;
    const name = itemLabel(site, item);
    const Icon = ICONS[item.kind];
    const kind = t(`menu.kind.${item.kind}`);
    // A page hidden from navigation in its own Page Settings: shown so, and changed there.
    const pageHidden =
      item.kind === "page" && site.pages[item.pageId]?.settings.hideFromNavigation === true;
    const hidden = item.hidden || pageHidden;
    const group = row.group === null ? undefined : menu.items.find((i) => i.id === row.group);
    return (
      <li
        key={item.id}
        className={cn("group relative rounded-sm", rowDrag.indicatorClass(row))}
        {...rowDrag.rowProps(row)}
      >
        <button
          type="button"
          data-menu-item={item.id}
          aria-label={
            group === undefined
              ? t(pageHidden ? "menu.rowPageHidden" : item.hidden ? "menu.rowHidden" : "menu.row", {
                  name,
                  kind,
                })
              : t(
                  pageHidden
                    ? "menu.rowInGroupPageHidden"
                    : item.hidden
                      ? "menu.rowInGroupHidden"
                      : "menu.rowInGroup",
                  { name, kind, group: itemLabel(site, group) },
                )
          }
          className={cn(
            "flex h-6 w-full items-center gap-1.5 rounded-sm px-2 pr-8 text-left text-xs outline-none",
            "hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
            row.group !== null && "pl-6",
            hidden && "text-muted-foreground",
          )}
          onClick={() => openDialog({ kind: "edit", id: item.id })}
          onKeyDown={(event) => onKeyDown(event, row)}
        >
          <Icon aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{name}</span>
          {hidden && (
            <EyeOffIcon aria-hidden className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
          )}
        </button>
        <ItemMenu
          row={row}
          name={name}
          groups={groups}
          actions={actions}
          onEdit={() => menuDialog.choose({ kind: "edit", id: item.id })}
          onCloseAutoFocus={menuDialog.onCloseAutoFocus}
        />
      </li>
    );
  };

  return (
    <section aria-label={t("menu.title")} className="flex flex-col">
      <div className="flex h-7 shrink-0 items-center justify-between pr-1 pl-2">
        <h2 className="text-xs font-medium text-muted-foreground">{t("menu.title")}</h2>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t("menu.add")} title={t("menu.add")}>
              <PlusIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onCloseAutoFocus={menuDialog.onCloseAutoFocus}>
            <DropdownMenuItem onSelect={() => menuDialog.choose({ kind: "addLink" })}>
              {t("menu.addLink")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => menuDialog.choose({ kind: "addButton" })}>
              {t("menu.addButton")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => menuDialog.choose({ kind: "addGroup" })}>
              {t("menu.addGroup")}
            </DropdownMenuItem>
            {menu.follows === "custom" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={actions.followPages}>
                  {t("menu.followPages")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {menu.follows === "pages" && (
        <p className="m-0 px-2 pb-1 text-xs text-muted-foreground">{t("menu.followsPages")}</p>
      )}
      {rows.length === 0 ? (
        <p className="m-0 px-2 text-xs text-muted-foreground">{t("menu.empty")}</p>
      ) : (
        <ul ref={listRef} aria-label={t("menu.items")} className="p-1">
          {rows.map((row) => itemRow(row))}
        </ul>
      )}

      <LinkDialog
        open={open && (dialog?.kind === "addLink" || dialog?.kind === "addButton")}
        title={t(
          dialog?.kind === "addButton" ? "menu.buttonDialog.title" : "menu.linkDialog.title",
        )}
        link={undefined}
        label=""
        site={links.site}
        targets={links.targets}
        onSave={(change, label) => {
          actions.add({ kind: dialog?.kind === "addButton" ? "button" : "link", label, change });
          close();
        }}
        onCancel={close}
      />
      <LinkDialog
        open={open && editing !== undefined && editing.kind !== "page" && editing.kind !== "group"}
        title={t(editing?.kind === "button" ? "menu.buttonDialog.title" : "menu.linkDialog.title")}
        link={editing !== undefined && "link" in editing ? editing.link : undefined}
        label={editing === undefined ? "" : itemLabel(site, editing)}
        site={links.site}
        targets={links.targets}
        onSave={(change, label) => {
          if (editing !== undefined) actions.editLink(editing.id, label, change);
          close();
        }}
        onCancel={close}
      />
      <NameDialog
        open={open && (editing?.kind === "page" || editing?.kind === "group")}
        title={t("menu.renameDialog.title")}
        label={t("menu.renameDialog.label")}
        maxLength={MENU_LABEL_MAX}
        initialValue={editing === undefined ? "" : itemLabel(site, editing)}
        confirm={t("menu.renameDialog.confirm")}
        describe={() => ""}
        onSubmit={(label) => {
          if (editing !== undefined) actions.rename(editing.id, label);
          close();
        }}
        onCancel={close}
      />
      <NameDialog
        open={open && dialog?.kind === "addGroup"}
        title={t("menu.groupDialog.title")}
        description={t("menu.groupDialog.description")}
        label={t("menu.groupDialog.label")}
        maxLength={MENU_LABEL_MAX}
        initialValue=""
        confirm={t("menu.groupDialog.confirm")}
        describe={() => ""}
        onSubmit={(label) => {
          actions.add({ kind: "group", label });
          close();
        }}
        onCancel={close}
      />
    </section>
  );
}

/** Props of {@link ItemMenu}. */
type ItemMenuProps = {
  readonly row: Row;
  readonly name: string;
  /** The menu's dropdowns, to move an item into. */
  readonly groups: readonly GroupItem[];
  readonly actions: MenuPanelActions;
  readonly onEdit: () => void;
  /** Decides where focus goes as the menu closes (to the dialog it opened, if any). */
  readonly onCloseAutoFocus: (event: Event) => void;
};

/** The "…" menu of one item, shown on hover or focus. */
function ItemMenu({ row, name, groups, actions, onEdit, onCloseAutoFocus }: ItemMenuProps) {
  const { item } = row;
  const id = item.id;
  return (
    // Not modal, as the Pages panel's: a modal menu hides the window from screen readers.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("menu.actions", { name })}
          className="absolute top-0 right-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
        >
          <EllipsisIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onCloseAutoFocus={onCloseAutoFocus}>
        <DropdownMenuItem onSelect={onEdit}>
          {item.kind === "page" || item.kind === "group" ? t("menu.rename") : t("menu.changeLink")}
        </DropdownMenuItem>
        {item.kind === "page" && item.label !== undefined && (
          <DropdownMenuItem onSelect={() => actions.rename(id, "")}>
            {t("menu.usePageName")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => actions.setHidden(id, !item.hidden)}>
          {item.hidden ? t("menu.show") : t("menu.hide")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={row.index === 0}
          onSelect={() => actions.move(id, { group: row.group, index: row.index - 1 })}
        >
          {t("menu.moveUp")}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={row.index === row.siblings - 1}
          onSelect={() => actions.move(id, { group: row.group, index: row.index + 1 })}
        >
          {t("menu.moveDown")}
        </DropdownMenuItem>
        {item.kind !== "group" &&
          groups
            .filter((group) => group.id !== row.group)
            .map((group) => (
              <DropdownMenuItem
                key={group.id}
                onSelect={() =>
                  actions.move(id, {
                    group: group.id,
                    index: group.children.length,
                  })
                }
              >
                {t("menu.moveInto", { name: group.label })}
              </DropdownMenuItem>
            ))}
        {row.group !== null && (
          <DropdownMenuItem onSelect={() => actions.move(id, { group: null, index: Infinity })}>
            {t("menu.moveOut")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => actions.remove(id)}>
          {item.kind === "page" ? t("menu.removePage") : t("menu.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
