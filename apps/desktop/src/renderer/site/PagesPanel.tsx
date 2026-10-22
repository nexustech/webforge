import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  ScrollArea,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { PageEntry, PageId, SiteDoc } from "@webforge/model";
import {
  EllipsisIcon,
  EyeOffIcon,
  FileIcon,
  FileQuestionIcon,
  FolderIcon,
  HouseIcon,
  PlusIcon,
} from "lucide-react";
import { useState } from "react";
import { useMenuDialog } from "../shell/use-menu-dialog.js";
import { NameDialog } from "./NameDialog.js";
import { PageSettingsDialog } from "./PageSettingsDialog.js";
import {
  canBeHome,
  canChangeNavigation,
  canDelete,
  canDuplicate,
  canMoveToFolder,
  fileNameFor,
  fileNameInFolder,
  foldersOf,
  neighbour,
  type PageSettingsChange,
  renamedFileName,
} from "./page-actions.js";

/** What the Pages panel can do; {@link SitePanel} binds them to the editor session. */
export type PagesPanelActions = {
  show(pageId: PageId): void;
  add(name: string): void;
  rename(pageId: PageId, name: string): void;
  duplicate(pageId: PageId): void;
  move(pageId: PageId, direction: -1 | 1): void;
  moveToFolder(pageId: PageId, folder: string | undefined): void;
  setHome(pageId: PageId): void;
  setHidden(pageId: PageId, hidden: boolean): void;
  remove(pageId: PageId): void;
  changeSettings(pageId: PageId, change: PageSettingsChange): void;
};

/** Props of {@link PagesPanel}. */
export type PagesPanelProps = {
  readonly site: SiteDoc;
  /** The page the canvas shows. */
  readonly shownPageId: PageId;
  readonly actions: PagesPanelActions;
};

/** A dialog the panel has open. */
type OpenDialog =
  | { readonly kind: "add" }
  | { readonly kind: "rename" | "folder" | "settings"; readonly pageId: PageId };

/** A row of the list: a page at the top level, or a folder with its pages. */
type Row =
  | { readonly kind: "page"; readonly page: PageEntry }
  | { readonly kind: "folder"; readonly folder: string; readonly pages: readonly PageEntry[] };

/** The list in Pages panel order; each folder sits where its first page is. */
function rowsOf(site: SiteDoc): Row[] {
  const pages = site.pageOrder.flatMap((id) => site.pages[id] ?? []);
  const rows: Row[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    if (page.folder === undefined) {
      rows.push({ kind: "page", page });
    } else if (!seen.has(page.folder)) {
      seen.add(page.folder);
      const { folder } = page;
      rows.push({
        kind: "folder",
        folder,
        pages: pages.filter((other) => other.folder === folder),
      });
    }
  }
  return rows;
}

/**
 * Site panel → Pages (F-ED-13): the site's pages in navigation order, folders grouping their
 * pages. Clicking a page shows it on the canvas; each page's menu renames, duplicates, moves, sets
 * the Home page, hides it from navigation or deletes it (after a confirmation, D5). The "Page not
 * found" page (F-ED-20) is listed like any page but can only be renamed and designed.
 */
