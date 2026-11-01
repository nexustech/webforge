// Security review S2 (docs/reviews/2026-10-30-security-review.md), restored by 4.4a (#72): the
// review's test asked the credential store by ids, the only lookup it had; a destination's secret
// is now asked for through `PublishSecrets`, which checks where it was typed for.
import { join } from "node:path";
import type { PublishDestination } from "@webforge/model";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import { describe, expect, it } from "vitest";
import { createCredentialStore, type SecretCipher } from "./credential-store.js";
import { createPublishSecrets } from "./publish-secrets.js";

const cipher: SecretCipher = {
  isEncryptionAvailable: () => true,
  encryptString: (text) => Buffer.from(`enc:${text}`),
  decryptString: (data) => data.toString().slice(4),
};

describe("security: stored publish secret is bound to its destination", () => {
  const tempDir = tempDirFactory();

  it("does not hand the real host's password to a destination whose host was edited in the file", async () => {
    const secrets = createPublishSecrets(
      createCredentialStore(join(tempDir(), "credentials.json"), cipher),
    );
    const projectId = "7d2b0c1e-1111-4222-8333-444455556666";
    // The `.wforge` file is shareable; every field below comes from it.
    const original: PublishDestination = {
      id: "0b9a8f6e-3c2d-4e1f-8a7b-6c5d4e3f2a10",
      name: "Live",
      kind: "file-transfer",
      settings: { protocol: "ftps", host: "ftp.real.example", user: "rosa", folder: "/" },
    };
    // The user saves their hosting password for the destination they typed.
    await secrets.save(projectId, original, { password: "hunter2" }, {});

    // A recipient edits the shared file: same IDs, attacker's host, plain FTP.
    const tampered: PublishDestination = {
      ...original,
      settings: { ...original.settings, protocol: "ftp", host: "evil.example" },
    };

    expect(await secrets.signInFor(projectId, tampered)).toBeUndefined();
    expect((await secrets.state(projectId, tampered)).signIn).toBe("changed");
    // The destination as it was typed still gets it.
    expect((await secrets.signInFor(projectId, original))?.signIn).toEqual({ password: "hunter2" });
  });
});
