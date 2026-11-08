/**
 * The base of every error Webforge throws on purpose (standards §4): a `code` that says what went
 * wrong, for code to act on and for logs. The person never sees the error itself: a failure
 * reaches the renderer as a reason code, which the UI turns into a `t()` key where it shows the
 * message (A23). The `message` is for developers only: it is never shown, and never logged either,
 * as it may hold a path or a value. Subclasses name their codes.
 */
export abstract class WebforgeError<Code extends string = string> extends Error {
  readonly code: Code;

  protected constructor(code: Code, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
  }
}

/** A name or code that a log may hold: letters, digits and `_ . : -`, short. */
const SAFE_TOKEN = /^[A-Za-z0-9_.:-]{1,64}$/;

/** `value` if it is a {@link SAFE_TOKEN}, else undefined. */
const safe = (value: unknown): string | undefined =>
  typeof value === "string" && SAFE_TOKEN.test(value) ? value : undefined;

/**
 * What a log may say about `error`: its name and code (`ProjectFileError corrupt`, `Error
 * ENOENT`, `TypeError`), never its message, which may hold a path, a value or site content. A
 * name or code that isn't a short plain token is left out, as is anything about a value that
 * isn't an `Error` but its type.
 */
export function errorCode(error: unknown): string {
  if (!(error instanceof Error)) {
    return error === null ? "null" : typeof error;
  }
  const name = safe(error.name) ?? "Error";
  const code = safe((error as { code?: unknown }).code);
  return code === undefined ? name : `${name} ${code}`;
}
