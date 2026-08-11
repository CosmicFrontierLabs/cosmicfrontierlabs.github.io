export function slugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function getNetworkSpeed(): "fast" | "medium" | "slow" {
  // Run client side to determine the network speed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as any;
  const conn = (nav.connection || nav.mozConnection || nav.webkitConnection) as { downlink?: number } | undefined;

  const downlink = conn?.downlink ?? 100.0;
  if (downlink < 3.0) {
    return "slow";
  } else if (downlink < 10.0) {
    return "medium";
  }
  return "fast";
}
