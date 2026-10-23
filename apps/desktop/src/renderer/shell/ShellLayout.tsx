import {
  ResizableHandle,
  type ResizableLayout,
  ResizablePanel,
  ResizablePanelGroup,
  type ResizablePanelHandle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Preferences } from "../../shared/ipc-contract.js";
import { useCommandRegistry } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import { usePanelRegistry, usePanels } from "./panel-context.js";
import { type PanelSlot, panelsInSlot } from "./panels.js";

/** The panel groups whose sizes are remembered, by id. */
export const PANEL_GROUPS = {
  columns: "shell.columns",
  center: "shell.center",
} as const;

/**
 * The default layout: 240 px side columns, the drawer closed. Side columns stay between 200 and
 * 360 px and the canvas keeps at least 40% of the width, so it is never squeezed to an unusable
 * zoom (ADR 0008).
 */
/** How wide a collapsed side column stays: a strip of its panels' icons (UX-13). */
const STRIP_PX = 36;

const DEFAULTS = {
  sideWidth: "240px",
  sideMin: "200px",
  sideMax: "360px",
  centerMin: "40%",
  drawer: "25%",
} as const;

/** The slots each part of the window shows, top slot first. */
const SLOTS = {
  left: ["left.top", "left.bottom"],
  right: ["right.top", "right.bottom"],
  drawer: ["drawer"],
} as const satisfies Record<string, readonly PanelSlot[]>;

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
 * The panels of some slots as tabs, one shown at a time, or an empty state when no area has put a
 * panel there yet. A side column shows its top slot's panels first, then its bottom slot's.
 */
