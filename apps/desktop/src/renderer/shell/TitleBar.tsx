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
import type { ReactNode } from "react";
import { AppMenu } from "./AppMenu.js";
import { CommandBox } from "./CommandBox.js";
import { CommandButton } from "./CommandButton.js";

/** Ids of the commands the title bar has buttons for; areas register them. */
export const TITLE_BAR_COMMANDS = {
  newSite: "site.new",
  openSite: "site.open",
  undo: "edit.undo",
  redo: "edit.redo",
  preview: "site.preview",
  exportSite: "site.export",
  publish: "site.publish",
} as const;

/** Props of {@link TitleBar}. */
export type TitleBarProps = {
  readonly siteName: string;
  /** The save status ("Saved", "Saving…"), contributed by autosave (1.6). */
  readonly saveStatus?: ReactNode;
  /** Panel toggles and the Design | Content switch, before the site actions. */
  readonly tools?: ReactNode;
};

/** Areas the window controls cover; buttons and fields there must stay clickable. */
const NO_DRAG = "[-webkit-app-region:no-drag]";

/**
 * The 40 px custom title bar (UI1): app menu, New and Open, save status, Undo and Redo, the
 * command box with the site name, then panel tools and the colour-coded Preview, Export and
 * Publish. The empty parts drag the window. The native window controls (Windows, Linux) or traffic
 * lights (macOS) are drawn over it by Electron; the padding keeps them clear, using the Window
 * Controls Overlay area the window reports.
 */
export function TitleBar({ siteName, saveStatus, tools }: TitleBarProps) {
  return (
    <header
      data-slot="title-bar"
      className="flex h-10 shrink-0 items-center gap-2 border-b border-border-strong bg-titlebar pr-[calc(100vw-env(titlebar-area-x,0px)-env(titlebar-area-width,100vw))] pl-[max(env(titlebar-area-x,0px),4px)] select-none [-webkit-app-region:drag]"
    >
      {/* The window's heading for screen readers; the window title says the same. */}
      <h1 className="sr-only">{t("app.name")}</h1>
      <div className={`flex items-center gap-0.5 ${NO_DRAG}`}>
        <AppMenu />
        <CommandButton
          commandId={TITLE_BAR_COMMANDS.newSite}
          icon={<FilePlusIcon />}
          text={t("shell.new")}
        />
        <CommandButton
          commandId={TITLE_BAR_COMMANDS.openSite}
          icon={<FolderOpenIcon className="text-warning" />}
          text={t("shell.open")}
        />
        {saveStatus}
        <div className="mx-1 h-5 w-px bg-border" aria-hidden />
        <CommandButton commandId={TITLE_BAR_COMMANDS.undo} icon={<Undo2Icon />} />
        <CommandButton commandId={TITLE_BAR_COMMANDS.redo} icon={<Redo2Icon />} />
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
          commandId={TITLE_BAR_COMMANDS.preview}
          icon={<EyeIcon className="text-info" />}
          text={t("shell.preview")}
        />
        <CommandButton
          commandId={TITLE_BAR_COMMANDS.exportSite}
          icon={<DownloadIcon className="text-success" />}
          text={t("shell.export")}
        />
        <CommandButton
          commandId={TITLE_BAR_COMMANDS.publish}
          icon={<CloudUploadIcon className="text-publish" />}
          text={t("shell.publish")}
        />
      </div>
    </header>
  );
}
