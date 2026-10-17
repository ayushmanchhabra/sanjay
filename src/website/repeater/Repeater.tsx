import { useEffect, useState } from "react";

import { formatResponse, parseRawRequest, rawRequest } from "../proxy/format";
import { getServerBridge } from "../proxy/serverBridge";
import type { CapturedResponse } from "../proxy/types";
import type { RequestSeed } from "../screens";

type SendState =
  | { status: "empty" }
  | { status: "sending" }
  | { status: "done"; response: CapturedResponse }
  | { status: "error"; message: string };

export default function Repeater({ seed }: { seed?: RequestSeed }) {
  const bridge = getServerBridge();
  const [scheme, setScheme] = useState<"http" | "https">("https");
  const [host, setHost] = useState("");
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<SendState>({ status: "empty" });

  // Load a request sent over from the Proxy.
  useEffect(() => {
    if (!seed) return;
    setScheme(seed.request.scheme);
    setHost(seed.request.host);
    setRaw(rawRequest(seed.request));
    setResult({ status: "empty" });
  }, [seed]);

  async function send() {
    if (!bridge || host.trim() === "") return;
    setResult({ status: "sending" });
    try {
      const response = await bridge.sendRequest({
        scheme,
        host: host.trim(),
        ...parseRawRequest(raw),
      });
      setResult({ status: "done", response });
    } catch (err) {
      setResult({ status: "error", message: (err as Error).message });
    }
  }

  return (
    <div className="flex h-full w-full flex-col bg-neutral-950 text-neutral-200">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-neutral-800 bg-neutral-900 px-4">
        <span className="mr-1 text-sm font-semibold text-neutral-100">
          Repeater
        </span>
        <select
          value={scheme}
          onChange={(event) =>
            setScheme(event.target.value as "http" | "https")
          }
          className="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-1 text-xs text-neutral-200"
        >
          <option value="https">https</option>
          <option value="http">http</option>
        </select>
        <input
          value={host}
          onChange={(event) => setHost(event.target.value)}
          placeholder="host[:port]"
          className="w-64 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-200 placeholder:text-neutral-600"
        />
        <button
          type="button"
          disabled={
            !bridge || host.trim() === "" || result.status === "sending"
          }
          onClick={send}
          title={bridge ? undefined : "Only available in the desktop app"}
          className="rounded border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-300 hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-sky-400/10"
        >
          {result.status === "sending" ? "Sending…" : "Send"}
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-2">
        <div className="flex min-h-0 flex-col border-r border-neutral-800">
          <div className="flex h-8 shrink-0 items-center border-b border-neutral-800 bg-neutral-900/60 px-3 text-xs font-medium tracking-wide text-neutral-500 uppercase">
            Request
          </div>
          <textarea
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            spellCheck={false}
            placeholder="Send a request here from the Proxy, or type one."
            className="min-h-0 flex-1 resize-none bg-neutral-950 p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-neutral-300 placeholder:text-neutral-600 focus:outline-none"
          />
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="flex h-8 shrink-0 items-center border-b border-neutral-800 bg-neutral-900/60 px-3 text-xs font-medium tracking-wide text-neutral-500 uppercase">
            Response
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-neutral-950 p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-neutral-300">
            {result.status === "done" && formatResponse(result.response)}
            {result.status === "error" && (
              <span className="text-rose-400">{result.message}</span>
            )}
            {result.status === "sending" && (
              <span className="text-neutral-500">Waiting for response…</span>
            )}
            {result.status === "empty" && (
              <span className="text-neutral-600">No response yet</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
