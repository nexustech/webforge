import {
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
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { type ReactNode, type RefObject, useEffect, useRef } from "react";
import type { Preferences } from "../../shared/ipc-contract.js";
import { useCommandRegistry } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import { usePanels } from "./panel-context.js";
import { type PanelSlot, panelsInSlot } from "./panels.js";

/** The panel groups whose sizes are remembered, by id. */
export const PANEL_GROUPS = {
  columns: "shell.columns",
  left: "shell.left",
  center: "shell.center",
  right: "shell.right",
} as const;

/** UI1's default layout: 300 px side columns, each split 60/40, the drawer closed. */
const DEFAULTS = {
  sideWidth: "300px",
  split: { top: 60, bottom: 40 },
  drawer: "25%",
} as const;

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

/** One slot's panels as tabs, or an empty state when no area has put a panel there yet. */
function PanelSlotView({
  slot,
  editorLevel,
}: {
  readonly slot: PanelSlot;
  readonly editorLevel: Preferences["editorLevel"];
}) {
  const panels = panelsInSlot(usePanels(), slot, editorLevel);
  const first = panels[0];
  if (first === undefined) {
    return (
      <div className="flex h-full items-center justify-center bg-panel p-4 text-center text-xs text-muted-foreground">
        {t("panels.empty")}
      </div>
    );
  }
  return (
    <Tabs key={panels.map((panel) => panel.id).join()} defaultValue={first.id} className="h-full">
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
 * collapsible columns. Sizes are remembered per person, and Reset Panels restores the defaults.
 * Areas fill the slots with `registerPanel`.
 */
export function ShellLayout({ center, layout, onLayoutChange, editorLevel }: ShellLayoutProps) {
  const registry = useCommandRegistry();
  const left = useRef<ResizablePanelHandle | null>(null);
  const right = useRef<ResizablePanelHandle | null>(null);
  const drawer = useRef<ResizablePanelHandle | null>(null);
  const leftSplit = useRef<ResizablePanelGroupHandle | null>(null);
  const rightSplit = useRef<ResizablePanelGroupHandle | null>(null);

  useEffect(() => {
    const removers = [
      registry.register({
        id: COMMAND_IDS.toggleLeftPanels,
        label: t("command.toggleLeftPanels"),
        menu: "view",
        shortcut: "Mod+Alt+B",
        run: () => toggle(left.current, DEFAULTS.sideWidth),
      }),
      registry.register({
        id: COMMAND_IDS.toggleRightPanels,
        label: t("command.toggleRightPanels"),
        menu: "view",
        run: () => toggle(right.current, DEFAULTS.sideWidth),
      }),
      registry.register({
        id: COMMAND_IDS.toggleDrawer,
        label: t("command.toggleDrawer"),
        menu: "view",
        shortcut: "Mod+J",
        run: () => toggle(drawer.current, DEFAULTS.drawer),
      }),
      registry.register({
        id: COMMAND_IDS.resetPanels,
        label: t("command.resetPanels"),
        menu: "view",
        run: () => {
          for (const column of [left.current, right.current]) {
            column?.expand();
            column?.resize(DEFAULTS.sideWidth);
          }
          drawer.current?.collapse();
          leftSplit.current?.setLayout({ "left.top": 60, "left.bottom": 40 });
          rightSplit.current?.setLayout({ "right.top": 60, "right.bottom": 40 });
        },
      }),
    ];
    return () => {
      for (const remove of removers) remove();
    };
  }, [registry]);

  /** Saves a group's sizes when they settle, unless they're what was saved already. */
  const remember =
    (groupId: string) =>
    (
      current: ResizableLayout,
      meta: { readonly requestedLayout?: ResizableLayout | undefined },
    ) => {
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

  const split = (
    groupId: string,
    side: "left" | "right",
    groupRef: RefObject<ResizablePanelGroupHandle | null>,
  ) => (
    <ResizablePanelGroup
      id={groupId}
      orientation="vertical"
      groupRef={groupRef}
      {...(layout[groupId] === undefined ? {} : { defaultLayout: layout[groupId] })}
      onLayoutChanged={remember(groupId)}
    >
      <ResizablePanel id={`${side}.top`} defaultSize={`${DEFAULTS.split.top}%`} minSize="15%">
        <PanelSlotView slot={`${side}.top`} editorLevel={editorLevel} />
      </ResizablePanel>
      <ResizableHandle
        aria-label={t(side === "left" ? "panels.resizeLeftSplit" : "panels.resizeRightSplit")}
      />
      <ResizablePanel id={`${side}.bottom`} defaultSize={`${DEFAULTS.split.bottom}%`} minSize="15%">
        <PanelSlotView slot={`${side}.bottom`} editorLevel={editorLevel} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );

  return (
    <ResizablePanelGroup
      id={PANEL_GROUPS.columns}
      orientation="horizontal"
      className="bg-panel-group"
      {...(layout[PANEL_GROUPS.columns] === undefined
        ? {}
        : { defaultLayout: layout[PANEL_GROUPS.columns] })}
      onLayoutChanged={remember(PANEL_GROUPS.columns)}
    >
      <ResizablePanel
        id="left"
        panelRef={left}
        defaultSize={DEFAULTS.sideWidth}
        minSize="200px"
        maxSize="40%"
        collapsible
        groupResizeBehavior="preserve-pixel-size"
      >
        <section aria-label={t("panels.left")} className="h-full">
          {split(PANEL_GROUPS.left, "left", leftSplit)}
        </section>
      </ResizablePanel>
      <ResizableHandle aria-label={t("panels.resizeLeft")} />
      <ResizablePanel id="center" minSize="30%">
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
              <PanelSlotView slot="drawer" editorLevel={editorLevel} />
            </section>
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
      <ResizableHandle aria-label={t("panels.resizeRight")} />
      <ResizablePanel
        id="right"
        panelRef={right}
        defaultSize={DEFAULTS.sideWidth}
        minSize="200px"
        maxSize="40%"
        collapsible
        groupResizeBehavior="preserve-pixel-size"
      >
        <section aria-label={t("panels.right")} className="h-full">
          {split(PANEL_GROUPS.right, "right", rightSplit)}
        </section>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
