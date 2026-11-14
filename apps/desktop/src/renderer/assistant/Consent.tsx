import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useId } from "react";
import type { AssistantStatus } from "../../shared/ipc/assistant.js";

/**
 * Where the assistant's requests go (ADR 0026 §2's `Reach`), and who receives them: OpenRouter and
 * the model's maker, a server the person named, or a model on this computer.
 */
export type ConsentReach =
  | { readonly kind: "openrouter"; readonly maker: string | null }
  | { readonly kind: "server"; readonly host: string }
  | { readonly kind: "this-computer" };

/** Where requests go with the provider `status` names, for the consent's wording. */
export function reachOf(status: AssistantStatus): ConsentReach {
  if (status.provider.kind === "openrouter") {
    return { kind: "openrouter", maker: status.model?.maker ?? null };
  }
  if (status.provider.kind === "server") {
    return { kind: "server", host: new URL(status.provider.baseUrl).host };
  }
  return { kind: "this-computer" };
}

/** Where requests leave this computer: the reaches a site is asked about. */
type AwayReach = Exclude<ConsentReach, { kind: "this-computer" }>;

/** Who receives a request, named: "OpenRouter and Anthropic", or a server's host. */
function receiversOf(reach: AwayReach): string {
  if (reach.kind === "server") return reach.host;
  return reach.maker === null
    ? t("assistant.consent.openRouterAndModelMaker")
    : t("assistant.consent.openRouterAndMaker", { maker: reach.maker });
}

/** Props of {@link AppConsentDialog}. */
export type AppConsentDialogProps = {
  readonly open: boolean;
  readonly reach: ConsentReach;
  /** The person turns it on, having read this wording. */
  readonly onAgree: () => void;
  readonly onCancel: () => void;
};

/**
 * The app's consent (product/14 §5.3, AIA-6, ADR 0026 §4), shown once as the person turns the
 * assistant on, before sign-in: what's sent, to whom, who pays, other people's details, how to turn
 * it off, and that each site is asked again. For a model on this computer, nothing leaves it, and
 * no site is asked.
 */
export function AppConsentDialog({ open, reach, onAgree, onCancel }: AppConsentDialogProps) {
  const local = reach.kind === "this-computer";
  const points = local
    ? [t("assistant.consent.local"), t("assistant.consent.off")]
    : [
        t("assistant.consent.sent"),
        reach.kind === "server"
          ? t("assistant.consent.server", { host: reach.host })
          : t("assistant.consent.receivers", { receivers: receiversOf(reach) }),
        ...(reach.kind === "openrouter"
          ? [t("assistant.consent.retention"), t("assistant.consent.pays")]
          : []),
        t("assistant.consent.people"),
        t("assistant.consent.off"),
        t("assistant.consent.perSite"),
      ];
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("assistant.consent.title")}</DialogTitle>
          <DialogDescription>{t("assistant.consent.description")}</DialogDescription>
        </DialogHeader>
        <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-sm">
          {points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            {t("assistant.consent.cancel")}
          </Button>
          <Button onClick={onAgree}>{t("assistant.consent.agree")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Props of {@link SiteConsent}. */
export type SiteConsentProps = {
  /** The site's name. */
  readonly site: string;
  readonly reach: AwayReach;
  readonly onAnswer: (allowed: boolean) => void;
};

/**
 * This site's consent (AIA-6, ADR 0026 §4), in the panel the first time it's used on a site: who its
 * content goes to. The answer is kept on this computer, by the site, never in the site file; until
 * it is yes, nothing of the site is sent.
 */
export function SiteConsent({ site, reach, onAnswer }: SiteConsentProps) {
  const id = useId();
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="m-3 flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm"
    >
      <h3 id={`${id}-title`} className="m-0 text-sm font-semibold">
        {t("assistant.site.title", { site })}
      </h3>
      <p className="m-0">{t("assistant.site.sent", { receivers: receiversOf(reach) })}</p>
      <p className="m-0 text-xs text-muted-foreground">{t("assistant.site.kept")}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => onAnswer(false)}>
          {t("assistant.site.deny")}
        </Button>
        <Button size="sm" onClick={() => onAnswer(true)}>
          {t("assistant.site.allow")}
        </Button>
      </div>
    </section>
  );
}
