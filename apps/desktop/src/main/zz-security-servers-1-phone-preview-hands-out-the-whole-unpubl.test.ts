// Security review S9 (docs/reviews/2026-10-30-security-review.md), restored by #653.
import { request } from "node:http";
import type { NetworkInterfaceInfo } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { localNetworkAddress } from "./network-address.js";
import { createPreviewServer, type PreviewServer } from "./preview-server.js";

const v4 = (address: string) =>
  ({ address, family: "IPv4", internal: false }) as NetworkInterfaceInfo;

function status(port: number, path: string) {
  return new Promise<number>((resolve, reject) => {
    const sent = request({ host: "127.0.0.1", port, path }, (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode ?? 0));
    });
    sent.on("error", reject);
    sent.end();
  });
}

let server: PreviewServer | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

describe("security: phone preview secret and address choice", () => {
  it("a phone URL from an earlier Phone Preview stops working once it is stopped and restarted", async () => {
    server = createPreviewServer();
    server.update({
      type: "previewed",
      full: true,
      changed: [
        { path: "index.html", data: new TextEncoder().encode("<html><body>Hi</body></html>") },
      ],
      removed: [],
    });
    const first = await server.listen("network", "127.0.0.1");
    // The phone has its own base (S9).
    const leaked = `${server.phoneBase()}index.html`;
    expect(await status(first, leaked)).toBe(200);
    await server.stop("network");
    const second = await server.listen("network", "127.0.0.1");
    expect(await status(second, leaked)).toBe(404);
  });

  it("prefers the Wi-Fi address over docker and VPN adapters", () => {
    expect(
      localNetworkAddress({
        docker0: [v4("172.17.0.1")],
        wg0: [v4("10.8.0.2")],
        en0: [v4("192.168.1.20")],
      }),
    ).toBe("192.168.1.20");
  });
});
