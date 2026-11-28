import {
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";
import type { PhoneAddress } from "../../shared/ipc/preview.js";
import { HelpButton } from "../help/index.js";
import { QrCode } from "./QrCode.js";

/** What the phone dialog shows: closed, starting the preview, its address, or why there is none. */
export type PhoneState =
  | { readonly status: "closed" }
  | { readonly status: "starting" }
  | PhoneAddress
  | { readonly status: "failed" };

/**
 * File → Preview on Phone… (3.2, F-PV-1): the preview's address on the local network as a QR code
 * for the phone's camera, with the address written out, and what a phone needs to open it. Who
 * else can open it is said too: anyone on the network with the address, while Webforge is open.
 * While a phone can open it, Stop Phone Preview is there too (`onStop`, #1438): the title bar's
 * cue, an icon in a narrow window, opens this dialog for it.
 */
export function PhonePreviewDialog({
  state,
  onStop,
}: {
  readonly state: StoreApi<PhoneState>;
  /** Stops the phone's preview: Stop Phone Preview, which closes the dialog too. */
  readonly onStop: () => void;
}) {
  const shown = useSyncExternalStore(state.subscribe, state.getState, state.getState);
  return (
    <Dialog
      open={shown.status !== "closed"}
      onOpenChange={(open) => {
        if (!open) state.setState({ status: "closed" }, true);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("preview.phone.title")}</DialogTitle>
          <DialogDescription>
            {shown.status === "offline"
              ? t("preview.phone.offline")
              : shown.status === "failed"
                ? t("preview.phone.failed")
                : t("preview.phone.description")}
          </DialogDescription>
        </DialogHeader>
        {shown.status === "starting" ? (
          <p className="py-8 text-center text-sm text-muted-foreground" role="status">
            {t("preview.phone.starting")}
          </p>
        ) : null}
        {shown.status === "ready" ? (
          <div className="flex flex-col items-center gap-3">
            <QrCode
              text={shown.url}
              label={t("preview.phone.qrLabel")}
              className="size-52 rounded-md"
            />
            <p className="text-center text-xs text-muted-foreground">
              {t("preview.phone.address")}
              <br />
              <span className="font-mono text-foreground break-all select-all">{shown.url}</span>
            </p>
            <p className="text-xs text-muted-foreground">{t("preview.phone.privacy")}</p>
          </div>
        ) : null}
        {/* Stop Phone Preview while it runs, then Close, which leaves it running (#1444). */}
        <DialogFooter>
          {shown.status === "ready" ? (
            <Button variant="outline" onClick={onStop}>
              {t("command.stopPhonePreview")}
            </Button>
          ) : null}
          <DialogCloseButton />
        </DialogFooter>
        {/* Last, so the dialog's own first control still takes the focus as it opens. */}
        <HelpButton topic="phonePreview" className="absolute top-2.5 right-9" />
      </DialogContent>
    </Dialog>
  );
}
