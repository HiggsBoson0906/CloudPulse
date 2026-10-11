import { Agent } from "undici";
import dns from "dns";
import net from "net";
import { isAlwaysForbiddenIp, isRfc1918OrUla } from "./ssrf-validator";

export interface SafeDispatcherOptions {
  allowPrivate?: boolean;
  allowedPrivateHosts?: string[];
  pinnedIp?: string;
  timeoutMs?: number;
}

/**
 * Creates an Undici Agent that enforces SSRF defenses at the TCP connection layer,
 * completely eliminating DNS rebinding and TOCTOU (Time-of-Check to Time-of-Use) attacks.
 *
 * 1. If pinnedIp is supplied from the validation step, the connection is pinned directly
 *    to that IP address and no secondary DNS query is performed.
 * 2. If dynamic resolution occurs during connection, every resolved IP is strictly
 *    validated against prohibited ranges before the socket is created.
 * 3. TLS certificate verification (rejectUnauthorized: true) is strictly preserved.
 */
export function createSafeDispatcher(
  targetUrl: string,
  options: SafeDispatcherOptions = {}
): Agent {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    throw new Error(`Invalid target URL: '${targetUrl}'`);
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const allowPrivate = !!options.allowPrivate;
  const allowedPrivateHosts = (options.allowedPrivateHosts || []).map(function (h) {
    return h.toLowerCase();
  });
  const isHostAllowedPrivate = allowedPrivateHosts.includes(hostname);
  const pinnedIp = options.pinnedIp;

  function validateAddressOrThrow(ip: string): void {
    if (isAlwaysForbiddenIp(ip)) {
      throw new Error(
        `Blocked by SSRF protection: Prohibited IP '${ip}' (loopback, link-local, metadata, or unspecified)`
      );
    }
    if (isRfc1918OrUla(ip) && !allowPrivate && !isHostAllowedPrivate) {
      throw new Error(
        `Blocked by SSRF protection: Restricted private network IP '${ip}'`
      );
    }
  }

  return new Agent({
    connect: {
      timeout: options.timeoutMs || 10000,
      rejectUnauthorized: true,
      servername: hostname,
      lookup: function (
        lookedUpHost: string,
        lookupOpts: any,
        callback: any
      ) {
        // If a verified IP was pinned for this connection, use it directly
        if (pinnedIp) {
          try {
            validateAddressOrThrow(pinnedIp);
            const family = net.isIPv4(pinnedIp) ? 4 : 6;
            if (lookupOpts && lookupOpts.all) {
              callback(null, [{ address: pinnedIp, family }]);
            } else {
              callback(null, pinnedIp, family);
            }
            return;
          } catch (err: unknown) {
            callback(err instanceof Error ? err : new Error(String(err)), null as any);
            return;
          }
        }

        // Direct IP supplied as host
        if (net.isIP(lookedUpHost)) {
          try {
            validateAddressOrThrow(lookedUpHost);
            const family = net.isIPv4(lookedUpHost) ? 4 : 6;
            if (lookupOpts && lookupOpts.all) {
              callback(null, [{ address: lookedUpHost, family }]);
            } else {
              callback(null, lookedUpHost, family);
            }
            return;
          } catch (err: unknown) {
            callback(err instanceof Error ? err : new Error(String(err)), null as any);
            return;
          }
        }

        // Dynamic lookup at connect time with strict re-validation
        dns.promises
          .lookup(lookedUpHost, { all: true })
          .then(function (records) {
            if (!records || records.length === 0) {
              throw new Error(`Hostname '${lookedUpHost}' could not be resolved`);
            }

            // Validate EVERY resolved address
            for (const record of records) {
              validateAddressOrThrow(record.address);
            }

            const chosen = records[0];
            if (lookupOpts && lookupOpts.all) {
              callback(null, [{ address: chosen.address, family: chosen.family }]);
            } else {
              callback(null, chosen.address, chosen.family);
            }
          })
          .catch(function (err: unknown) {
            callback(err instanceof Error ? err : new Error(String(err)), null as any);
          });
      },
    },
  });
}