function PanelTabs({
  slots,
  editorLevel,
}: {
  readonly slots: readonly PanelSlot[];
  readonly editorLevel: Preferences["editorLevel"];
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
  const first = panels[0];
  if (first === undefined) {
    return (
      <div className="flex h-full items-center justify-center bg-panel p-4 text-center text-xs text-muted-foreground">
        {t("panels.empty")}
      </div>
    );
  }
  return (
    <Tabs
      value={panels.some((panel) => panel.id === chosen) ? (chosen ?? first.id) : first.id}
      onValueChange={setChosen}
      className="h-full"
    >
      <TabsList>
        {panels.map((panel) => (
          <TabsTrigger key={panel.id} value={panel.id}>
            {panel.title}
          </TabsTrigger>
        ))}
      </TabsList>
      {panels.map((panel) => (
        <TabsContent key={panel.id} value={panel.id} className="overflow-auto">
          <panel.component />
        </TabsContent>
      ))}
    </Tabs>
  );
}

/**
 * What a collapsed side column leaves (UX-13): a strip with a button for each of its panels, which
 * opens the column at that panel.
 */
function PanelStrip({
  slots,
  editorLevel,
  label,
}: {
  readonly slots: readonly PanelSlot[];
  readonly editorLevel: Preferences["editorLevel"];
  readonly label: string;
}) {
  const registry = usePanelRegistry();
  const registered = usePanels();
  const panels = slots.flatMap((slot) => panelsInSlot(registered, slot, editorLevel));
  return (
    <nav aria-label={label} className="flex h-full flex-col items-center gap-1 bg-panel py-2">
      {panels.map((panel) => (
        <button
          key={panel.id}
          type="button"
          aria-label={panel.title}
          title={panel.title}
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
  /**
   * When the person last asked for a layout change through a command (toggle, Reset Panels).
   * Only their own changes are saved: the library also reports automatic ones, such as the first
   * layout or a column appearing when an area adds its first panel.
   */
  const commandAt = useRef(Number.NEGATIVE_INFINITY);
  const panelRegistry = usePanelRegistry();
  const panels = usePanels();
  const hasPanels = (side: "left" | "right") =>
    panelsInSlot(panels, `${side}.top`, editorLevel).length > 0 ||
    panelsInSlot(panels, `${side}.bottom`, editorLevel).length > 0;
  const showLeft = hasPanels("left");
  const showRight = hasPanels("right");
  // Which side columns are collapsed to their strip, from the sizes the library reports.
  const [collapsed, setCollapsed] = useState({ left: false, right: false });
  const followCollapsed = (side: "left" | "right") => (size: { readonly inPixels: number }) => {
    const next = size.inPixels <= STRIP_PX + 1;
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
        shortcut: "Mod+Alt+B",
        run: byCommand(() => toggle(left.current, DEFAULTS.sideWidth)),
      }),
      registry.register({
        id: COMMAND_IDS.toggleRightPanels,
        label: t("command.toggleRightPanels"),
        menu: "view",
        run: byCommand(() => toggle(right.current, DEFAULTS.sideWidth)),
      }),
      registry.register({
        id: COMMAND_IDS.toggleDrawer,
        label: t("command.toggleDrawer"),
        menu: "view",
        shortcut: "Mod+J",
        run: byCommand(() => toggle(drawer.current, DEFAULTS.drawer)),
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
        }),
      }),
    ];
    return () => {
      for (const remove of removers) remove();
    };
  }, [registry]);

  // A panel asked for is shown even if its column is collapsed.
  useEffect(
    () =>
      panelRegistry.onShow((id) => {
        for (const [side, column] of [
          ["left", left.current],
          ["right", right.current],
          ["drawer", drawer.current],
        ] as const) {
          const holds = SLOTS[side].some((slot) =>
            panelsInSlot(panelRegistry.list(), slot, editorLevel).some((panel) => panel.id === id),
          );
          if (holds && column?.isCollapsed() === true) {
            toggle(column, side === "drawer" ? DEFAULTS.drawer : DEFAULTS.sideWidth);
          }
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
            defaultSize={DEFAULTS.sideWidth}
            minSize={DEFAULTS.sideMin}
            maxSize={DEFAULTS.sideMax}
            collapsible
            collapsedSize={`${STRIP_PX}px`}
            onResize={followCollapsed("left")}
            groupResizeBehavior="preserve-pixel-size"
          >
            {/* Kept while collapsed, so the panel chosen and the panels asked for are kept too. */}
            <section aria-label={t("panels.left")} className="h-full" hidden={collapsed.left}>
              <PanelTabs slots={SLOTS.left} editorLevel={editorLevel} />
            </section>
            {collapsed.left ? (
              <PanelStrip
                slots={SLOTS.left}
                editorLevel={editorLevel}
                label={t("panels.leftCollapsed")}
              />
            ) : null}
          </ResizablePanel>
          <ResizableHandle aria-label={t("panels.resizeLeft")} />
        </>
      )}
      <ResizablePanel id="center" minSize={DEFAULTS.centerMin}>
        <ResizablePanelGroup
          id={PANEL_GROUPS.center}
          orientation="vertical"
          {...(layout[PANEL_GROUPS.center] === undefined
            ? { defaultLayout: { canvas: 100, drawer: 0 } }
            : { defaultLayout: layout[PANEL_GROUPS.center] })}
          onLayoutChanged={remember(PANEL_GROUPS.center)}
        >
          <ResizablePanel id="canvas" minSize="30%" className="canvas-backdrop">
            {center}
          </ResizablePanel>
          <ResizableHandle aria-label={t("panels.resizeDrawer")} />
          <ResizablePanel id="drawer" panelRef={drawer} minSize="10%" maxSize="60%" collapsible>
            <section aria-label={t("panels.drawer")} className="h-full">
              <PanelTabs slots={SLOTS.drawer} editorLevel={editorLevel} />
            </section>
          </ResizablePanel>
        </ResizablePanelGroup>
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
            <section aria-label={t("panels.right")} className="h-full" hidden={collapsed.right}>
              <PanelTabs slots={SLOTS.right} editorLevel={editorLevel} />
            </section>
            {collapsed.right ? (
              <PanelStrip
                slots={SLOTS.right}
                editorLevel={editorLevel}
                label={t("panels.rightCollapsed")}
              />
            ) : null}
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}
