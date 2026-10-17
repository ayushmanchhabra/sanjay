import { Fragment, useEffect, useRef, useState } from "react";

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
  // The actual request sent, with the payload substituted in — shown
  // and highlighted in the detail pane.
  request: string;
  status?: number;
  length?: number;
  timeMs: number;
  error?: string;
  response?: CapturedResponse;
}

// A single configured attack, with its own request, payloads and
// results. Each Intruder tab holds one.
interface AttackTab {
  id: number;
  scheme: "http" | "https";
  host: string;
  template: string;
  payloadsText: string;
  rows: AttackRow[];
  selectedRow?: number;
  running: boolean;
}

function blankTab(id: number): AttackTab {
  return {
    id,
    scheme: "https",
    host: "",
    template: "",
    payloadsText: "",
    rows: [],
    running: false,
  };
}

// A short label for the tab strip, derived from the request line.
function tabTitle(tab: AttackTab): string {
  const firstLine = tab.template.split("\n")[0]?.trim();
  if (!firstLine) return "New";
  const [method = "", path = "/"] = firstLine.split(/\s+/);
  const shortPath = path.length > 18 ? `${path.slice(0, 18)}…` : path;
  return `${method} ${shortPath}`.trim();
}

// Renders `text` with every occurrence of `needle` highlighted. Used to
// mark where the payload landed in the request, and where it's
// reflected in the response.
function Highlight({ text, needle }: { text: string; needle: string }) {
  if (needle === "") return <>{text}</>;
  const parts = text.split(needle);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {part}
          {index < parts.length - 1 && (
            <mark className="rounded-sm bg-amber-400/30 text-amber-200">
              {needle}
            </mark>
          )}
        </Fragment>
      ))}
    </>
  );
}

