import {
  Button,
  EmptyState,
  ResizableHandle,
  type ResizableLayout,
  ResizablePanel,
  ResizablePanelGroup,
  type ResizablePanelGroupHandle,
  type ResizablePanelHandle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  WithTooltip,
} from "@webforge/editor-ui";
import { type MessageKey, t } from "@webforge/i18n";
import {
  type LucideIcon,
  PanelBottomCloseIcon,
  PanelBottomOpenIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  SearchIcon,
} from "lucide-react";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { Preferences } from "../../shared/ipc-contract.js";
import { CanvasErrorBoundary } from "./CanvasErrorBoundary.js";
import { useCommandRegistry } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import { withShortcut } from "./commands.js";
import { type Side, sideToClose, startsLeftCollapsed } from "./narrow-window.js";
import { PanelErrorBoundary } from "./PanelErrorBoundary.js";
import { usePanelRegistry, usePanels } from "./panel-context.js";
import { type Panel, type PanelSlot, panelsInSlot } from "./panels.js";
import { REGION_ATTRIBUTE } from "./regions.js";

/** The panel groups whose sizes are remembered, by id. */
export const PANEL_GROUPS = {
  columns: "shell.columns",
  center: "shell.center",
  /** The left column's tabs over its lower pane (ADR 0011). */
  left: "shell.left",
} as const;

/** How wide a collapsed side column stays: a strip of its panels' icons (UX-13). */
const STRIP_PX = 36;

/**
 * A remembered side column narrower than this was left collapsed: halfway between the strip and
 * the narrowest an open column can be (`DEFAULTS.sideMin`).
 */
const COLLAPSED_BELOW_PX = (STRIP_PX + 200) / 2;

/** Whether a side column's remembered size (a percentage of the window's width) is its strip. */
function savedCollapsed(size: number | undefined): boolean {
  return size !== undefined && (size / 100) * window.innerWidth < COLLAPSED_BELOW_PX;
}

/**
 * The default layout: 300 px side columns, the drawer closed. 300 px fits the Edit panel's fields
 * (#1007: a Hero's needed 278 px, and colour names were cut at 240). A saved layout keeps its own.
 * Side columns stay between 200 and 360 px and the canvas keeps at least 40% of the width, so it
 * is never squeezed to an unusable zoom (ADR 0008).
 */
const DEFAULTS = {
  sideWidth: "300px",
  sideMin: "200px",
  sideMax: "360px",
  centerMin: "40%",
  // A third of the space under the canvas toolbar, and never less than READABLE_DRAWER_PX (#1164).
  drawer: "33%",
  // The left column's lower pane (Layers) keeps between 15% and 85% of its height (ADR 0011).
  lowerMin: "15%",
  lowerMax: "85%",
} as const;

/** The left column's tabs over its lower pane (Layers): UI1's 60/40 (ADR 0011). */
const LEFT_SPLIT = { tabs: 60, lower: 40 } as const;

/** The slots each part of the window shows as tabs, top slot first. */
const SLOTS = {
  left: ["left.top", "left.bottom"],
  /** Under the left column's tabs, shown at the same time (ADR 0011). */
  leftLower: ["left.lower"],
  right: ["right.top", "right.bottom"],
  drawer: ["drawer"],
} as const satisfies Record<string, readonly PanelSlot[]>;

/** The slots in each collapsible part of the window. */
const AREAS = {
  left: [...SLOTS.left, ...SLOTS.leftLower],
  right: SLOTS.right,
  drawer: SLOTS.drawer,
} as const satisfies Record<string, readonly PanelSlot[]>;

/** What a collapsible part's own buttons do (#1412): its command, and what each button is named. */
type AreaButtons = {
  readonly command: string;
  readonly hide: { readonly name: MessageKey; readonly icon: LucideIcon };
  readonly show: { readonly name: MessageKey; readonly icon: LucideIcon };
};

