import { t } from "@webforge/i18n";
import {
  CloudUploadIcon,
  DownloadIcon,
  EyeIcon,
  FilePlusIcon,
  FolderOpenIcon,
  ListChecksIcon,
  Redo2Icon,
  Undo2Icon,
} from "lucide-react";
import { type ReactNode, useEffect } from "react";
import type { AppApi } from "../../shared/ipc/app.js";
import { TITLE_BAR_HEIGHT } from "../../shared/title-bar.js";
import { AppMenu } from "./AppMenu.js";
import { CommandBox } from "./CommandBox.js";
import { CommandButton } from "./CommandButton.js";
import { useCommand, useCommandRegistry } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import { syncNativeMenus } from "./native-menus.js";
import { PhonePreviewCue } from "./PhonePreviewCue.js";
import { REGION_ATTRIBUTE } from "./regions.js";

/** Props of {@link TitleBar}. */
export type TitleBarProps = {
  readonly siteName: string;
  /** The save status ("Saved", "Saving…"), contributed by autosave (1.6). */
  readonly saveStatus?: ReactNode;
  /** The latest steps to undo, beside Undo (UX-16), contributed by the open site. */
  readonly undoSteps?: ReactNode;
  /** Whether an AI app is connected (F-AI-1, 4.9), contributed by AI apps: nothing while none is. */
  readonly aiStatus?: ReactNode;
  /** Panel toggles and the Design | Content switch, before the site actions. */
  readonly tools?: ReactNode;
  /**
   * The system's menu bar, to show the menus in instead of the title bar (macOS, LF-13); the title
   * bar's own when left out.
   */
  readonly menuBar?: Pick<AppApi, "setNativeMenus" | "onRunCommand"> | undefined;
};

/** Areas the window controls cover; buttons and fields there must stay clickable. */
const NO_DRAG = "[-webkit-app-region:no-drag]";

/**
 * The 40 px custom title bar (UI1, LF-13, {@link TITLE_BAR_HEIGHT}): app menu, New and Open, save
 * status, Undo (with its latest steps) and Redo, the command box with the site name, then panel
 * tools, Site Check, and Preview, Export and Publish, which get a caret once there is more to
 * choose. Its buttons are icons, each named by its command and with a tooltip that gives the
 * shortcut. Site Check shows what it found and Publish its name at every width (#1166); while the
 * title bar is wide, Preview and Export show theirs too, Publish filled (#1009). A button shows once its command is registered: the
 * start screen has no Undo, Site Check or Publish (#1009).
 * The empty parts drag the window. The native window controls (Windows, Linux) or traffic lights
 * (macOS) are drawn over it by Electron; the padding keeps them clear, using the Window Controls
 * Overlay area the window reports. Its container is the whole window's width, padding and all.
 */
export function TitleBar({
  siteName,
  saveStatus,
  undoSteps,
  aiStatus,
  tools,
  menuBar,
}: TitleBarProps) {
  const registry = useCommandRegistry();
  // Nothing to set apart on the start screen, where there's no Undo or Redo (#1009).
  const undo = useCommand(COMMAND_IDS.undo);
  const redo = useCommand(COMMAND_IDS.redo);
  useEffect(
    () => (menuBar === undefined ? undefined : syncNativeMenus(registry, menuBar)),
    [registry, menuBar],
  );
  return (
    // Its container: Site Check, Preview, Export and Publish show their text while it's wide.
    <div className="@container/title-bar shrink-0">
      <header
        data-slot="title-bar"
        {...{ [REGION_ATTRIBUTE]: "" }}
        // As tall as the native window controls, whatever the type scale makes a rem (#484).
        style={{ height: TITLE_BAR_HEIGHT }}
        className="flex shrink-0 items-center gap-2 border-b border-border-strong bg-titlebar pr-[max(calc(100vw-env(titlebar-area-x,0px)-env(titlebar-area-width,100vw)),4px)] pl-[max(env(titlebar-area-x,0px),4px)] select-none [-webkit-app-region:drag]"
      >
        {/* The window's heading for screen readers; the window title says the same. */}
        <h1 className="sr-only">{t("app.name")}</h1>
        <div className={`flex items-center gap-0.5 ${NO_DRAG}`}>
          {menuBar === undefined ? <AppMenu /> : null}
          <CommandButton commandId={COMMAND_IDS.newSite} icon={<FilePlusIcon />} />
          <CommandButton
            commandId={COMMAND_IDS.openSite}
            icon={<FolderOpenIcon className="text-warning" />}
          />
          {saveStatus}
          {aiStatus}
          {undo === undefined && redo === undefined ? null : (
            <div className="mx-1 h-5 w-px bg-border" aria-hidden />
          )}
          <CommandButton commandId={COMMAND_IDS.undo} icon={<Undo2Icon />} />
          {undoSteps}
          <CommandButton commandId={COMMAND_IDS.redo} icon={<Redo2Icon />} />
        </div>
        <div className="flex min-w-0 flex-1 justify-center">
          <div className={`flex w-full max-w-md justify-center ${NO_DRAG}`}>
            <CommandBox siteName={siteName} />
          </div>
        </div>
        {/* biome-ignore lint/a11y/useSemanticElements: a toolbar of buttons, not a form group. */}
        <div
          role="group"
          aria-label={t("shell.actions")}
          className={`flex items-center gap-0.5 ${NO_DRAG}`}
        >
          {tools}
          <PhonePreviewCue />
          {/* What Site Check found, "5 to fix · 13 tips": it opens the panel (#1009). */}
          {/* Its count shows at every width, as Publish's name does (#1166). */}
          <CommandButton commandId={COMMAND_IDS.siteCheck} icon={<ListChecksIcon />} alwaysText />
          <CommandButton
            commandId={COMMAND_IDS.preview}
            icon={<EyeIcon className="text-info" />}
            text={t("shell.preview")}
          />
          <CommandButton
            commandId={COMMAND_IDS.exportSite}
            icon={<DownloadIcon className="text-success" />}
            text={t("shell.export")}
          />
          <CommandButton
            commandId={COMMAND_IDS.publish}
            icon={<CloudUploadIcon />}
            text={t("shell.publish")}
            alwaysText
            variant="default"
          />
        </div>
      </header>
    </div>
  );
}
