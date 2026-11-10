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
  useMenuDialog,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import {
  type Collection,
  type CollectionId,
  collectionItems,
  collectionOf,
  isDraftPage,
  PAGE_FOLDER_MAX,
  PAGE_TITLE_MAX,
  type PageEntry,
  type PageId,
  pageFile,
  type SiteDoc,
} from "@webforge/model";
import { recipesFor, TEMPLATE_CATEGORIES } from "@webforge/templates";
import {
  EllipsisIcon,
  EyeOffIcon,
  FileIcon,
  FileQuestionIcon,
  FolderIcon,
  HouseIcon,
  NewspaperIcon,
  PlusIcon,
} from "lucide-react";
import { useState } from "react";
import { NameDialog } from "../shell/NameDialog.js";
import { offersCookiePolicy } from "./cookie-page.js";
import { PageSettingsDialog } from "./PageSettingsDialog.js";
import {
  canBeDraft,
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
  renameMovesPage,
} from "./page-actions.js";
import type { PolicyPageKind } from "./policy-sections.js";
import { recipeName } from "./recipe-name.js";

/** What the Pages panel can do; {@link SitePanel} binds them to the editor session. */
export type PagesPanelActions = {
  show(pageId: PageId): void;
  add(name: string): void;
  /** Adds a page made from page recipe `recipeId` (QS-3, 3.11a). */
  addSuggested(recipeId: string): void;
  /** Adds the privacy page, the terms or the cookie policy, from Site Settings (#855, #866). */
  addPolicy(kind: PolicyPageKind): void;
  /** Adds a Blog and its first post (6.10a). */
  addBlog(): void;
  /** Adds a post to the Blog `collectionId` (6.10a). */
  addPost(collectionId: CollectionId): void;
  /** Renames a page, keeping its old address working if `keepOldAddress` (#862). */
  rename(pageId: PageId, name: string, keepOldAddress: boolean): void;
  duplicate(pageId: PageId): void;
  move(pageId: PageId, direction: -1 | 1): void;
  moveToFolder(pageId: PageId, folder: string | undefined): void;
  setHome(pageId: PageId): void;
  setHidden(pageId: PageId, hidden: boolean): void;
  /** Makes a page a draft, or takes it out of drafts (G37, #864). */
  setDraft(pageId: PageId, draft: boolean): void;
  remove(pageId: PageId): void;
  changeSettings(pageId: PageId, change: PageSettingsChange): void;
};

/** Props of {@link PagesPanel}. */
export type PagesPanelProps = {
  readonly site: SiteDoc;
  /** The page the canvas shows. */
  readonly shownPageId: PageId;
  /** Whether the site has been published: renaming a page then keeps its old address by default. */
  readonly published?: boolean;
  readonly actions: PagesPanelActions;
};

/** A dialog the panel has open. */
type OpenDialog =
  | { readonly kind: "add" }
  | { readonly kind: "rename" | "folder" | "settings"; readonly pageId: PageId };

/** A row of the list: a page at the top level, a folder with its pages, or a Blog with its posts. */
type Row =
  | { readonly kind: "page"; readonly page: PageEntry }
  | { readonly kind: "folder"; readonly folder: string; readonly pages: readonly PageEntry[] }
  | {
      readonly kind: "collection";
      readonly collection: Collection;
      readonly pages: readonly PageEntry[];
    };

/**
 * The list in Pages panel order; each folder sits where its first page is. A Blog (6.10a) is a
 * group of its own, headed by its name, listing its posts newest first; it sits where its first
 * post is, and after the pages when it has none.
 */
function rowsOf(site: SiteDoc): Row[] {
  const pages = site.pageOrder.flatMap((id) => site.pages[id] ?? []);
  const rows: Row[] = [];
  const seen = new Set<string>();
  const shown = new Set<string>();
  const collectionRow = (collection: Collection): Row => ({
    kind: "collection",
    collection,
    pages: collectionItems(site, collection.id),
  });
  for (const page of pages) {
    if (page.collection !== undefined) {
      const collection = collectionOf(site, page);
      if (collection !== undefined && !shown.has(collection.id)) {
        shown.add(collection.id);
        rows.push(collectionRow(collection));
      }
    } else if (page.folder === undefined) {
      rows.push({ kind: "page", page });
    } else if (!seen.has(page.folder)) {
      seen.add(page.folder);
      const { folder } = page;
      rows.push({
        kind: "folder",
        folder,
        pages: pages.filter((other) => other.folder === folder && other.collection === undefined),
      });
    }
  }
  for (const collection of Object.values(site.collections)) {
    if (!shown.has(collection.id)) rows.push(collectionRow(collection));
  }
  return rows;
}