/**
 * The buttons on each collapsible part (#1412): one on its tabs that folds it, pointing the way it
 * folds, and one where it was that opens it again. Each runs the title bar's command, so its
 * button, the Panels menu's tick and the saved layout stay in step.
 */
const AREA_BUTTONS = {
  left: {
    command: COMMAND_IDS.toggleLeftPanels,
    hide: { name: "panels.hideLeft", icon: PanelLeftCloseIcon },
    show: { name: "panels.showLeft", icon: PanelLeftOpenIcon },
  },
  right: {
    command: COMMAND_IDS.toggleRightPanels,
    hide: { name: "panels.hideRight", icon: PanelRightCloseIcon },
    show: { name: "panels.showRight", icon: PanelRightOpenIcon },
  },
  drawer: {
    command: COMMAND_IDS.toggleDrawer,
    hide: { name: "panels.hideDrawer", icon: PanelBottomCloseIcon },
    show: { name: "panels.showDrawer", icon: PanelBottomOpenIcon },
  },
} as const satisfies Record<keyof typeof AREAS, AreaButtons>;

/** What {@link AreaButton} names its element with: `left-hide`, `drawer-show`. */
const AREA_BUTTON_ATTRIBUTE = "data-area-button";

/**
 * The area button to focus once the window's parts have folded or opened: the one that undoes the
 * button just pressed, which was hidden with its part or removed with its strip (#1412).
 */
const RefocusContext = createContext<(target: string) => void>(() => {});

/**
 * The button that folds (`hide`) or opens (`show`) part `area` of the window (#1412), named for
 * what it does, its tooltip with the command's shortcut from the standard: "Hide Left Panels
 * (Ctrl+Alt+B)".
 */
function AreaButton({
  area,
  action,
}: {
  readonly area: keyof typeof AREA_BUTTONS;
  readonly action: "hide" | "show";
}) {
  const registry = useCommandRegistry();
  const refocusAfter = useContext(RefocusContext);
  const { command } = AREA_BUTTONS[area];
  const { name: key, icon: Icon } = AREA_BUTTONS[area][action];
  const name = t(key);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={name}
      tooltip={withShortcut(name, command)}
      {...{ [AREA_BUTTON_ATTRIBUTE]: `${area}-${action}` }}
      onClick={() => {
        refocusAfter(`${area}-${action === "hide" ? "show" : "hide"}`);
        registry.run(command);
      }}
    >
      <Icon />
    </Button>
  );
}

/** Props of {@link ShellLayout}. */
export type ShellLayoutProps = {
  /** The canvas: the middle of the window. */
  readonly center: ReactNode;
  /** Remembered sizes, by panel group id (preferences). */
  readonly layout: Preferences["panelLayout"];
  /** Called after the person resizes, collapses or resets a group. */
  readonly onLayoutChange: (groupId: string, layout: ResizableLayout) => void;
  readonly editorLevel: Preferences["editorLevel"];
};

/**
 * A panel's tab that shows only its icon (#898): named by its title, which its tooltip shows too,
 * over what the panel is for. The tooltip opens on hover and on the keyboard's focus.
 */
