import type {
  CapturedExchange,
  CapturedRequest,
  CapturedResponse,
  HttpMethod,
} from "./types";

export function rawRequest(request: CapturedRequest): string {
  const lines = [
    `${request.method} ${request.path} HTTP/1.1`,
    ...request.headers.map(([name, value]) => `${name}: ${value}`),
  ];
  return request.body
    ? `${lines.join("\n")}\n\n${request.body}`
    : lines.join("\n");
}

export function formatResponse(response: CapturedResponse): string {
  const lines = [
    `HTTP/1.1 ${response.status} ${response.statusText}`,
    ...response.headers.map(([name, value]) => `${name}: ${value}`),
  ];
  return response.body
    ? `${lines.join("\n")}\n\n${response.body}`
    : lines.join("\n");
}

export function rawResponse(entry: CapturedExchange): string {
  return formatResponse(entry.response);
}

// Parses an editable raw HTTP request (request line, headers, blank
// line, body) back into the method/path/headers/body a request is made
// of. The target (scheme/host) isn't in the request line for an
// origin-form request, so it's carried separately by Repeater/Intruder.
export function parseRawRequest(
  raw: string,
): Pick<CapturedRequest, "method" | "path" | "headers" | "body"> {
  const normalized = raw.replace(/\r\n/g, "\n");
  const separator = normalized.indexOf("\n\n");
  const head = separator === -1 ? normalized : normalized.slice(0, separator);
  const bodyText = separator === -1 ? "" : normalized.slice(separator + 2);

  const lines = head.split("\n");
  const requestLine = lines.shift() ?? "";
  const [method = "GET", path = "/"] = requestLine.trim().split(/\s+/);

  const headers: [string, string][] = [];
  for (const line of lines) {
    if (line.trim() === "") continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    headers.push([line.slice(0, colon).trim(), line.slice(colon + 1).trim()]);
  }

  return {
    method: method.toUpperCase() as HttpMethod,
    path,
    headers,
    body: bodyText.length > 0 ? bodyText : undefined,
  };
}

const METHOD_COLOR: Record<HttpMethod, string> = {
  GET: "text-sky-400 border-sky-400/30 bg-sky-400/10",
  HEAD: "text-neutral-400 border-neutral-400/30 bg-neutral-400/10",
  POST: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  PUT: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  PATCH: "text-violet-400 border-violet-400/30 bg-violet-400/10",
  DELETE: "text-rose-400 border-rose-400/30 bg-rose-400/10",
  OPTIONS: "text-neutral-400 border-neutral-400/30 bg-neutral-400/10",
};

export function methodColor(method: HttpMethod): string {
  return METHOD_COLOR[method];
}

export function statusColor(status: number): string {
  if (status < 300)
    return "text-emerald-400 border-emerald-400/30 bg-emerald-400/10";
  if (status < 400) return "text-sky-400 border-sky-400/30 bg-sky-400/10";
  if (status < 500) return "text-amber-400 border-amber-400/30 bg-amber-400/10";
  return "text-rose-400 border-rose-400/30 bg-rose-400/10";
}
