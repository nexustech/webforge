import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  fieldControlClass,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useEffect, useId, useState } from "react";
import type { AssistantApi, AssistantModel, AssistantStatus } from "../../shared/ipc/assistant.js";
import { reportFailure } from "../log.js";
import { errorKey } from "./ConversationView.js";
import { money } from "./money.js";
import { type SignInStatus, signInKey } from "./sign-in-words.js";

/** Props of {@link ModelSection}. */
export type ModelSectionProps = {
  readonly status: AssistantStatus;
  readonly api: Pick<AssistantApi, "models" | "update" | "setKey">;
  readonly onStatus: (status: AssistantStatus) => void;
};

/** A model as the list names it: its name and maker, its rough cost a reply, and *tested*. */
function labelOf(model: AssistantModel): string {
  const parts = [model.maker === null ? model.name : `${model.name}, ${model.maker}`];
  if (model.perReplyUsd !== null) {
    parts.push(t("assistant.model.perReply", { cost: money(model.perReplyUsd) }));
  }
  if (model.tested) parts.push(t("assistant.model.tested"));
  return parts.join(" · ");
}

/**
 * Which model answers (AIA-8, ADR 0026 §2), in the assistant's settings: the provider's models, the
 * ones Webforge has tested marked, each with its rough cost a reply; one over the price threshold
 * asks once before it's chosen. *Advanced* allows models that may keep requests, after a warning
 * (AIA-7), and takes an OpenRouter key pasted instead of signing in (AIA-1).
 */
export function ModelSection({ status, api, onStatus }: ModelSectionProps) {
  const id = useId();
  const [models, setModels] = useState<readonly AssistantModel[] | string | undefined>(undefined);
  const [pricey, setPricey] = useState<AssistantModel | undefined>(undefined);
  const [warning, setWarning] = useState(false);
  const [key, setKey] = useState("");
  const [said, setSaid] = useState<SignInStatus | undefined>(undefined);
  const ready = status.provider.kind !== "openrouter" || status.provider.signedIn;
  const { kind } = status.provider;
  const allowing = status.allowRetainingModels;
  // The list again whenever the provider, the sign-in or what it may offer changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: main's list depends on `kind` and `allowing`, which the effect doesn't read.
  useEffect(() => {
    if (!ready) return;
    let current = true;
    void api
      .models()
      .then((answer) => {
        if (current) setModels(answer.status === "ok" ? answer.models : answer.status);
      })
      .catch((error: unknown) => {
        reportFailure("assistant.models", error);
        if (current) setModels("failed");
      });
    return () => {
      current = false;
    };
  }, [api, ready, kind, allowing]);
  /** Changes a setting in main, keeping the status it answers. */
  const change = (settings: Parameters<AssistantApi["update"]>[0]) =>
    void api
      .update(settings)
      .then(onStatus)
      .catch((error: unknown) => reportFailure("assistant.model", error));
  const choose = (model: AssistantModel) => {
    if (model.pricey) setPricey(model);
    else change({ modelId: model.id });
  };
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-2">
      <h3 id={`${id}-title`} className="m-0 text-sm font-semibold">
        {t("assistant.model.title")}
      </h3>
      {!ready ? (
        <p className="m-0 text-xs text-muted-foreground">{t("assistant.model.signInFirst")}</p>
      ) : models === undefined ? (
        <p className="m-0 text-xs text-muted-foreground">{t("assistant.loading")}</p>
      ) : typeof models === "string" ? (
        <p role="alert" className="m-0 text-xs text-destructive-text">
          {t(errorKey(models))}
        </p>
      ) : (
        <label className="flex flex-col gap-1 text-xs">
          {t("assistant.model.field")}
          <select
            value={status.model?.id ?? ""}
            className={fieldControlClass}
            onChange={(event) => {
              const model = models.find((each) => each.id === event.currentTarget.value);
              if (model !== undefined) choose(model);
            }}
          >
            {status.model === null ? <option value="">{t("assistant.model.none")}</option> : null}
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {labelOf(model)}
              </option>
            ))}
          </select>
        </label>
      )}
      <details className="text-xs">
        <summary className="cursor-pointer">{t("assistant.model.advanced")}</summary>
        <div className="mt-2 flex flex-col gap-2">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={status.allowRetainingModels}
              className="mt-0.5 accent-primary"
              onChange={(event) => {
                if (event.currentTarget.checked) setWarning(true);
                else change({ allowRetainingModels: false });
              }}
            />
            <span className="flex flex-col">
              {t("assistant.model.allowRetaining")}
              <span className="text-muted-foreground">
                {t("assistant.model.allowRetainingHint")}
              </span>
            </span>
          </label>
          {status.provider.kind === "openrouter" ? (
            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setSaid(undefined);
                void api
                  .setKey(key)
                  .catch((error: unknown) => {
                    reportFailure("assistant.key", error);
                    return { status: "failed" as const };
                  })
                  .then((result) => setSaid(result.status));
                setKey("");
              }}
            >
              <label className="flex flex-1 flex-col gap-1">
                {t("assistant.model.openRouterKey")}
                <input
                  type="password"
                  value={key}
                  autoComplete="off"
                  className={fieldControlClass}
                  onChange={(event) => setKey(event.currentTarget.value)}
                />
              </label>
              <Button size="sm" type="submit" disabled={key === ""}>
                {t("assistant.provider.saveKey")}
              </Button>
            </form>
          ) : null}
          {said === undefined ? null : (
            <p role="status" className="m-0">
              {t(signInKey(said))}
            </p>
          )}
        </div>
      </details>
      <AlertDialog
        open={pricey !== undefined}
        onOpenChange={(open) => open || setPricey(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("assistant.model.priceyTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("assistant.model.priceyBody", {
                model: pricey?.name ?? "",
                cost: money(pricey?.perReplyUsd ?? 0),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("assistant.model.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pricey !== undefined) change({ modelId: pricey.id });
                setPricey(undefined);
              }}
            >
              {t("assistant.model.usePricey")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={warning} onOpenChange={setWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("assistant.model.retainingTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("assistant.model.retainingBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("assistant.model.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                change({ allowRetainingModels: true });
                setWarning(false);
              }}
            >
              {t("assistant.model.allowRetainingConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
