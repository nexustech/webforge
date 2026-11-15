import { t } from "@webforge/i18n";
import { PaletteIcon } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useId, useState } from "react";
import { cn } from "../../lib/cn.js";
import { Button } from "../ui/button.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs.js";
import { BoxField } from "./box-field.js";
import type { EditPanelField, EditPanelProps, FieldGroup } from "./edit-panel-types.js";
import { FieldRenderersProvider, useFieldRenderers } from "./field-context.js";
import { type CopiedGroup, FieldList } from "./field-list.js";
import { resettable } from "./field-row.js";
import type { FieldKind, FieldRenderers } from "./field-spec.js";
import { ListField } from "./list-field.js";
import { PLAIN_RENDERERS } from "./plain-renderers.js";
import { fieldControlClass } from "./text-field.js";

/**
 * The renderers every Edit panel has; the ones the app gives it ({@link FieldRenderersProvider})
 * add kinds or replace these.
 */
const BUILT_IN: FieldRenderers = { ...PLAIN_RENDERERS, list: ListField, box: BoxField };

/** Whether every Edit panel draws fields of `kind` itself, without the app giving it a renderer. */
export function hasBuiltInRenderer(kind: FieldKind): boolean {
  return BUILT_IN[kind] !== undefined;
}

/**
 * The Edit panel (1.14): the selected element's fields on a Content and a Style tab, each drawn
 * by its kind's renderer. It only shows and reports; the app records each change in the history.
 */
