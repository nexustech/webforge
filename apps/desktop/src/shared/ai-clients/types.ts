/** What an install by main came to: the client opened it, or it was shown in its folder; or not. */
type InstallStatus = "opened" | "shown" | "off" | "unknown" | "failed";

/**
 * A kind of AI app the person can pair (4.9, #980): how it connects, and what *Add AI app* shows
 * for it. One module each in this folder, listed in `AI_CLIENTS`; main's install for it, if it has
 * one, is in `main/ai-clients/`.
 */
export type AiClient<Id extends string = string> = {
  /** Stored as the paired app's kind, so never renamed. */
  readonly id: Id;
  /**
   * Whether it checks it's Webforge it talks to before it sends its key, as Claude Desktop's
   * extension does. One that doesn't sends its key to whatever answers at the address, so its
   * pairing goes when the port moves (S27), and *Add AI app* says what that risks.
   */
  readonly verifiesServer: boolean;
  /** Its name in *Which app?*. */
  readonly label: () => string;
  /** The name it's given unless the person types another; empty for one with no name of its own. */
  readonly defaultName: () => string;
  /** What its setup comes to, in a line. */
  readonly hint: () => string;
  /** The steps once it's paired: their title, and each one. */
  readonly steps?: { readonly title: () => string; readonly items: () => readonly string[] };
  /** Something to copy besides the key: the address, or a command made from it. */
  readonly copy?: {
    readonly label: () => string;
    readonly copyLabel: () => string;
    readonly value: (address: string) => string;
  };
  /** Main installs it for the person: its button, and what each outcome says for app `name`. */
  readonly install?: {
    readonly label: () => string;
    readonly said: (status: InstallStatus, name: string) => string;
  };
  /** A line under the key, for an app set up by hand: where the key goes. */
  readonly note?: () => string;
};
