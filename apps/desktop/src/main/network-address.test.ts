import type { NetworkInterfaceInfo } from "node:os";
import { describe, expect, it } from "vitest";
import { localNetworkAddress } from "./network-address.js";

const v4 = (address: string, internal = false) =>
  ({ address, family: "IPv4", internal }) as NetworkInterfaceInfo;
const v6 = (address: string) =>
  ({ address, family: "IPv6", internal: false }) as NetworkInterfaceInfo;

describe("localNetworkAddress (3.2)", () => {
  it("is the computer's private IPv4 address on its network, before any other", () => {
    expect(
      localNetworkAddress({
        lo: [v4("127.0.0.1", true)],
        vpn: [v4("100.64.1.2")],
        wifi: [v6("fe80::1"), v4("192.168.1.23")],
      }),
    ).toBe("192.168.1.23");
    expect(localNetworkAddress({ eth: [v4("10.0.0.5")] })).toBe("10.0.0.5");
    expect(localNetworkAddress({ eth: [v4("172.20.3.4")] })).toBe("172.20.3.4");
  });

  it("is none without a private address: off any network, or on a VPN's or a public one only", () => {
    expect(localNetworkAddress({ vpn: [v4("100.64.1.2")] })).toBe(undefined);
    expect(localNetworkAddress({ eth: [v4("81.2.69.160")] })).toBe(undefined);
    expect(localNetworkAddress({ lo: [v4("127.0.0.1", true)], wifi: [v6("fe80::1")] })).toBe(
      undefined,
    );
    expect(localNetworkAddress({})).toBe(undefined);
  });
});
