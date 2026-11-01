import type { NetworkInterfaceInfo } from "node:os";
import { describe, expect, it } from "vitest";
import { hasAddress, localNetworkAddress } from "./network-address.js";

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

  it("takes Wi-Fi or Ethernet before other adapters, and never a virtual one's or a VPN's (S9)", () => {
    // Linux and macOS names.
    expect(
      localNetworkAddress({
        docker0: [v4("172.17.0.1")],
        "br-1a2b": [v4("172.18.0.1")],
        wg0: [v4("10.8.0.2")],
        utun3: [v4("10.9.0.2")],
        bridge100: [v4("192.168.64.1")],
        wlp2s0: [v4("192.168.1.20")],
      }),
    ).toBe("192.168.1.20");
    // Windows names.
    expect(
      localNetworkAddress({
        "vEthernet (WSL)": [v4("172.29.80.1")],
        "VirtualBox Host-Only Network": [v4("192.168.56.1")],
        "VMware Network Adapter VMnet8": [v4("192.168.150.1")],
        Tailscale: [v4("10.10.0.3")],
        Ethernet: [v4("10.0.0.7")],
        "Wi-Fi": [v4("192.168.0.14")],
      }),
    ).toBe("10.0.0.7");
    // Only virtual adapters and VPNs: none.
    expect(
      localNetworkAddress({ docker0: [v4("172.17.0.1")], "OpenVPN TAP": [v4("10.8.0.6")] }),
    ).toBe(undefined);
  });
});

describe("hasAddress (#653)", () => {
  it("is whether the address is still on one of the computer's adapters", () => {
    const interfaces = { "Wi-Fi": [v6("fe80::1"), v4("192.168.0.14")] };
    expect(hasAddress(interfaces, "192.168.0.14")).toBe(true);
    expect(hasAddress(interfaces, "192.168.0.15")).toBe(false);
    expect(hasAddress({}, "192.168.0.14")).toBe(false);
  });
});
