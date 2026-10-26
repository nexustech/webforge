import { PublishError, type PublishErrorCode } from "./publisher.js";

/** Socket and DNS failures: the host couldn't be reached, or the connection dropped. */
const NETWORK_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ECONNABORTED",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "EPIPE",
]);

/** TLS failures that mean the computer doesn't trust the server's certificate. */
const CERTIFICATE_CODES = new Set([
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "CERT_HAS_EXPIRED",
  "CERT_NOT_YET_VALID",
  "ERR_TLS_CERT_ALTNAME_INVALID",
]);

const MESSAGES: Record<PublishErrorCode, string> = {
  unauthorized: "The host refused the user name or password",
  "not-found": "The host has no such folder",
  "rate-limited": "The host asked to slow down",
  rejected: "The host refused a file or a request",
  network: "The host could not be reached",
  "untrusted-host": "The host is not the one trusted for this destination",
  cancelled: "Publishing was cancelled",
  failed: "Publishing to the host failed",
};

/**
 * A {@link PublishError} for a failed FTP, FTPS or SFTP request, by its kind only: the host's
 * reply can echo the user name or a path, so it is never part of the message. `classify` names
 * the protocol's own codes; `signal` turns anything after a cancel into `cancelled`, since
 * cancelling closes the connection mid-request.
 */
export function fileTransferError(
  error: unknown,
  signal: AbortSignal | undefined,
  classify: (error: unknown) => PublishErrorCode | undefined,
): PublishError {
  if (error instanceof PublishError) return error;
  const code: PublishErrorCode =
    signal?.aborted === true ? "cancelled" : (classify(error) ?? systemCode(error));
  return new PublishError(code, MESSAGES[code], { cause: error });
}

/** The kind of a socket, DNS or TLS failure, from Node's error code. */
function systemCode(error: unknown): PublishErrorCode {
  const code =
    typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (NETWORK_CODES.has(code)) return "network";
  if (CERTIFICATE_CODES.has(code)) return "untrusted-host";
  return "failed";
}
