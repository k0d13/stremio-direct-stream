/**
 * IP helpers for deciding whether a request's client shares the server's
 * network. IP-locked sources (e.g. vidsrc) mint a playback token bound to the
 * server's public /24 — so they only work when the client plays from that same
 * /24. See providers/index.ts and streams.ts for how this gates them.
 */

/** Pull the client IP from proxy headers, falling back to the socket address. */
export function clientIpFromRequest(
  request: Request,
  server?: { requestIP?: (req: Request) => { address: string } | null },
): string | undefined {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    server?.requestIP?.(request)?.address ??
    undefined
  );
}

let cachedServerIp: { ip: string; at: number } | undefined;

/** The server's public egress IP (what the CDN sees), cached for an hour. */
export async function getServerPublicIp(): Promise<string | undefined> {
  if (cachedServerIp && Date.now() - cachedServerIp.at < 3_600_000) {
    return cachedServerIp.ip;
  }
  try {
    const ip = (await (await fetch("https://api.ipify.org")).text()).trim();
    if (ip) cachedServerIp = { ip, at: Date.now() };
    return cachedServerIp?.ip;
  } catch {
    // Keep any stale value rather than failing the whole request.
    return cachedServerIp?.ip;
  }
}

/** RFC1918 / loopback / link-local / IPv6 ULA — i.e. the client is on our LAN. */
export function isPrivateIp(ip: string): boolean {
  const norm = ip.replace(/^::ffff:/i, ""); // unwrap IPv4-mapped IPv6
  if (norm === "127.0.0.1" || norm === "::1") return true;
  if (/^10\./.test(norm)) return true;
  if (/^192\.168\./.test(norm)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(norm)) return true;
  if (/^169\.254\./.test(norm)) return true; // link-local
  if (/^f[cd][0-9a-f]{2}:/i.test(norm)) return true; // IPv6 ULA fc00::/7
  return false;
}

/**
 * Would an IP-locked stream minted from `serverIp` play for `clientIp`?
 * A private client is on our LAN (same public IP as the server); otherwise the
 * two public IPs must share a /24, matching the token's `ip_cidr` claim.
 */
export function sameNetwork(clientIp?: string, serverIp?: string): boolean {
  if (!clientIp) return false;
  if (isPrivateIp(clientIp)) return true;
  if (!serverIp) return false;

  const a = clientIp.replace(/^::ffff:/i, "").split(".");
  const b = serverIp.replace(/^::ffff:/i, "").split(".");
  if (a.length === 4 && b.length === 4) {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  }
  return clientIp === serverIp; // non-IPv4: require an exact match
}
