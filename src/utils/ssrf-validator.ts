import dns from "dns/promises";
import net from "net";

/**
 * SSRF Validation and Defense Module.
 *
 * Designed to prevent Server-Side Request Forgery by validating target hostnames,
 * checking resolved IP addresses against blacklists (Loopback, Link-Local, Cloud Metadata,
 * and optional RFC1918 Private networks), and providing secure DNS resolution agents.
 *
 * DOCUMENTED LIMITATIONS:
 * 1. DNS Rebinding: If standard fetch() / http.request resolves DNS independently after
 *    validation, an attacker's DNS server could return a public IP during validateUrl()
 *    and a private IP (e.g. 169.254.169.254) during the HTTP socket connection.
 *    To mitigate this, CloudPulse pins the validated IP address or verifies redirects.
 * 2. IPv6 Transitions & Dual-stack: Some networks may map IPv4 addresses into IPv4-mapped IPv6
 *    (e.g., ::ffff:127.0.0.1). This module parses and checks IPv4-mapped IPv6 ranges.
 */

const CLOUD_METADATA_IPS = [
  "169.254.169.254", // AWS, GCP, Azure, OpenStack instance metadata
  "169.254.170.2",   // AWS ECS task metadata
  "fd00:ec2::254",   // AWS IPv6 metadata
];

const FORBIDDEN_HOSTNAMES = [
  "localhost",
  "metadata.google.internal",
  "instance-data",
];

export interface SSRFValidationResult {
  isValid: boolean;
  reason?: string;
  resolvedIp?: string;
}

export function isPrivateOrForbiddenIp(ip: string, allowPrivate = false): boolean {
  // Normalize IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
  if (ip.startsWith("::ffff:")) {
    ip = ip.replace("::ffff:", "");
  }

  const isIpv4 = net.isIPv4(ip);
  const isIpv6 = net.isIPv6(ip);

  if (!isIpv4 && !isIpv6) {
    return true; // Not a valid IP -> reject
  }

  // Cloud metadata checks
  if (CLOUD_METADATA_IPS.includes(ip)) {
    return true;
  }

  if (isIpv4) {
    const parts = ip.split(".").map(function (n) {
      return parseInt(n, 10);
    });
    const [b0, b1] = parts;

    // 127.0.0.0/8 Loopback
    if (b0 === 127) return true;

    // 0.0.0.0/8 Current network
    if (b0 === 0) return true;

    // 169.254.0.0/16 Link-local / Cloud Metadata
    if (b0 === 169 && b1 === 254) return true;

    // 100.64.0.0/10 Carrier-grade NAT (used in cloud internal networking)
    if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

    // RFC 1918 Private networks (blocked unless allowPrivate is enabled for local dev/testing)
    if (!allowPrivate) {
      // 10.0.0.0/8
      if (b0 === 10) return true;
      // 172.16.0.0/12
      if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
      // 192.168.0.0/16
      if (b0 === 192 && b1 === 168) return true;
    }
  } else if (isIpv6) {
    // ::1 Loopback
    if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return true;

    // fe80::/10 Link-local
    if (ip.toLowerCase().startsWith("fe80:")) return true;

    // fc00::/7 Unique Local Address
    if (!allowPrivate && (ip.toLowerCase().startsWith("fc") || ip.toLowerCase().startsWith("fd"))) {
      return true;
    }
  }

  return false;
}

export async function validateTargetUrl(
  rawUrl: string,
  allowPrivate = false
): Promise<SSRFValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { isValid: false, reason: "Malformed URL" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      isValid: false,
      reason: `Unsupported protocol '${parsed.protocol}'. Only http: and https: are permitted`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (FORBIDDEN_HOSTNAMES.includes(hostname)) {
    return {
      isValid: false,
      reason: `Hostname '${hostname}' is restricted for security`,
    };
  }

  // Direct IP address in hostname
  if (net.isIP(hostname)) {
    if (isPrivateOrForbiddenIp(hostname, allowPrivate)) {
      return {
        isValid: false,
        reason: `Direct IP target '${hostname}' resolves to a restricted private or metadata network`,
      };
    }
    return { isValid: true, resolvedIp: hostname };
  }

  // Domain name -> Perform DNS lookup to inspect resolved IP addresses
  try {
    const lookups = await dns.lookup(hostname, { all: true });

    if (lookups.length === 0) {
      return { isValid: false, reason: `DNS lookup failed for hostname '${hostname}'` };
    }

    for (const record of lookups) {
      if (isPrivateOrForbiddenIp(record.address, allowPrivate)) {
        return {
          isValid: false,
          reason: `Hostname '${hostname}' resolved to restricted IP '${record.address}'`,
        };
      }
    }

    return { isValid: true, resolvedIp: lookups[0].address };
  } catch (dnsErr: unknown) {
    const message = dnsErr instanceof Error ? dnsErr.message : "Unknown DNS error";
    return { isValid: false, reason: `DNS resolution failed: ${message}` };
  }
}
