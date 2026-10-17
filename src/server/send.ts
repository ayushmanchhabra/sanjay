// Sends a single request and resolves with its response, without going
// through the proxy's intercept/capture path. This is what Repeater and
// Intruder use to (re)issue requests the user has composed or templated
// — the same role Burp Suite's Repeater/Intruder request engine plays.
import http from "node:http";
import https from "node:https";

import { BodyCollector, toHeaderPairs } from "./capture.ts";
import type {
  CapturedRequest,
  CapturedResponse,
} from "../website/proxy/types.ts";

// Connection-level headers that must not be forwarded verbatim; Node
// manages these itself, and passing them through can corrupt the
// request framing.
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function splitHost(
  host: string,
  scheme: "http" | "https",
): { hostname: string; port: number } {
  const lastColon = host.lastIndexOf(":");
  // No port, or the colon belongs to a bracketed IPv6 literal with no
  // trailing port.
  if (lastColon === -1 || host.endsWith("]")) {
    return { hostname: host, port: scheme === "https" ? 443 : 80 };
  }
  const port = Number(host.slice(lastColon + 1));
  if (!Number.isInteger(port)) {
    return { hostname: host, port: scheme === "https" ? 443 : 80 };
  }
  return { hostname: host.slice(0, lastColon), port };
}

// Rebuilds outgoing headers from the request's header pairs, dropping
// hop-by-hop headers and the Content-Length (recomputed from the body
// below, so an edited body can't disagree with a stale length).
function buildHeaders(pairs: [string, string][]): http.OutgoingHttpHeaders {
  const headers: http.OutgoingHttpHeaders = {};
  for (const [name, value] of pairs) {
    const lower = name.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower) || lower === "content-length") continue;
    const existing = headers[name];
    if (existing === undefined) {
      headers[name] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      headers[name] = [String(existing), value];
    }
  }
  return headers;
}

export function sendRequest(
  request: CapturedRequest,
): Promise<CapturedResponse> {
  return new Promise((resolve, reject) => {
    const client = request.scheme === "https" ? https : http;
    const { hostname, port } = splitHost(request.host, request.scheme);
    const body =
      request.body !== undefined && request.body.length > 0
        ? Buffer.from(request.body, "utf8")
        : undefined;

    const headers = buildHeaders(request.headers);
    if (body) headers["content-length"] = body.length;

    const req = client.request(
      {
        hostname,
        port,
        method: request.method,
        path: request.path,
        headers,
        ...(request.scheme === "https" ? { servername: hostname } : {}),
      },
      (res) => {
        const responseBody = new BodyCollector();
        res.on("data", (chunk: Buffer) => responseBody.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            statusText: res.statusMessage ?? "",
            headers: toHeaderPairs(res.headers),
            body: responseBody.toBody(res.headers["content-encoding"]),
          });
        });
      },
    );

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}