function IconTab({
  panel,
  icon: Icon,
}: {
  readonly panel: Panel;
  readonly icon: NonNullable<Panel["icon"]>;
}) {
  return (
    <Tooltip>
      {/* The tab outside, the tooltip's trigger inside: each sets `data-state`, and the tab's
          ("active") must win, as the tab's look follows it. */}
      <TabsTrigger value={panel.id} asChild className="px-2 [&_svg]:size-4">
        <TooltipTrigger aria-label={panel.title}>
          <Icon />
        </TooltipTrigger>
      </TabsTrigger>
      {/* The tab is named by its title already: what the panel is for alone describes it. */}
      <TooltipContent side="bottom" className="max-w-56" aria-label={panel.description}>
        <p className="font-semibold">{panel.title}</p>
        {panel.description === undefined ? null : (
          <p className="text-muted-foreground">{panel.description}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The panels of some slots as tabs, one shown at a time, or an empty state when no area has put a
 * panel there yet. A side column shows its top slot's panels first, then its bottom slot's. With
 * `iconTabs`, a tab whose panel has an icon shows only that, with a tooltip (#898): the left
 * column's three titles didn't fit its width. `start` and `end` go at the tab strip's ends: the
 * button that folds the part (#1412).
 */
function PanelTabs({
  slots,
  editorLevel,
  iconTabs = false,
  start,
  end,
}: {
  readonly slots: readonly PanelSlot[];
  readonly editorLevel: Preferences["editorLevel"];
  readonly iconTabs?: boolean;
  readonly start?: ReactNode;
  readonly end?: ReactNode;
}) {
  const registry = usePanelRegistry();
  const registered = usePanels();
  const panels = slots.flatMap((slot) => panelsInSlot(registered, slot, editorLevel));
  // The tab the person chose stays chosen while panels come and go; the first one otherwise.
  const [chosen, setChosen] = useState<string | null>(null);
  // A panel brought to the front by an action elsewhere, such as the canvas's + opening Add.
  useEffect(
    () =>
      registry.onShow((id) => {
        const shown = slots.flatMap((slot) => panelsInSlot(registry.list(), slot, editorLevel));
        if (shown.some((panel) => panel.id === id)) setChosen(id);
      }),
    [registry, slots, editorLevel],
  );
  // The tabs' root, in state: a new one (the column emptied and filled again) is watched anew.
  const [tabs, setTabs] = useState<HTMLDivElement | null>(null);
  const first = panels[0];
  const activeId = (panels.find((panel) => panel.id === chosen) ?? first)?.id;
  // The shown panel's search field, while it has one (the Edit panel's shows with a selection):
  // the strip's magnifier focuses it (LF-5), and is there only then.
  const [search, setSearch] = useState<HTMLInputElement | null>(null);
  useEffect(() => {
    if (tabs === null || activeId === undefined) return;
    // Watching the shown panel only, and looking at most once a frame: a drag in Layers or typing
    // in the Edit panel changes it often (#421 review). The tabs' own children are watched too, so
    // a panel's content replaced while its tab stays shown is followed (#425 review).
    let frame = 0;
    let content: Element | null = null;
    const inner = new MutationObserver(() => later());
    const find = () =>
      setSearch(content?.querySelector<HTMLInputElement>('input[type="search"]') ?? null);
    const later = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(find);
    };
    const follow = () => {
      const next = tabs.querySelector(
        `:scope > [data-slot="tabs-content"][data-panel="${CSS.escape(activeId)}"]`,
      );
      if (next !== content) {
        inner.disconnect();
        content = next;
        if (content !== null) inner.observe(content, { childList: true, subtree: true });
      }
      later();
    };
    const outer = new MutationObserver(follow);
    outer.observe(tabs, { childList: true });
    follow();
    find();
    return () => {
      cancelAnimationFrame(frame);
      outer.disconnect();
      inner.disconnect();
    };
  }, [tabs, activeId]);
  if (first === undefined) {
    return <EmptyState className="h-full justify-center bg-panel">{t("panels.empty")}</EmptyState>;
  }
  const active = panels.find((panel) => panel.id === chosen) ?? first;
  return (
    <Tabs ref={setTabs} value={active.id} onValueChange={setChosen} className="h-full">
      <div className="flex shrink-0 items-center bg-tabs">
        {start === undefined ? null : <div className="ml-1 flex">{start}</div>}
        <TabsList className="min-w-0 flex-1">
          {panels.map((panel) =>
            iconTabs && panel.icon !== undefined ? (
              <IconTab key={panel.id} panel={panel} icon={panel.icon} />
            ) : (
              <TabsTrigger key={panel.id} value={panel.id}>
                {panel.title}
              </TabsTrigger>
            ),
          )}
        </TabsList>
        {search !== null ? (
          // The panel's search, from the strip's right end (LF-5).
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="mr-1"
            aria-label={t("panels.search", { panel: active.title })}
            tooltip={t("panels.search", { panel: active.title })}
            onClick={() => search.focus()}
          >
            <SearchIcon />
          </Button>
        ) : null}
        {end === undefined ? null : <div className="mr-1 flex">{end}</div>}
      </div>
      {panels.map((panel) => (
        <TabsContent
          key={panel.id}
          value={panel.id}
          data-panel={panel.id}
          className="overflow-auto"
        >
          <PanelErrorBoundary>
            <panel.component />
          </PanelErrorBoundary>
        </TabsContent>
      ))}
    </Tabs>
  );
}

/**
 * What a collapsed side column leaves (UX-13): a strip with a button for each of its panels, which
 * opens the column at that panel, under the button that opens it at the panel it last showed
 * (#1412).
 */
function PanelStrip({
  side,
  editorLevel,
  label,
}: {
  readonly side: Side;
  readonly editorLevel: Preferences["editorLevel"];
  readonly label: string;
}) {
  const registry = usePanelRegistry();
  const registered = usePanels();
  const panels = AREAS[side].flatMap((slot) => panelsInSlot(registered, slot, editorLevel));
  return (
    <nav
      aria-label={label}
      {...{ [REGION_ATTRIBUTE]: "" }}
      className="flex h-full flex-col items-center gap-1 bg-panel py-2"
    >
      <AreaButton area={side} action="show" />
      <div aria-hidden className="my-1 h-px w-5 shrink-0 bg-border" />
      {panels.map((panel) => (
        <WithTooltip key={panel.id} tooltip={panel.title}>
          <button
            type="button"
            aria-label={panel.title}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            onClick={() => registry.show(panel.id)}
          >
            {panel.icon === undefined ? (
              <span aria-hidden className="text-xs font-semibold">
                {panel.title.slice(0, 1)}
              </span>
            ) : (
              <panel.icon className="size-4" />
            )}
          </button>
        </WithTooltip>
      ))}
    </nav>
  );
}

/** Shows a collapsed panel at its last size (or `size`), hides an open one. */
function toggle(panel: ResizablePanelHandle | null, size: string): void {
  if (panel === null) {
    return;
  }
  if (!panel.isCollapsed()) {
    panel.collapse();
    return;
  }
  panel.expand();
  if (panel.isCollapsed()) {
    panel.resize(size);
  }
}

/** The side columns' handles, by side. */
type SideColumns = Readonly<Record<Side, { readonly current: ResizablePanelHandle | null }>>;

/**
 * The side columns that have never been open since the window started: the left one when it
 * started as its strip (#1166). The library opens a column it never collapsed at its smallest
 * width (200 px, its `expandToSize` unset), so its first opening is sized to the default.
 */
type NeverOpened = Record<Side, boolean>;

/**
 * Opens collapsed side column `side` (#1166). In a narrow window the other folds to its strip
 * first (`sideToClose`), so the column opens into the room it frees, and the page stays at half its
 * size or more. A column opening for the first time takes the default width, 300 px.
 */
function openSide(columns: SideColumns, side: Side, neverOpened: NeverOpened): void {
  const column = columns[side].current;
  if (column === null || !column.isCollapsed()) return;
  const other = columns[side === "left" ? "right" : "left"].current;
  const close = sideToClose(window.innerWidth, side, other !== null && !other.isCollapsed());
  if (close !== undefined) columns[close].current?.collapse();
  const first = neverOpened[side];
  column.expand();
  if (column.isCollapsed() || first) column.resize(DEFAULTS.sideWidth);
  neverOpened[side] = false;
}

/** Shows side column `side`, or hides it, as {@link toggle} does, opening it as {@link openSide}. */
function toggleSide(columns: SideColumns, side: Side, neverOpened: NeverOpened): void {
  const column = columns[side].current;
  if (column !== null && !column.isCollapsed()) column.collapse();
  else openSide(columns, side, neverOpened);
}

/**
 * The fewest pixels the drawer opens at (#1164): its tabs, a summary and at least three of Site
 * Check's findings, at 960 × 600 too.
 */
const READABLE_DRAWER_PX = 272;

/**
 * An open drawer at a height it can be read at (#1164). Opened for the first time, the library gave
 * it its smallest size, 10%: 73 px at 1366 × 768, its tabs and one line. Under
 * {@link READABLE_DRAWER_PX} it grows to a third of the space, or to that, if more.
 */
function readable(drawer: ResizablePanelHandle | null): void {
  if (drawer === null || drawer.isCollapsed()) return;
  if (drawer.getSize().inPixels >= READABLE_DRAWER_PX) return;
  drawer.resize(DEFAULTS.drawer);
  if (drawer.getSize().inPixels < READABLE_DRAWER_PX) drawer.resize(READABLE_DRAWER_PX);
}

/** Shows the drawer, or hides it, as {@link toggle} does: shown, at a height to read at. */
function toggleDrawer(drawer: ResizablePanelHandle | null): void {
  toggle(drawer, DEFAULTS.drawer);
  readable(drawer);
}

/**
 * The window below the title bar (UI1): left and right columns of tabbed panels around the
 * canvas, a bottom drawer under it, resizable splitters (also with the arrow keys) and
 * collapsible columns. Each column shows one panel at a time, as tabs (ADR 0008). Sizes are
 * remembered per person, and Reset Panels restores the defaults.
 * Areas fill the slots with `registerPanel`; a column shows once one of its slots has a panel, so
 * the canvas isn't squeezed by empty columns while Phase 1 fills them.
 */
export function ShellLayout({ center, layout, onLayoutChange, editorLevel }: ShellLayoutProps) {
  const registry = useCommandRegistry();
  const left = useRef<ResizablePanelHandle | null>(null);
  const right = useRef<ResizablePanelHandle | null>(null);
  const drawer = useRef<ResizablePanelHandle | null>(null);
  const leftSplit = useRef<ResizablePanelGroupHandle | null>(null);
  /**
   * When the person last asked for a layout change through a command (toggle, Reset Panels).
   * Only their own changes are saved: the library also reports automatic ones, such as the first
   * layout or a column appearing when an area adds its first panel.
   */
  const commandAt = useRef(Number.NEGATIVE_INFINITY);
  const panelRegistry = usePanelRegistry();
  const panels = usePanels();
  const hasPanels = (slots: readonly PanelSlot[]) =>
    slots.some((slot) => panelsInSlot(panels, slot, editorLevel).length > 0);
  const showLeft = hasPanels(AREAS.left);
  const showRight = hasPanels(AREAS.right);
  // Layers, under the left column's tabs (ADR 0011).
  const showLower = hasPanels(SLOTS.leftLower);
  // Which side columns are collapsed to their strip, from the sizes the library reports: at first
  // the remembered ones, so a column left collapsed starts as its strip.
  // A first open in a narrow window starts with the left column as its strip (#1166).
  const [leftStartsCollapsed] = useState(() =>
    startsLeftCollapsed(window.innerWidth, layout[PANEL_GROUPS.columns] !== undefined),
  );
  const [collapsed, setCollapsed] = useState(() => ({
    left: leftStartsCollapsed || savedCollapsed(layout[PANEL_GROUPS.columns]?.left),
    right: savedCollapsed(layout[PANEL_GROUPS.columns]?.right),
  }));
  // Whether the bottom panel is shown, for the Panels menu's checkbox (#1195) and its bar (#1412):
  // as it was left, so a window opened with it open doesn't draw the bar for a frame.
  const [drawerShown, setDrawerShown] = useState(
    () => (layout[PANEL_GROUPS.center]?.["drawer"] ?? 0) > 0,
  );
  const refocus = useRef<string | null>(null);
  const refocusAfter = (target: string) => {
    refocus.current = target;
  };
  // The button that undoes the one just pressed, once its part has folded or opened (#1412).
  // biome-ignore lint/correctness/useExhaustiveDependencies: run when a part folds or opens.
  useEffect(() => {
    const target = refocus.current;
    if (target === null) return;
    const button = document.querySelector<HTMLElement>(`[${AREA_BUTTON_ATTRIBUTE}="${target}"]`);
    if (button === null || button.closest("[hidden]") !== null) return;
    refocus.current = null;
    button.focus();
  }, [collapsed.left, collapsed.right, drawerShown]);
  // The columns not yet opened since the window started ({@link NeverOpened}).
  const neverOpened = useRef<NeverOpened>({ left: leftStartsCollapsed, right: false });
  const followCollapsed = (side: "left" | "right") => (size: { readonly inPixels: number }) => {
    const next = size.inPixels <= STRIP_PX + 1;
    // Opened, however: dragged open too. Its later openings keep the width it's given.
    if (!next) neverOpened.current[side] = false;
    setCollapsed((current) => (current[side] === next ? current : { ...current, [side]: next }));
  };

  useEffect(() => {
    const byCommand =
      (action: () => void): (() => void) =>
      () => {
        commandAt.current = performance.now();
        action();
      };
    const removers = [
      registry.register({
        id: COMMAND_IDS.toggleLeftPanels,
        label: t("command.toggleLeftPanels"),
        menu: "view",
        run: byCommand(() => toggleSide({ left, right }, "left", neverOpened.current)),
      }),
      registry.register({
        id: COMMAND_IDS.toggleRightPanels,
        label: t("command.toggleRightPanels"),
        menu: "view",
        run: byCommand(() => toggleSide({ left, right }, "right", neverOpened.current)),
      }),
      registry.register({
        id: COMMAND_IDS.toggleDrawer,
        label: t("command.toggleDrawer"),
        menu: "view",
        run: byCommand(() => toggleDrawer(drawer.current)),
      }),
      registry.register({
        id: COMMAND_IDS.resetPanels,
        label: t("command.resetPanels"),
        menu: "view",
        run: byCommand(() => {
          for (const column of [left.current, right.current]) {
            column?.expand();
            column?.resize(DEFAULTS.sideWidth);
          }
          drawer.current?.collapse();
          leftSplit.current?.setLayout(LEFT_SPLIT);
        }),
      }),
    ];
    return () => {
      for (const remove of removers) remove();
    };
  }, [registry]);

  // What the Panels menu ticks: each column and the bottom panel, shown or not (#1195).
  useEffect(() => {
    registry.update(COMMAND_IDS.toggleLeftPanels, { checked: !collapsed.left });
    registry.update(COMMAND_IDS.toggleRightPanels, { checked: !collapsed.right });
    registry.update(COMMAND_IDS.toggleDrawer, { checked: drawerShown });
  }, [registry, collapsed, drawerShown]);

  // A panel asked for is shown even if its column is collapsed.
  useEffect(
    () =>
      panelRegistry.onShow((id) => {
        for (const [side, column] of [
          ["left", left.current],
          ["right", right.current],
          ["drawer", drawer.current],
        ] as const) {
          const holds = AREAS[side].some((slot) =>
            panelsInSlot(panelRegistry.list(), slot, editorLevel).some((panel) => panel.id === id),
          );
          if (holds && column?.isCollapsed() === true) {
            // A side column shown in a narrow window folds the other first (#1166).
            if (side === "drawer") {
              toggle(column, DEFAULTS.drawer);
              // Shown now, not when its size is next observed: a panel that takes the focus as
              // it's shown, as Find and Replace does, can't focus inside a `hidden` section.
              flushSync(() => setDrawerShown(true));
            } else openSide({ left, right }, side, neverOpened.current);
          }
          // The drawer at a height to read at, however small it was left (#1164).
          if (holds && side === "drawer") readable(column);
        }
      }),
    [panelRegistry, editorLevel],
  );

  useEffect(() => {
    registry.update(COMMAND_IDS.toggleLeftPanels, { enabled: showLeft });
    registry.update(COMMAND_IDS.toggleRightPanels, { enabled: showRight });
  }, [registry, showLeft, showRight]);

  // A remembered layout only fits while the same columns are shown; when a column appears later,
  // the library applies the matching layout then.
  const columnIds = [showLeft && "left", "center", showRight && "right"].filter(
    (id): id is string => id !== false,
  );
  const savedColumns = layout[PANEL_GROUPS.columns];
  const columnsLayout =
    savedColumns !== undefined &&
    Object.keys(savedColumns).length === columnIds.length &&
    columnIds.every((id) => id in savedColumns)
      ? savedColumns
      : undefined;

  /**
   * Saves a group's sizes when the person changed them (dragging, the arrow keys or a command),
   * unless they're what was saved already.
   */
  const remember =
    (groupId: string) =>
    (
      current: ResizableLayout,
      meta: {
        readonly isUserInteraction: boolean;
        readonly requestedLayout?: ResizableLayout | undefined;
      },
    ) => {
      const byPerson = meta.isUserInteraction || performance.now() - commandAt.current < 1_000;
      if (!byPerson) {
        return;
      }
      const next = meta.requestedLayout ?? current;
      const saved = layout[groupId];
      const same =
        saved !== undefined &&
        Object.keys(next).length === Object.keys(saved).length &&
        Object.entries(next).every(([id, size]) => Math.abs((saved[id] ?? -1) - size) < 0.01);
      if (!same) {
        onLayoutChange(groupId, next);
      }
    };

  return (
    <RefocusContext value={refocusAfter}>
      <ResizablePanelGroup
        id={PANEL_GROUPS.columns}
        orientation="horizontal"
        className="bg-panel-group"
        {...(columnsLayout === undefined ? {} : { defaultLayout: columnsLayout })}
        onLayoutChanged={remember(PANEL_GROUPS.columns)}
      >
        {showLeft && (
          <>
            <ResizablePanel
              id="left"
              panelRef={left}
              defaultSize={leftStartsCollapsed ? `${STRIP_PX}px` : DEFAULTS.sideWidth}
              minSize={DEFAULTS.sideMin}
              maxSize={DEFAULTS.sideMax}
              collapsible
              collapsedSize={`${STRIP_PX}px`}
              onResize={followCollapsed("left")}
              groupResizeBehavior="preserve-pixel-size"
            >
              {/* Kept while collapsed, so the panel chosen and the panels asked for are kept too. */}
              <section
                aria-label={t("panels.left")}
                {...{ [REGION_ATTRIBUTE]: "" }}
                className="h-full"
                hidden={collapsed.left}
              >
                {showLower ? (
                  // The tabs over the lower pane, both shown at once (ADR 0011).
                  <ResizablePanelGroup
                    id={PANEL_GROUPS.left}
                    groupRef={leftSplit}
                    orientation="vertical"
                    defaultLayout={layout[PANEL_GROUPS.left] ?? LEFT_SPLIT}
                    onLayoutChanged={remember(PANEL_GROUPS.left)}
                  >
                    <ResizablePanel id="tabs" minSize={DEFAULTS.lowerMin}>
                      <PanelTabs
                        slots={SLOTS.left}
                        editorLevel={editorLevel}
                        iconTabs
                        end={<AreaButton area="left" action="hide" />}
                      />
                    </ResizablePanel>
                    <ResizableHandle aria-label={t("panels.resizeLower")} />
                    <ResizablePanel
                      id="lower"
                      minSize={DEFAULTS.lowerMin}
                      maxSize={DEFAULTS.lowerMax}
                    >
                      <PanelTabs slots={SLOTS.leftLower} editorLevel={editorLevel} />
                    </ResizablePanel>
                  </ResizablePanelGroup>
                ) : (
                  <PanelTabs
                    slots={SLOTS.left}
                    editorLevel={editorLevel}
                    iconTabs
                    end={<AreaButton area="left" action="hide" />}
                  />
                )}
              </section>
              {collapsed.left ? (
                <PanelStrip
                  side="left"
                  editorLevel={editorLevel}
                  label={t("panels.leftCollapsed")}
                />
              ) : null}
            </ResizablePanel>
            <ResizableHandle aria-label={t("panels.resizeLeft")} />
          </>
        )}
        <ResizablePanel id="center" minSize={DEFAULTS.centerMin} className="flex flex-col">
          <ResizablePanelGroup
            id={PANEL_GROUPS.center}
            orientation="vertical"
            className="min-h-0 flex-1"
            {...(layout[PANEL_GROUPS.center] === undefined
              ? { defaultLayout: { canvas: 100, drawer: 0 } }
              : { defaultLayout: layout[PANEL_GROUPS.center] })}
            onLayoutChanged={remember(PANEL_GROUPS.center)}
          >
            <ResizablePanel id="canvas" minSize="30%" className="canvas-backdrop">
              <CanvasErrorBoundary>{center}</CanvasErrorBoundary>
            </ResizablePanel>
            <ResizableHandle aria-label={t("panels.resizeDrawer")} />
            <ResizablePanel
              id="drawer"
              panelRef={drawer}
              minSize="10%"
              maxSize="60%"
              collapsible
              onResize={(size) => setDrawerShown(size.inPixels > 0)}
            >
              {/* Kept while collapsed, as the side columns are, its bar standing in for it. */}
              <section
                aria-label={t("panels.drawer")}
                {...{ [REGION_ATTRIBUTE]: "" }}
                className="h-full"
                hidden={!drawerShown}
              >
                <PanelTabs
                  slots={SLOTS.drawer}
                  editorLevel={editorLevel}
                  end={<AreaButton area="drawer" action="hide" />}
                />
              </section>
            </ResizablePanel>
          </ResizablePanelGroup>
          {drawerShown ? null : (
            // Where the collapsed bottom panel was, the button that opens it (#1412): 32 px the
            // canvas can spare, as the side columns keep a strip.
            <nav
              aria-label={t("panels.drawerCollapsed")}
              {...{ [REGION_ATTRIBUTE]: "" }}
              className="flex h-8 shrink-0 items-center justify-end border-t border-border bg-panel px-1"
            >
              <AreaButton area="drawer" action="show" />
            </nav>
          )}
        </ResizablePanel>
        {showRight && (
          <>
            <ResizableHandle aria-label={t("panels.resizeRight")} />
            <ResizablePanel
              id="right"
              panelRef={right}
              defaultSize={DEFAULTS.sideWidth}
              minSize={DEFAULTS.sideMin}
              maxSize={DEFAULTS.sideMax}
              collapsible
              collapsedSize={`${STRIP_PX}px`}
              onResize={followCollapsed("right")}
              groupResizeBehavior="preserve-pixel-size"
            >
              {/* Kept while collapsed, so the panel chosen and the panels asked for are kept too. */}
              <section
                aria-label={t("panels.right")}
                {...{ [REGION_ATTRIBUTE]: "" }}
                className="h-full"
                hidden={collapsed.right}
              >
                <PanelTabs
                  slots={SLOTS.right}
                  editorLevel={editorLevel}
                  start={<AreaButton area="right" action="hide" />}
                />
              </section>
              {collapsed.right ? (
                <PanelStrip
                  side="right"
                  editorLevel={editorLevel}
                  label={t("panels.rightCollapsed")}
                />
              ) : null}
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </RefocusContext>
  );
}
