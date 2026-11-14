import { Button, fieldControlClass } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useId, useState } from "react";
import type { AssistantApi, AssistantStatus } from "../../shared/ipc/assistant.js";
import { reportFailure } from "../log.js";
import { type SignInStatus, signInKey } from "./sign-in-words.js";

/** The providers the person can choose (ADR 0026 §2). */
const PROVIDERS = ["openrouter", "ollama", "lmstudio", "server"] as const;
type ProviderKind = (typeof PROVIDERS)[number];

/** The names this computer goes by, where a plain http:// server is safe for a key. */
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

/** Props of {@link ProviderSection}. */
export type ProviderSectionProps = {
  readonly status: AssistantStatus;
  readonly api: Pick<
    AssistantApi,
    "update" | "signIn" | "finishSignIn" | "cancelSignIn" | "setKey"
  >;
  readonly onStatus: (status: AssistantStatus) => void;
};

/**
 * Where the assistant's requests go (ADR 0026 §2–§3), in its settings: OpenRouter, signed in through
 * the browser or with a code it shows; a model on this computer (Ollama, LM Studio); or another
 * server by its address, with a key if it needs one. A provider the consent doesn't cover turns the
 * assistant off in main until the person agrees again, so nothing is sent there before that.
 */
export function ProviderSection({ status, api, onStatus }: ProviderSectionProps) {
  const id = useId();
  const [chosen, setChosen] = useState<ProviderKind>(status.provider.kind);
  const [address, setAddress] = useState(
    status.provider.kind === "server" ? status.provider.baseUrl : "",
  );
  const [waiting, setWaiting] = useState<"browser" | "code" | undefined>(undefined);
  const [code, setCode] = useState("");
  const [key, setKey] = useState("");
  const [said, setSaid] = useState<SignInStatus | undefined>(undefined);
  /** Changes the provider in main, keeping the status it answers. */
  const use = (provider: Parameters<AssistantApi["update"]>[0]["provider"]) =>
    void api
      .update({ provider })
      .then(onStatus)
      .catch((error: unknown) => reportFailure("assistant.provider", error));
  /** Says how a sign-in step came out; one that fails in IPC is *failed*, logged without content. */
  const outcome = (step: Promise<{ status: SignInStatus }>) =>
    step.catch((error: unknown) => {
      reportFailure("assistant.signIn", error);
      return { status: "failed" as const };
    });
  /**
   * Starts OpenRouter's sign-in (ADR 0026 §3): it waits, in main, for the browser's callback or a
   * pasted code, and ends signed in, cancelled, timed out or failed.
   */
  const startSignIn = (mode: "browser" | "code") => {
    setSaid(undefined);
    setWaiting(mode);
    void outcome(api.signIn(mode)).then((result) => {
      setWaiting(undefined);
      setSaid(result.status);
    });
  };
  // Only a web address: main refuses any other (#1020 review).
  const parsed = URL.canParse(address) ? new URL(address) : undefined;
  const url = parsed !== undefined && /^https?:$/.test(parsed.protocol) ? parsed : undefined;
  /** Plain http to another computer: a key isn't sent there (insecure-server). */
  const unencrypted = url?.protocol === "http:" && !LOCAL_HOSTS.includes(url.hostname);
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-2">
      <h3 id={`${id}-title`} className="m-0 text-sm font-semibold">
        {t("assistant.provider.title")}
      </h3>
      <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
        <legend className="sr-only">{t("assistant.provider.title")}</legend>
        {PROVIDERS.map((kind) => (
          <label key={kind} className="flex items-start gap-2">
            <input
              type="radio"
              name={`${id}-provider`}
              checked={chosen === kind}
              className="mt-0.5 accent-primary"
              onChange={() => {
                setChosen(kind);
                setSaid(undefined);
                if (kind !== "server") use({ kind });
              }}
            />
            <span className="flex flex-col">
              {t(`assistant.provider.${kind}`)}
              <span className="text-xs text-muted-foreground">
                {t(`assistant.provider.${kind}.hint`)}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      {chosen === "server" ? (
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (url !== undefined) use({ kind: "server", baseUrl: url.href });
          }}
        >
          <label className="flex flex-1 flex-col gap-1 text-xs">
            {t("assistant.provider.address")}
            <input
              type="url"
              value={address}
              placeholder={t("assistant.provider.addressPlaceholder")}
              className={fieldControlClass}
              onChange={(event) => setAddress(event.currentTarget.value)}
            />
          </label>
          <Button size="sm" type="submit" disabled={url === undefined}>
            {t("assistant.provider.useServer")}
          </Button>
        </form>
      ) : null}
      {chosen === "server" && address !== "" && url === undefined ? (
        <p className="m-0 text-xs text-muted-foreground">{t("assistant.provider.addressHint")}</p>
      ) : null}
      {chosen === "server" && unencrypted ? (
        <p className="m-0 text-xs text-muted-foreground">{t("assistant.provider.unencrypted")}</p>
      ) : null}
      {status.provider.kind === "openrouter" && chosen === "openrouter" ? (
        status.provider.signedIn ? (
          <p className="m-0 text-xs">{t("assistant.signIn.done")}</p>
        ) : waiting === "browser" ? (
          <div className="flex items-center gap-2">
            <p role="status" className="m-0 flex-1 text-xs">
              {t("assistant.signIn.waiting")}
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void api.cancelSignIn().catch(() => undefined)}
            >
              {t("assistant.signIn.cancel")}
            </Button>
          </div>
        ) : waiting === "code" ? (
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              // A wrong code leaves the sign-in waiting, for the person to paste it again.
              void outcome(api.finishSignIn(code.trim())).then((result) => {
                if (result.status !== "signed-in") setSaid(result.status);
              });
            }}
          >
            <label className="flex flex-1 flex-col gap-1 text-xs">
              {t("assistant.signIn.codeField")}
              <input
                value={code}
                autoComplete="off"
                className={fieldControlClass}
                onChange={(event) => setCode(event.currentTarget.value)}
              />
            </label>
            <Button size="sm" type="submit" disabled={code.trim() === ""}>
              {t("assistant.signIn.finish")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void api.cancelSignIn().catch(() => undefined)}
            >
              {t("assistant.signIn.cancel")}
            </Button>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => startSignIn("browser")}>
              {t("assistant.signIn.browser")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => startSignIn("code")}>
              {t("assistant.signIn.code")}
            </Button>
          </div>
        )
      ) : null}
      {status.provider.kind === "server" && chosen === "server" ? (
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setSaid(undefined);
            void outcome(api.setKey(key)).then((result) => setSaid(result.status));
            setKey("");
          }}
        >
          <label className="flex flex-1 flex-col gap-1 text-xs">
            {t(status.provider.hasKey ? "assistant.provider.keyReplace" : "assistant.provider.key")}
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
        <p role="status" className="m-0 text-xs">
          {t(signInKey(said))}
        </p>
      )}
    </section>
  );
}
