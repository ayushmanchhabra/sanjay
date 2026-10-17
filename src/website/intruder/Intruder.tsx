import { useEffect, useRef, useState } from "react";

import {
  formatResponse,
  parseRawRequest,
  rawRequest,
  statusColor,
} from "../proxy/format";
import { getServerBridge } from "../proxy/serverBridge";
import type { CapturedResponse } from "../proxy/types";
import type { RequestSeed } from "../screens";

// A payload position is any run of text wrapped in § markers, eg.
// "id=§1§". Each attack request replaces every marker with the payload.
const MARKER = /§[^§]*§/g;

interface AttackRow {
  payload: string;
  status?: number;
  length?: number;
  timeMs: number;
  error?: string;
  response?: CapturedResponse;
}

export default function Intruder({ seed }: { seed?: RequestSeed }) {
  const bridge = getServerBridge();
  const [scheme, setScheme] = useState<"http" | "https">("https");
  const [host, setHost] = useState("");
  const [template, setTemplate] = useState("");
  const [payloadsText, setPayloadsText] = useState("");
  const [rows, setRows] = useState<AttackRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<number | undefined>(undefined);
  const [running, setRunning] = useState(false);
  const templateRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!seed) return;
    setScheme(seed.request.scheme);
    setHost(seed.request.host);
    setTemplate(rawRequest(seed.request));
    setRows([]);
    setSelectedRow(undefined);
  }, [seed]);

  const positions = (template.match(MARKER) ?? []).length;
  const payloads = payloadsText.split("\n").filter((line) => line.length > 0);

  // Wraps the current textarea selection in § markers, marking it as a
  // payload position.
  function addMarker() {
    const textarea = templateRef.current;
    if (!textarea) return;
    const { selectionStart, selectionEnd } = textarea;
    setTemplate(
      template.slice(0, selectionStart) +
        "§" +
        template.slice(selectionStart, selectionEnd) +
        "§" +
        template.slice(selectionEnd),
    );
  }

  async function start() {
    if (!bridge || host.trim() === "" || payloads.length === 0) return;
    setRunning(true);
    setRows([]);
    setSelectedRow(undefined);

    const collected: AttackRow[] = [];
    for (const payload of payloads) {
      const substituted = template.replace(MARKER, payload);
      const startedAt = performance.now();
      try {
        const response = await bridge.sendRequest({
          scheme,
          host: host.trim(),
          ...parseRawRequest(substituted),
        });
        collected.push({
          payload,
          status: response.status,
          length: response.body?.length ?? 0,
          timeMs: Math.round(performance.now() - startedAt),
          response,
        });
      } catch (err) {
        collected.push({
          payload,
          timeMs: Math.round(performance.now() - startedAt),
          error: (err as Error).message,
        });
      }
      // Render each result as it lands, so a long list shows progress.
      setRows([...collected]);
    }
    setRunning(false);
  }

  const selected = selectedRow !== undefined ? rows[selectedRow] : undefined;

  return (
    <div className="flex h-full w-full flex-col bg-neutral-950 text-neutral-200">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-neutral-800 bg-neutral-900 px-4">
        <span className="mr-1 text-sm font-semibold text-neutral-100">
          Intruder
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
          className="w-56 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-200 placeholder:text-neutral-600"
        />
        <button
          type="button"
          onClick={addMarker}
          className="rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-700"
        >
          Add § marker
        </button>
        <span className="text-xs text-neutral-500">
          {positions} position{positions === 1 ? "" : "s"} · {payloads.length}{" "}
          payload{payloads.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          disabled={
            !bridge ||
            host.trim() === "" ||
            payloads.length === 0 ||
            positions === 0 ||
            running
          }
          onClick={start}
          title={bridge ? undefined : "Only available in the desktop app"}
          className="ml-auto rounded border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-300 hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-sky-400/10"
        >
          {running ? "Attacking…" : "Start attack"}
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-2">
        <div className="flex min-h-0 flex-col border-r border-neutral-800">
          <div className="flex h-8 shrink-0 items-center border-b border-neutral-800 bg-neutral-900/60 px-3 text-xs font-medium tracking-wide text-neutral-500 uppercase">
            Request template
          </div>
          <textarea
            ref={templateRef}
            value={template}
            onChange={(event) => setTemplate(event.target.value)}
            spellCheck={false}
            placeholder="Send a request here from the Proxy, then wrap payload positions in § markers."
            className="min-h-0 flex-[3] resize-none bg-neutral-950 p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-neutral-300 placeholder:text-neutral-600 focus:outline-none"
          />
          <div className="flex h-8 shrink-0 items-center border-y border-neutral-800 bg-neutral-900/60 px-3 text-xs font-medium tracking-wide text-neutral-500 uppercase">
            Payloads · one per line
          </div>
          <textarea
            value={payloadsText}
            onChange={(event) => setPayloadsText(event.target.value)}
            spellCheck={false}
            placeholder={"admin\nroot\ntest"}
            className="min-h-0 flex-[2] resize-none bg-neutral-950 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-neutral-300 placeholder:text-neutral-600 focus:outline-none"
          />
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="flex h-8 shrink-0 items-center border-b border-neutral-800 bg-neutral-900/60 px-3 text-xs font-medium tracking-wide text-neutral-500 uppercase">
            Results
          </div>
          <div className="min-h-0 flex-[2] overflow-auto">
            <div className="sticky top-0 grid grid-cols-[1fr_4rem_5rem_5rem] gap-2 border-b border-neutral-800 bg-neutral-900 px-3 py-1.5 text-[10px] font-medium tracking-wide text-neutral-500 uppercase">
              <span>Payload</span>
              <span className="text-right">Status</span>
              <span className="text-right">Length</span>
              <span className="text-right">Time</span>
            </div>
            {rows.length === 0 ? (
              <div className="p-3 text-xs text-neutral-600">
                {running ? "Running…" : "No results yet"}
              </div>
            ) : (
              rows.map((row, index) => (
                <button
                  type="button"
                  key={index}
                  onClick={() => setSelectedRow(index)}
                  className={`grid w-full grid-cols-[1fr_4rem_5rem_5rem] items-center gap-2 border-l-2 px-3 py-1 text-left text-xs ${
                    index === selectedRow
                      ? "border-l-sky-500 bg-sky-500/10"
                      : "border-l-transparent hover:bg-neutral-900"
                  }`}
                >
                  <span className="truncate font-mono text-neutral-300">
                    {row.payload}
                  </span>
                  {row.error ? (
                    <span className="col-span-3 text-right text-rose-400">
                      {row.error}
                    </span>
                  ) : (
                    <>
                      <span className="text-right">
                        <span
                          className={`inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${statusColor(
                            row.status ?? 0,
                          )}`}
                        >
                          {row.status}
                        </span>
                      </span>
                      <span className="text-right font-mono tabular-nums text-neutral-400">
                        {row.length}
                      </span>
                      <span className="text-right font-mono tabular-nums text-neutral-500">
                        {row.timeMs}ms
                      </span>
                    </>
                  )}
                </button>
              ))
            )}
          </div>
          <div className="flex h-8 shrink-0 items-center border-y border-neutral-800 bg-neutral-900/60 px-3 text-xs font-medium tracking-wide text-neutral-500 uppercase">
            Response
          </div>
          <div className="min-h-0 flex-[3] overflow-auto bg-neutral-950 p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-neutral-300">
            {selected?.response ? (
              formatResponse(selected.response)
            ) : selected?.error ? (
              <span className="text-rose-400">{selected.error}</span>
            ) : (
              <span className="text-neutral-600">Select a result</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