export function PagesPanel({ site, shownPageId, actions }: PagesPanelProps) {
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  // Closing keeps `dialog`, so a dialog keeps its text while it fades out.
  const [open, setOpen] = useState(false);
  const openDialog = (next: OpenDialog) => {
    setDialog(next);
    setOpen(true);
  };
  // The page menu's dialogs open once the menu has closed, so their field keeps the focus.
  // Delete asks through the shared site-wide confirmation (D7), which `actions.remove` opens.
  const menuDialog = useMenuDialog((next: OpenDialog | { kind: "delete"; pageId: PageId }) =>
    next.kind === "delete" ? actions.remove(next.pageId) : openDialog(next),
  );
  const close = () => setOpen(false);
  const dialogPage =
    dialog !== null && dialog.kind !== "add" ? site.pages[dialog.pageId] : undefined;

  const pageRow = (page: PageEntry, indented: boolean) => {
    const home = page.id === site.homePageId;
    const notFound = page.kind === "not-found";
    const Icon = home ? HouseIcon : notFound ? FileQuestionIcon : FileIcon;
    const shown = page.id === shownPageId;
    return (
      <li key={page.id} className="group relative">
        <button
          type="button"
          className={cn(
            "flex h-6 w-full items-center gap-1.5 rounded-sm px-2 pr-8 text-left text-xs outline-none",
            "hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
            indented && "pl-6",
            shown && "bg-accent font-medium text-accent-foreground",
          )}
          aria-current={shown ? "page" : undefined}
          onClick={() => actions.show(page.id)}
        >
          <Icon aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{page.title}</span>
          {home && <span className="sr-only">({t("pages.home")})</span>}
          {notFound && <span className="sr-only">({t("pages.notFound")})</span>}
          {page.settings.hideFromNavigation && !notFound && (
            <>
              <EyeOffIcon aria-hidden className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
              <span className="sr-only">({t("pages.hiddenFromNavigation")})</span>
            </>
          )}
        </button>
        <PageMenu
          site={site}
          page={page}
          actions={actions}
          onSettings={() => menuDialog.choose({ kind: "settings", pageId: page.id })}
          onRename={() => menuDialog.choose({ kind: "rename", pageId: page.id })}
          onNewFolder={() => menuDialog.choose({ kind: "folder", pageId: page.id })}
          onDelete={() => menuDialog.choose({ kind: "delete", pageId: page.id })}
          onCloseAutoFocus={menuDialog.onCloseAutoFocus}
        />
      </li>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-7 shrink-0 items-center justify-between pr-1 pl-2">
        <h2 className="text-xs font-medium text-muted-foreground">{t("pages.title")}</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("pages.add")}
          title={t("pages.add")}
          onClick={() => openDialog({ kind: "add" })}
        >
          <PlusIcon />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ul aria-label={t("pages.title")} className="p-1">
          {rowsOf(site).map((row) =>
            row.kind === "page" ? (
              pageRow(row.page, false)
            ) : (
              <li key={`folder:${row.folder}`}>
                <div className="flex h-6 items-center gap-1.5 px-2 text-xs text-muted-foreground">
                  <FolderIcon aria-hidden className="size-3.5 shrink-0" />
                  <span className="truncate">{row.folder}</span>
                </div>
                <ul aria-label={row.folder}>{row.pages.map((page) => pageRow(page, true))}</ul>
              </li>
            ),
          )}
        </ul>
      </ScrollArea>

      <NameDialog
        open={open && dialog?.kind === "add"}
        title={t("pages.addDialog.title")}
        label={t("pages.nameLabel")}
        initialValue={t("pages.newPageName")}
        confirm={t("pages.addDialog.confirm")}
        describe={(name) => t("pages.fileName", { path: fileNameFor(site, name, undefined) })}
        onSubmit={(name) => {
          actions.add(name);
          close();
        }}
        onCancel={close}
      />
      <NameDialog
        open={open && dialog?.kind === "rename" && dialogPage !== undefined}
        title={t("pages.renameDialog.title")}
        label={t("pages.nameLabel")}
        initialValue={dialogPage?.title ?? ""}
        confirm={t("pages.renameDialog.confirm")}
        describe={(name) =>
          t("pages.fileName", {
            path: dialogPage === undefined ? "" : renamedFileName(site, dialogPage.id, name),
          })
        }
        onSubmit={(name) => {
          if (dialogPage !== undefined) {
            actions.rename(dialogPage.id, name);
          }
          close();
        }}
        onCancel={close}
      />
      <NameDialog
        open={open && dialog?.kind === "folder" && dialogPage !== undefined}
        title={t("pages.folderDialog.title")}
        description={t("pages.folderDialog.description", { name: dialogPage?.title ?? "" })}
        label={t("pages.folderLabel")}
        initialValue=""
        confirm={t("pages.folderDialog.confirm")}
        describe={(name) =>
          t("pages.fileName", {
            path: dialogPage === undefined ? "" : fileNameInFolder(site, dialogPage.id, name),
          })
        }
        onSubmit={(name) => {
          if (dialogPage !== undefined) {
            actions.moveToFolder(dialogPage.id, name);
          }
          close();
        }}
        onCancel={close}
      />
      <PageSettingsDialog
        open={open && dialog?.kind === "settings"}
        site={site}
        page={dialogPage}
        onSave={(change) => {
          if (dialogPage !== undefined) {
            actions.changeSettings(dialogPage.id, change);
          }
          close();
        }}
        onCancel={close}
      />
    </div>
  );
}

