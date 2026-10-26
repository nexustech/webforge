import { t } from "@webforge/i18n";
import {
  CloudUploadIcon,
  DownloadIcon,
  EyeIcon,
  FilePlusIcon,
  FolderOpenIcon,
  Redo2Icon,
  Undo2Icon,
} from "lucide-react";
import { type ReactNode, useEffect } from "react";
import type { AppApi } from "../../shared/ipc/app.js";
import { TITLE_BAR_HEIGHT } from "../../shared/title-bar.js";
import { AppMenu } from "./AppMenu.js";
import { CommandBox } from "./CommandBox.js";
import { CommandButton } from "./CommandButton.js";
import { useCommandRegistry } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import { syncNativeMenus } from "./native-menus.js";

/** Props of {@link TitleBar}. */
export type TitleBarProps = {
  readonly siteName: string;
  /** The save status ("Saved", "Saving…"), contributed by autosave (1.6). */
  readonly saveStatus?: ReactNode;
  /** The latest steps to undo, beside Undo (UX-16), contributed by the open site. */
  readonly undoSteps?: ReactNode;
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
 * The 40 px custom title bar (UI1, LF-13, {@link TITLE_BAR_HEIGHT}): app menu, New and Open, save status, Undo (with its
 * latest steps) and Redo, the command box with the site name, then panel tools and the
 * colour-coded Preview, Export and Publish, which get a caret once there is more to choose. Its
 * buttons are icons, each named by its command and with a tooltip that gives the shortcut. The
 * empty parts drag the window. The native window controls (Windows, Linux) or traffic lights
 * (macOS) are drawn over it by Electron; the padding keeps them clear, using the Window Controls
 * Overlay area the window reports.
 */
export function TitleBar({ siteName, saveStatus, undoSteps, tools, menuBar }: TitleBarProps) {
  const registry = useCommandRegistry();
  useEffect(
    () => (menuBar === undefined ? undefined : syncNativeMenus(registry, menuBar)),
    [registry, menuBar],
  );
  return (
    <header
      data-slot="title-bar"
      // As tall as the native window controls, whatever the type scale makes a rem (#484).
      style={{ height: TITLE_BAR_HEIGHT }}
      className="flex shrink-0 items-center gap-2 border-b border-border-strong bg-titlebar pr-[calc(100vw-env(titlebar-area-x,0px)-env(titlebar-area-width,100vw))] pl-[max(env(titlebar-area-x,0px),4px)] select-none [-webkit-app-region:drag]"
    >
      {/* The window's heading for screen readers; the window title says the same. */}
      <h1 className="sr-only">{t("app.name")}</h1>
      <div className={`flex items-center gap-0.5 ${NO_DRAG}`}>
        {menuBar === undefined ? <AppMenu /> : null}
        <CommandButton
          commandId={COMMAND_IDS.newSite}
          icon={<FilePlusIcon />}
          label={t("shell.new")}
        />
        <CommandButton
          commandId={COMMAND_IDS.openSite}
          icon={<FolderOpenIcon className="text-warning" />}
          label={t("shell.open")}
        />
        {saveStatus}
        <div className="mx-1 h-5 w-px bg-border" aria-hidden />
        <CommandButton commandId={COMMAND_IDS.undo} icon={<Undo2Icon />} label={t("editor.undo")} />
        {undoSteps}
        <CommandButton commandId={COMMAND_IDS.redo} icon={<Redo2Icon />} label={t("editor.redo")} />
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
        <CommandButton
          commandId={COMMAND_IDS.preview}
          icon={<EyeIcon className="text-info" />}
          label={t("shell.preview")}
        />
        <CommandButton
          commandId={COMMAND_IDS.exportSite}
          icon={<DownloadIcon className="text-success" />}
          label={t("shell.export")}
        />
        <CommandButton
          commandId={COMMAND_IDS.publish}
          icon={<CloudUploadIcon className="text-publish" />}
          label={t("shell.publish")}
        />
      </div>
    </header>
  );
}
