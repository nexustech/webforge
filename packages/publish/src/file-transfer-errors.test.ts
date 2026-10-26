import { FTPError } from "basic-ftp";
import { describe, expect, it } from "vitest";
import { fileTransferError } from "./file-transfer-errors.js";
import { ftpErrorCode } from "./ftp.js";
import { PublishError } from "./publisher.js";
import { readSftpHostKey, sftpErrorCode } from "./sftp.js";

const nodeError = (code: string) => Object.assign(new Error(`${code} at 10.0.0.1`), { code });
const ftpReply = (code: number) => new FTPError({ code, message: `${code} /home/rosie: denied` });
const none = () => undefined;

describe("fileTransferError", () => {
  it("names socket, DNS and certificate failures by their kind", () => {
    expect(fileTransferError(nodeError("ECONNREFUSED"), undefined, none).code).toBe("network");
    expect(fileTransferError(nodeError("ENOTFOUND"), undefined, none).code).toBe("network");
    expect(fileTransferError(nodeError("DEPTH_ZERO_SELF_SIGNED_CERT"), undefined, none).code).toBe(
      "untrusted-host",
    );
    expect(fileTransferError(nodeError("CERT_HAS_EXPIRED"), undefined, none).code).toBe(
      "untrusted-host",
    );
    expect(fileTransferError(new Error("odd"), undefined, none).code).toBe("failed");
    expect(fileTransferError("not an error", undefined, none).code).toBe("failed");
  });

  it("calls anything after a cancel a cancel, and passes a publish error on", () => {
    const controller = new AbortController();
    controller.abort();
    const refused = new PublishError("untrusted-host", "Not the trusted key");

    expect(fileTransferError(nodeError("ECONNRESET"), controller.signal, none).code).toBe(
      "cancelled",
    );
    expect(fileTransferError(refused, undefined, none)).toBe(refused);
  });

  it("never carries the host's reply in its message", () => {
    const error = fileTransferError(ftpReply(530), undefined, ftpErrorCode);

    expect(error.code).toBe("unauthorized");
    expect(error.message).not.toContain("rosie");
    expect(error.cause).toBeInstanceOf(FTPError);
  });
});

describe("ftpErrorCode", () => {
  it("reads the FTP reply codes", () => {
    expect(ftpErrorCode(ftpReply(530))).toBe("unauthorized");
    expect(ftpErrorCode(ftpReply(550))).toBe("rejected");
    expect(ftpErrorCode(ftpReply(553))).toBe("rejected");
    expect(ftpErrorCode(ftpReply(421))).toBe("network");
    expect(ftpErrorCode(ftpReply(425))).toBe("network");
    expect(ftpErrorCode(new Error("Timeout (control socket)"))).toBe("network");
    expect(ftpErrorCode(nodeError("ECONNREFUSED"))).toBeUndefined();
  });
});

describe("sftpErrorCode", () => {
  it("reads SSH sign-in failures and SFTP status codes", () => {
    const level = (name: string) => Object.assign(new Error("ssh"), { level: name });
    const status = (code: number) => Object.assign(new Error("sftp"), { code });

    expect(sftpErrorCode(level("client-authentication"))).toBe("unauthorized");
    expect(sftpErrorCode(level("client-timeout"))).toBe("network");
    expect(sftpErrorCode(status(2))).toBe("not-found");
    expect(sftpErrorCode(status(3))).toBe("rejected");
    expect(sftpErrorCode(status(4))).toBeUndefined();
    expect(sftpErrorCode("not an error")).toBeUndefined();
  });
});

describe("readSftpHostKey", () => {
  it("tells an unreachable host apart", async () => {
    await expect(readSftpHostKey("127.0.0.1", 1, 5_000)).rejects.toMatchObject({ code: "network" });
  });
});