/** Props of {@link PageMenu}. */
type PageMenuProps = {
  readonly site: SiteDoc;
  readonly page: PageEntry;
  readonly actions: PagesPanelActions;
  readonly onSettings: () => void;
  readonly onRename: () => void;
  readonly onNewFolder: () => void;
  readonly onDelete: () => void;
  /** Where focus goes as the menu closes: into the dialog it opened, if any. */
  readonly onCloseAutoFocus: (event: Event) => void;
};

/** The "…" menu of one page, shown on hover or focus. */
function PageMenu(props: PageMenuProps) {
  const { page } = props;
  return (
    // Not modal: a modal menu hides the rest of the window from screen readers while its buttons
    // stay focusable (axe: aria-hidden-focus), and this small row menu needs no focus trap.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("pages.actions", { name: page.title })}
          className="absolute top-0 right-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
        >
          <EllipsisIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onCloseAutoFocus={props.onCloseAutoFocus}>
        <PageMenuItems {...props} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The items of {@link PageMenu}, worked out only while it is open. */
function PageMenuItems({
  site,
  page,
  actions,
  onSettings,
  onRename,
  onNewFolder,
  onDelete,
}: PageMenuProps) {
  const folders = foldersOf(site).filter((folder) => folder !== page.folder);
  return (
    <>
      <DropdownMenuItem onSelect={onSettings}>{t("pageSettings.open")}</DropdownMenuItem>
      <DropdownMenuItem onSelect={onRename}>{t("pages.rename")}</DropdownMenuItem>
      {canDuplicate(page) && (
        <DropdownMenuItem onSelect={() => actions.duplicate(page.id)}>
          {t("pages.duplicate")}
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem
        disabled={neighbour(site, page.id, -1) === undefined}
        onSelect={() => actions.move(page.id, -1)}
      >
        {t("pages.moveUp")}
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={neighbour(site, page.id, 1) === undefined}
        onSelect={() => actions.move(page.id, 1)}
      >
        {t("pages.moveDown")}
      </DropdownMenuItem>
      {canMoveToFolder(site, page) && (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{t("pages.moveToFolder")}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {page.folder !== undefined && (
              <DropdownMenuItem onSelect={() => actions.moveToFolder(page.id, undefined)}>
                {t("pages.noFolder")}
              </DropdownMenuItem>
            )}
            {folders.map((folder) => (
              <DropdownMenuItem key={folder} onSelect={() => actions.moveToFolder(page.id, folder)}>
                {folder}
              </DropdownMenuItem>
            ))}
            {(page.folder !== undefined || folders.length > 0) && <DropdownMenuSeparator />}
            <DropdownMenuItem onSelect={onNewFolder}>{t("pages.newFolder")}</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )}
      {(canBeHome(site, page) || canChangeNavigation(page)) && <DropdownMenuSeparator />}
      {canBeHome(site, page) && (
        <DropdownMenuItem onSelect={() => actions.setHome(page.id)}>
          {t("pages.setHome")}
        </DropdownMenuItem>
      )}
      {canChangeNavigation(page) && (
        <DropdownMenuCheckboxItem
          checked={page.settings.hideFromNavigation}
          onCheckedChange={(checked) => actions.setHidden(page.id, checked)}
        >
          {t("pages.hideFromNavigation")}
        </DropdownMenuCheckboxItem>
      )}
      {canDelete(site, page) && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            {t("pages.delete")}
          </DropdownMenuItem>
        </>
      )}
    </>
  );
}
