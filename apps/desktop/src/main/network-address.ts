import type { NetworkInterfaceInfo } from "node:os";

/** A private IPv4 address (RFC 1918): one a home or office network gives its devices. */
const PRIVATE = /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/;

/**
 * This computer's address on its local network, for a phone to open the preview at (3.2): an IPv4
 * address that isn't the computer's own loopback, a private one first (a home Wi-Fi's), else any
 * other; none when the computer isn't on a network.
 */
export function localNetworkAddress(
  interfaces: NodeJS.Dict<NetworkInterfaceInfo[]>,
): string | undefined {
  const addresses = Object.values(interfaces)
    .flatMap((each) => each ?? [])
    .filter((info) => info.family === "IPv4" && !info.internal)
    .map((info) => info.address);
  return addresses.find((address) => PRIVATE.test(address)) ?? addresses[0];
}