export function EditPanel({
  heading,
  headingAside,
  fields,
  onChange,
  onChangeOn,
  onCommit,
  device,
  onReset,
  onResetToDefault,
  onPaste,
  groupActions,
  closedGroups,
  onClosedGroupsChange,
  advanced = false,
  contentOnly = false,
  single = false,
  itemKey,
  styleAction,
  headingHidden = false,
  advancedFooter,
  columns = false,
}: EditPanelProps) {
  const idPrefix = useId();
  // The option group copied last (SP-7): kept while other elements are selected, to paste there.
  const [copied, setCopied] = useState<CopiedGroup | null>(null);
  // The search field's text (UX-13): the fields whose name has it are shown. It is the element's:
  // selecting another starts with every field shown.
  const [search, setSearch] = useState({ itemKey, text: "" });
  const query = search.itemKey === itemKey ? search.text : "";
  const setQuery = (text: string) => setSearch({ itemKey, text });
  // The option groups the person closed (UX-13): the app's, else the panel's own.
  const [ownClosed, setOwnClosed] = useState<readonly string[]>([]);
  const closed = closedGroups ?? ownClosed;
  const setClosed = (next: readonly string[]) => {
    if (onClosedGroupsChange === undefined) setOwnClosed(next);
    else onClosedGroupsChange(next);
  };
  const toggle = (key: string) =>
    setClosed(closed.includes(key) ? closed.filter((each) => each !== key) : [...closed, key]);
  const toggleAll = (keys: readonly string[]) =>
    setClosed(
      keys.every((key) => !closed.includes(key))
        ? [...closed, ...keys]
        : closed.filter((key) => !keys.includes(key)),
    );
  // The app's renderers over the built-in ones, for its fields and its lists' items.
  const renderers: FieldRenderers = { ...BUILT_IN, ...useFieldRenderers() };
  if (heading === undefined) {
    return (
      <p className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
        {t("editPanel.empty")}
      </p>
    );
  }
  const wanted = query.trim().toLocaleLowerCase();
  const shown = fields.filter(
    (field) =>
      renderers[field.kind] !== undefined &&
      (wanted === "" || field.label.toLocaleLowerCase().includes(wanted)),
  );
  const content = shown.filter((field) => field.group === "content");
  const style = shown.filter((field) => field.group === "style");
  const advancedFields = shown.filter((field) => field.group === "advanced");
  /**
   * Cmd + Esc in a field resets it to the element's default (F-ED-27, UX-13), on a Mac only:
   * Windows opens the Start menu with Ctrl + Esc (#290).
   */
  const resetFromKeys = (
    event: KeyboardEvent<HTMLElement>,
    groupFields: readonly EditPanelField[],
  ) => {
    if (event.key !== "Escape" || !event.metaKey || onResetToDefault === undefined) {
      return;
    }
    const name = (event.target as Element).closest("[data-field]")?.getAttribute("data-field");
    if (groupFields.some((field) => field.name === name && resettable(field)) && name) {
      event.preventDefault();
      event.stopPropagation();
      onResetToDefault([name]);
    }
  };
  const list = (
    group: FieldGroup,
    groupFields: readonly EditPanelField[],
    top?: ReactNode,
    bottom?: ReactNode,
  ) => (
    <TabsContent
      value={group}
      className="overflow-auto"
      onKeyDown={(event) => resetFromKeys(event, groupFields)}
    >
      {top}
      <FieldList
        key={itemKey}
        idPrefix={`${idPrefix}${group}`}
        tab={group}
        fields={groupFields}
        onChange={onChange}
        {...(onChangeOn === undefined ? {} : { onChangeOn })}
        onCommit={onCommit}
        device={device}
        query={wanted}
        closed={closed}
        onToggle={toggle}
        onToggleAll={toggleAll}
        copied={copied}
        onCopy={setCopied}
        columns={columns}
        {...(onResetToDefault === undefined ? {} : { onResetToDefault })}
        {...(onPaste === undefined ? {} : { onPaste })}
        {...(groupActions === undefined ? {} : { groupActions })}
        {...(onReset === undefined ? {} : { onReset })}
      />
      {bottom}
    </TabsContent>
  );
  return (
    <FieldRenderersProvider renderers={renderers}>
      <div className="flex h-full flex-col">
        {headingHidden ? null : (
          <div className="flex items-center gap-1 px-3 pt-2">
            <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
              {heading}
            </h2>
            {headingAside}
          </div>
        )}
        <div className="px-3 pt-2">
          <input
            type="search"
            aria-label={t("editPanel.search")}
            placeholder={t("editPanel.searchPlaceholder")}
            value={query}
            className={cn(fieldControlClass, "h-7 w-full px-2 text-xs")}
            onChange={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query !== "") {
                event.stopPropagation();
                setQuery("");
              }
            }}
          />
        </div>
        <Tabs
          // Keyed by the element's type: the tab stays while moving between elements of one type, and
          // another type starts on its first tab with fields.
          key={`${heading}${contentOnly ? ":content" : ""}`}
          defaultValue={
            contentOnly || single || content.length > 0
              ? "content"
              : style.length > 0
                ? "style"
                : advanced && advancedFields.length > 0
                  ? "advanced"
                  : "content"
          }
          className="min-h-0 flex-1"
        >
          {single ? null : (
            <TabsList aria-label={t("editPanel.tabs")}>
              <TabsTrigger value="content">{t("editPanel.content")}</TabsTrigger>
              {contentOnly ? null : <TabsTrigger value="style">{t("editPanel.style")}</TabsTrigger>}
              {advanced && !contentOnly ? (
                <TabsTrigger value="advanced">{t("editPanel.advanced")}</TabsTrigger>
              ) : null}
            </TabsList>
          )}
          {list("content", content)}
          {contentOnly || single
            ? null
            : list(
                "style",
                style,
                styleAction === undefined ? undefined : (
                  <div className="px-3 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={styleAction.onSelect}
                    >
                      <PaletteIcon aria-hidden />
                      {styleAction.label}
                    </Button>
                  </div>
                ),
              )}
          {advanced && !contentOnly && !single
            ? list("advanced", advancedFields, undefined, advancedFooter)
            : null}
        </Tabs>
      </div>
    </FieldRenderersProvider>
  );
}
