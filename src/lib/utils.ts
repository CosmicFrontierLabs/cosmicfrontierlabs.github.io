export function slugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function getNetworkSpeed(): "fast" | "medium" | "slow" {
  // Run client side to determine the network speed
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  const downlink = conn ? conn.downlink : 100.0;
  if (downlink < 3.0) {
    return "slow";
  } else if (downlink < 10.0) {
    return "medium";
  }
  return "fast";
}
