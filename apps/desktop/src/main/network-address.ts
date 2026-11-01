import type { NetworkInterfaceInfo } from "node:os";

/** A private IPv4 address (RFC 1918): one a home or office network gives its devices. */
const PRIVATE = /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/;

/**
 * Adapters that aren't the computer's own Wi-Fi or Ethernet, by name on Windows, macOS and Linux:
 * containers and virtual machines (Docker, WSL, Hyper-V, VirtualBox, VMware, Parallels, libvirt)
 * and VPNs (WireGuard, Tailscale, ZeroTier, OpenVPN's TAP and TUN, PPP). A phone can't reach the
 * preview there, and a VPN's other computers could (S9).
 */
const VIRTUAL =
  /docker|^br-|^veth|^virbr|vethernet|hyper-v|wsl|virtualbox|vboxnet|vmware|vmnet|parallels|^vnic|^utun|^tun|^tap|^ppp|wireguard|^wg|tailscale|zerotier|^zt|openvpn|nordlynx|vpn/i;

/** The computer's own Wi-Fi or Ethernet, by name: chosen before any other adapter. */
const PHYSICAL = /wi-?fi|wireless|wlan|^wl|ethernet|^eth|^en/i;

/**
 * This computer's address on its local network, for a phone to open the preview at (3.2): a private
 * IPv4 address on its Wi-Fi or Ethernet first, never a virtual adapter's or a VPN's (S9). None when
 * it has none, on no network or only a public one: the preview is never offered there, where
 * strangers could reach it.
 */
export function localNetworkAddress(
  interfaces: NodeJS.Dict<NetworkInterfaceInfo[]>,
): string | undefined {
  const candidates = Object.entries(interfaces)
    .filter(([name]) => !VIRTUAL.test(name))
    .flatMap(([name, each]) =>
      (each ?? [])
        .filter((info) => info.family === "IPv4" && !info.internal && PRIVATE.test(info.address))
        .map((info) => ({ name, address: info.address })),
    );
  return (candidates.find(({ name }) => PHYSICAL.test(name)) ?? candidates[0])?.address;
}

/** Whether `address` is still one of this computer's: a phone preview there stops once it isn't. */
export function hasAddress(
  interfaces: NodeJS.Dict<NetworkInterfaceInfo[]>,
  address: string,
): boolean {
  return Object.values(interfaces).some((each) => each?.some((info) => info.address === address));
}