export default function Intruder({ seed }: { seed?: RequestSeed }) {
  const bridge = getServerBridge();
  const [tabs, setTabs] = useState<AttackTab[]>(() => [blankTab(0)]);
  const [activeId, setActiveId] = useState(0);
  const nextId = useRef(1);
  // The last seed opened as a tab, so a dependency re-run (eg. React
  // StrictMode) doesn't open the same request twice.
  const loadedNonce = useRef<number | undefined>(undefined);
  const templateRef = useRef<HTMLTextAreaElement>(null);

  // Each "Send to Intruder" opens the request in a new tab.
  useEffect(() => {
    if (!seed || seed.nonce === loadedNonce.current) return;
    loadedNonce.current = seed.nonce;
    const id = nextId.current++;
    setTabs((prev) => [
      ...prev,
      {
        ...blankTab(id),
        scheme: seed.request.scheme,
        host: seed.request.host,
        template: rawRequest(seed.request),
      },
    ]);
    setActiveId(id);
  }, [seed]);

  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  function patchTab(id: number, patch: Partial<AttackTab>) {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)),
    );
  }

  function patchActive(patch: Partial<AttackTab>) {
    patchTab(active.id, patch);
  }

  function addTab() {
    const tab = blankTab(nextId.current++);
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
  }

  function closeTab(id: number) {
    const index = tabs.findIndex((tab) => tab.id === id);
    const remaining = tabs.filter((tab) => tab.id !== id);
    // Keep at least one tab around.
    if (remaining.length === 0) {
      const tab = blankTab(nextId.current++);
      setTabs([tab]);
      setActiveId(tab.id);
      return;
    }
    setTabs(remaining);
    if (id === activeId) {
      const neighbor = remaining[Math.min(index, remaining.length - 1)];
      setActiveId(neighbor.id);
    }
  }

  const positions = (active.template.match(MARKER) ?? []).length;
  const payloads = active.payloadsText
    .split("\n")
    .filter((line) => line.length > 0);

  // Wraps the active tab's textarea selection in § markers, marking it
  // as a payload position.
  function addMarker() {
    const textarea = templateRef.current;
    if (!textarea) return;
    const { selectionStart, selectionEnd } = textarea;
    const { template } = active;
    patchActive({
      template:
        template.slice(0, selectionStart) +
        "§" +
        template.slice(selectionStart, selectionEnd) +
        "§" +
        template.slice(selectionEnd),
    });
  }

  // Removes payload positions, keeping the text they wrapped. With a
  // selection, only markers inside it are removed; otherwise all of them.
  function clearMarkers() {
    const textarea = templateRef.current;
    const { template } = active;
    const { selectionStart, selectionEnd } = textarea ?? {
      selectionStart: 0,
      selectionEnd: 0,
    };
    if (textarea && selectionStart !== selectionEnd) {
      patchActive({
        template:
          template.slice(0, selectionStart) +
          template.slice(selectionStart, selectionEnd).replaceAll("§", "") +
          template.slice(selectionEnd),
      });
    } else {
      patchActive({ template: template.replaceAll("§", "") });
    }
  }

  async function start() {
    // The attack snapshots the tab's config and writes results back by
    // tab id, so switching tabs (or editing another) while it runs is
    // safe.
    const tab = active;
    const attackPayloads = tab.payloadsText
      .split("\n")
      .filter((line) => line.length > 0);
    const attackPositions = (tab.template.match(MARKER) ?? []).length;
    if (
      !bridge ||
      tab.host.trim() === "" ||
      attackPayloads.length === 0 ||
      attackPositions === 0
    ) {
      return;
    }

    patchTab(tab.id, { running: true, rows: [], selectedRow: undefined });
    const collected: AttackRow[] = [];
    for (const payload of attackPayloads) {
      const substituted = tab.template.replace(MARKER, payload);
      const startedAt = performance.now();
      try {
        const response = await bridge.sendRequest({
          scheme: tab.scheme,
          host: tab.host.trim(),
          ...parseRawRequest(substituted),
        });
        collected.push({
          payload,
          request: substituted,
          status: response.status,
          length: response.body?.length ?? 0,
          timeMs: Math.round(performance.now() - startedAt),
          response,
        });
      } catch (err) {
        collected.push({
          payload,
          request: substituted,
          timeMs: Math.round(performance.now() - startedAt),
          error: (err as Error).message,
        });
      }
      // Render each result as it lands, so a long list shows progress.
      patchTab(tab.id, { rows: [...collected] });
    }
    patchTab(tab.id, { running: false });
  }

  const selected =
    active.selectedRow !== undefined
      ? active.rows[active.selectedRow]
      : undefined;

  return (
    <div className="flex h-full w-full flex-col bg-neutral-950 text-neutral-200">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-neutral-800 bg-neutral-900 px-4">
        <span className="mr-1 text-sm font-semibold text-neutral-100">
          Intruder
        </span>
        <select
          value={active.scheme}
          onChange={(event) =>
            patchActive({ scheme: event.target.value as "http" | "https" })
          }
          className="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-1 text-xs text-neutral-200"
        >
          <option value="https">https</option>
          <option value="http">http</option>
        </select>
        <input
          value={active.host}
          onChange={(event) => patchActive({ host: event.target.value })}
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
        <button
          type="button"
          disabled={positions === 0}
          onClick={clearMarkers}
          className="rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-neutral-800"
        >
          Clear markers
        </button>
        <span className="text-xs text-neutral-500">
          {positions} position{positions === 1 ? "" : "s"} · {payloads.length}{" "}
          payload{payloads.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          disabled={
            !bridge ||
            active.host.trim() === "" ||
            payloads.length === 0 ||
            positions === 0 ||
            active.running
          }
          onClick={start}
          title={bridge ? undefined : "Only available in the desktop app"}
          className="ml-auto rounded border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-300 hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-sky-400/10"
        >
          {active.running ? "Attacking…" : "Start attack"}
        </button>
      </header>

      <div className="flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b border-neutral-800 bg-neutral-900/60 px-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <div
              key={tab.id}
              className={`flex shrink-0 items-center rounded-t border-b-2 text-xs ${
                isActive
                  ? "border-b-sky-500 text-neutral-100"
                  : "border-b-transparent text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveId(tab.id)}
                className="flex max-w-[12rem] items-center gap-1.5 py-1 pr-1 pl-2 font-mono"
              >
                {tab.running && (
                  <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-400" />
                )}
                <span className="truncate">{tabTitle(tab)}</span>
              </button>
              <button
                type="button"
                onClick={() => closeTab(tab.id)}
                title="Close tab"
                className="rounded px-1 py-1 text-neutral-600 hover:bg-neutral-700 hover:text-neutral-200"
              >
                ×
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={addTab}
          title="New tab"
          className="shrink-0 rounded px-2 py-0.5 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
        >
          +
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 border-b border-neutral-800">
        <div className="flex min-h-0 flex-col border-r border-neutral-800">
          <div className="flex h-8 shrink-0 items-center border-b border-neutral-800 bg-neutral-900/60 px-3 text-xs font-medium tracking-wide text-neutral-500 uppercase">
            Request template
          </div>
          <textarea
            ref={templateRef}
            value={active.template}
            onChange={(event) => patchActive({ template: event.target.value })}
            spellCheck={false}
            placeholder="Send a request here from the Proxy, then wrap payload positions in § markers."
            className="min-h-0 flex-[3] resize-none bg-neutral-950 p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-neutral-300 placeholder:text-neutral-600 focus:outline-none"
          />
          <div className="flex h-8 shrink-0 items-center border-y border-neutral-800 bg-neutral-900/60 px-3 text-xs font-medium tracking-wide text-neutral-500 uppercase">
            Payloads · one per line
          </div>
          <textarea
            value={active.payloadsText}
            onChange={(event) =>
              patchActive({ payloadsText: event.target.value })
            }
            spellCheck={false}
            placeholder={"admin\nroot\ntest"}
            className="min-h-0 flex-[2] resize-none bg-neutral-950 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-neutral-300 placeholder:text-neutral-600 focus:outline-none"
          />
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="flex h-8 shrink-0 items-center border-b border-neutral-800 bg-neutral-900/60 px-3 text-xs font-medium tracking-wide text-neutral-500 uppercase">
            Results
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="sticky top-0 grid grid-cols-[1fr_4rem_5rem_5rem] gap-2 border-b border-neutral-800 bg-neutral-900 px-3 py-1.5 text-[10px] font-medium tracking-wide text-neutral-500 uppercase">
              <span>Payload</span>
              <span className="text-right">Status</span>
              <span className="text-right">Length</span>
              <span className="text-right">Time</span>
            </div>
            {active.rows.length === 0 ? (
              <div className="p-3 text-xs text-neutral-600">
                {active.running ? "Running…" : "No results yet"}
              </div>
            ) : (
              active.rows.map((row, index) => (
                <button
                  type="button"
                  key={index}
                  onClick={() => patchActive({ selectedRow: index })}
                  className={`grid w-full grid-cols-[1fr_4rem_5rem_5rem] items-center gap-2 border-l-2 px-3 py-1 text-left text-xs ${
                    index === active.selectedRow
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
        </div>
      </div>

      {/* The selected result's request and response, side by side, with
          the payload highlighted in each. */}
      <div className="grid min-h-0 flex-1 grid-cols-2">
        <div className="flex min-h-0 flex-col border-r border-neutral-800">
          <div className="flex h-8 shrink-0 items-center gap-2 border-b border-neutral-800 bg-neutral-900/60 px-3 text-xs font-medium tracking-wide text-neutral-500 uppercase">
            <span>Request</span>
            {selected && (
              <span className="truncate font-normal text-amber-300/80 normal-case">
                payload: {selected.payload}
              </span>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-neutral-950 p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-neutral-300">
            {selected ? (
              <Highlight text={selected.request} needle={selected.payload} />
            ) : (
              <span className="text-neutral-600">Select a result</span>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="flex h-8 shrink-0 items-center border-b border-neutral-800 bg-neutral-900/60 px-3 text-xs font-medium tracking-wide text-neutral-500 uppercase">
            Response
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-neutral-950 p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-neutral-300">
            {selected?.response ? (
              <Highlight
                text={formatResponse(selected.response)}
                needle={selected.payload}
              />
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
