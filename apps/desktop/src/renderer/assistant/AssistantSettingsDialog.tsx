import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  fieldControlClass,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useEffect, useId, useState } from "react";
import {
  ASSISTANT_CONSENT_VERSION,
  type AssistantApi,
  type AssistantStatus,
} from "../../shared/ipc/assistant.js";
import { reportFailure } from "../log.js";
import { AppConsentDialog, reachOf } from "./Consent.js";
import { MonthReadout } from "./MonthReadout.js";
import { ProviderSection } from "./ProviderSection.js";

/** The monthly limit's bounds, in US dollars (ADR 0026 §5): as main checks them. */
const LIMIT = { min: 1, max: 1000 } as const;

/** Props of {@link AssistantSettingsDialog}. */
export type AssistantSettingsDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly api: Pick<
    AssistantApi,
    | "status"
    | "setEnabled"
    | "update"
    | "onEvent"
    | "signIn"
    | "finishSignIn"
    | "cancelSignIn"
    | "setKey"
  >;
};

/**
 * The app's assistant status, loaded as the dialog opens and kept by main's `status` events while
 * it's open. Forgotten as it closes: events go unheard meanwhile, so a later opening loads it anew
 * (#1005 review).
 */
function useStatus(api: AssistantSettingsDialogProps["api"], open: boolean) {
  const [status, setStatus] = useState<AssistantStatus | undefined>(undefined);
  useEffect(() => {
    if (!open) return;
    let current = true;
    const stop = api.onEvent((event) => {
      if (event.type === "status" && current) setStatus(event.status);
    });
    void api
      .status()
      .then((loaded) => {
        if (current) setStatus((now) => now ?? loaded);
      })
      .catch((error: unknown) => reportFailure("assistant.settings", error));
    return () => {
      current = false;
      stop();
      setStatus(undefined);
    };
  }, [api, open]);
  return [status, setStatus] as const;
}

/**
 * The assistant's settings (6.9c, AIA-6, AIA-8), opened from *Settings › Assistant* and the panel:
 * on or off, the consent shown before it's turned on (product/14 §5.3); where requests go and
 * signing in ({@link ProviderSection}); and the monthly limit, with this month's spend. Each acts at once in main, as AI apps' dialog does, so it isn't a part of
 * Settings, which saves on Save. *Turn Off* deletes the key from this computer.
 */
export function AssistantSettingsDialog({ open, onOpenChange, api }: AssistantSettingsDialogProps) {
  const [status, setStatus] = useStatus(api, open);
  const [asking, setAsking] = useState(false);
  const [limit, setLimit] = useState("");
  const id = useId();
  /** Calls main, keeping what it answers; a failure is logged without content. */
  const act = (call: Promise<AssistantStatus>, context: string) =>
    void call.then(setStatus).catch((error: unknown) => reportFailure(context, error));
  const typed = Number(limit);
  const limitValid =
    limit !== "" && Number.isFinite(typed) && typed >= LIMIT.min && typed <= LIMIT.max;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("assistant.settings.title")}</DialogTitle>
          <DialogDescription>{t("assistant.settings.description")}</DialogDescription>
        </DialogHeader>
        {status === undefined ? (
          <p className="m-0 text-sm text-muted-foreground">{t("assistant.loading")}</p>
        ) : (
          <div className="flex flex-col gap-4 text-sm">
            <section aria-labelledby={`${id}-on`} className="flex flex-wrap items-center gap-2">
              <h3 id={`${id}-on`} className="m-0 flex-1 text-sm font-semibold">
                {t(status.enabled ? "assistant.settings.on" : "assistant.settings.off")}
              </h3>
              {status.enabled ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    act(api.setEnabled(false, ASSISTANT_CONSENT_VERSION), "assistant.off")
                  }
                >
                  {t("assistant.settings.turnOff")}
                </Button>
              ) : (
                <Button size="sm" onClick={() => setAsking(true)}>
                  {t("assistant.settings.turnOn")}
                </Button>
              )}
              <p className="m-0 w-full text-xs text-muted-foreground">
                {t(status.enabled ? "assistant.settings.onHint" : "assistant.settings.offHint")}
              </p>
            </section>
            <ProviderSection status={status} api={api} onStatus={setStatus} />
            <section aria-labelledby={`${id}-limit`} className="flex flex-col gap-2">
              <h3 id={`${id}-limit`} className="m-0 text-sm font-semibold">
                {t("assistant.settings.limit")}
              </h3>
              <MonthReadout month={status.month} />
              <form
                className="flex items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!limitValid) return;
                  act(api.update({ monthlyLimitUsd: typed }), "assistant.limit");
                  setLimit("");
                }}
              >
                <label className="flex flex-col gap-1 text-xs">
                  {t("assistant.settings.limitField")}
                  <input
                    type="number"
                    inputMode="decimal"
                    min={LIMIT.min}
                    max={LIMIT.max}
                    step={1}
                    value={limit}
                    placeholder={String(status.month.limitUsd)}
                    aria-describedby={`${id}-limit-hint`}
                    className={`${fieldControlClass} w-28`}
                    onChange={(event) => setLimit(event.currentTarget.value)}
                  />
                </label>
                <Button size="sm" type="submit" disabled={!limitValid}>
                  {t("assistant.settings.setLimit")}
                </Button>
              </form>
              <p id={`${id}-limit-hint`} className="m-0 text-xs text-muted-foreground">
                {t("assistant.settings.limitHint")}
              </p>
            </section>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("assistant.settings.close")}
          </Button>
        </DialogFooter>
        {status === undefined ? null : (
          <AppConsentDialog
            open={asking}
            reach={reachOf(status)}
            onAgree={() => {
              setAsking(false);
              act(api.setEnabled(true, ASSISTANT_CONSENT_VERSION), "assistant.enable");
            }}
            onCancel={() => setAsking(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