/**
 * Site panel → Pages (F-ED-13): the site's pages in navigation order, folders grouping their
 * pages. Clicking a page shows it on the canvas; each page's menu renames, duplicates, moves, sets
 * the Home page, hides it from navigation or deletes it (after a confirmation, D5). The "Page not
 * found" page (F-ED-20) is listed like any page but can only be renamed and designed.
 */
export function PagesPanel({ site, shownPageId, published = false, actions }: PagesPanelProps) {
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
    const isDraft = isDraftPage(site, page);
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
          {isDraft && (
            // A draft (G37, #864): kept in the site, not on the website.
            <span className="ml-auto shrink-0 rounded-sm border border-border px-1 text-[10px] leading-4 text-muted-foreground">
              {t("pages.draftBadge")}
            </span>
          )}
          {page.settings.hideFromNavigation && !notFound && (
            <>
              <EyeOffIcon
                aria-hidden
                className={cn("size-3.5 shrink-0 text-muted-foreground", !isDraft && "ml-auto")}
              />
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
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("pages.add")}
              title={t("pages.add")}
            >
              <PlusIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onCloseAutoFocus={menuDialog.onCloseAutoFocus}>
            <DropdownMenuItem onSelect={() => menuDialog.choose({ kind: "add" })}>
              {t("pages.addBlank")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.addPolicy("privacy")}>
              {t("pages.addPrivacy")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.addPolicy("terms")}>
              {t("pages.addTerms")}
            </DropdownMenuItem>
            {/* One Blog per site: its group has New Post (6.10a). */}
            {!Object.values(site.collections).some((each) => each.preset === "blog") && (
              <DropdownMenuItem onSelect={actions.addBlog}>{t("blog.add")}</DropdownMenuItem>
            )}
            {/* Only while Google Analytics is on: nothing else on the site sets cookies unasked. */}
            {offersCookiePolicy(site) && (
              <DropdownMenuItem onSelect={() => actions.addPolicy("cookies")}>
                {t("pages.addCookies")}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>{t("pages.addSuggested")}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {/* By business type: the site doesn't keep the template it started from. */}
                {TEMPLATE_CATEGORIES.map((category) => (
                  <DropdownMenuSub key={category}>
                    <DropdownMenuSubTrigger>
                      {t(`template.category.${category}`)}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {recipesFor(category).map((recipe) => (
                        <DropdownMenuItem
                          key={recipe.id}
                          onSelect={() => actions.addSuggested(recipe.id)}
                        >
                          {recipeName(recipe.id, recipe.title)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ul aria-label={t("pages.title")} className="p-1">
          {rowsOf(site).map((row) =>
            row.kind === "page" ? (
              pageRow(row.page, false)
            ) : row.kind === "collection" ? (
              <li key={`collection:${row.collection.id}`}>
                <div className="group/blog flex h-6 items-center gap-1.5 pr-1 pl-2 text-xs text-muted-foreground">
                  <NewspaperIcon aria-hidden className="size-3.5 shrink-0" />
                  <span className="truncate">{row.collection.name}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="ml-auto size-5"
                    aria-label={`${t("blog.newPost")} (${row.collection.name})`}
                    title={t("blog.newPost")}
                    onClick={() => actions.addPost(row.collection.id)}
                  >
                    <PlusIcon />
                  </Button>
                </div>
                <ul aria-label={row.collection.name}>
                  {row.pages.length === 0 ? (
                    <li className="h-6 pl-6 text-xs leading-6 text-muted-foreground">
                      {t("blog.noPosts")}
                    </li>
                  ) : (
                    row.pages.map((page) => pageRow(page, true))
                  )}
                </ul>
              </li>
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
        maxLength={PAGE_TITLE_MAX}
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
        maxLength={PAGE_TITLE_MAX}
        initialValue={dialogPage?.title ?? ""}
        confirm={t("pages.renameDialog.confirm")}
        describe={(name) =>
          t("pages.fileName", {
            path: dialogPage === undefined ? "" : renamedFileName(site, dialogPage.id, name),
          })
        }
        option={{
          label: t("pages.keepOldAddress"),
          help: () =>
            t("pages.keepOldAddressHint", {
              path: dialogPage === undefined ? "" : (pageFile(site, dialogPage.id) ?? ""),
            }),
          initial: published,
          shown: (name) => dialogPage !== undefined && renameMovesPage(site, dialogPage.id, name),
        }}
        onSubmit={(name, keepOldAddress) => {
          if (dialogPage !== undefined) {
            actions.rename(dialogPage.id, name, keepOldAddress);
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
        maxLength={PAGE_FOLDER_MAX}
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
      {/* A Blog lists its posts by date, so they aren't moved up or down (6.10a). */}
      {page.collection === undefined && (
        <>
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
        </>
      )}
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
      {canBeDraft(site, page) && (
        <DropdownMenuCheckboxItem
          checked={page.settings.draft === true}
          onCheckedChange={(checked) => actions.setDraft(page.id, checked)}
        >
          {t("pages.draft")}
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
