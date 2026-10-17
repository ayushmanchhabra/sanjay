import { useEffect, useRef, useState } from "react";

import { formatResponse, parseRawRequest, rawRequest } from "../proxy/format";
import { getServerBridge } from "../proxy/serverBridge";
import type { CapturedResponse } from "../proxy/types";
import type { RequestSeed } from "../screens";

type SendState =
  | { status: "empty" }
  | { status: "sending" }
  | { status: "done"; response: CapturedResponse }
  | { status: "error"; message: string };

interface RepeaterTab {
  id: number;
  scheme: "http" | "https";
  host: string;
  raw: string;
  result: SendState;
}

function blankTab(id: number): RepeaterTab {
  return {
    id,
    scheme: "https",
    host: "",
    raw: "",
    result: { status: "empty" },
  };
}

// A short label for the tab strip, derived from the request line.
function tabTitle(tab: RepeaterTab): string {
  const firstLine = tab.raw.split("\n")[0]?.trim();
  if (!firstLine) return "New";
  const [method = "", path = "/"] = firstLine.split(/\s+/);
  const shortPath = path.length > 20 ? `${path.slice(0, 20)}…` : path;
  return `${method} ${shortPath}`.trim();
}

export default function Repeater({ seed }: { seed?: RequestSeed }) {
  const bridge = getServerBridge();
  const [tabs, setTabs] = useState<RepeaterTab[]>(() => [blankTab(0)]);
  const [activeId, setActiveId] = useState(0);
  const nextId = useRef(1);
  // The last seed turned into a tab, so a dependency re-run (eg. React
  // StrictMode) doesn't open the same request twice.
  const loadedNonce = useRef<number | undefined>(undefined);

  // Each "Send to Repeater" opens the request in a new tab.
  useEffect(() => {
    if (!seed || seed.nonce === loadedNonce.current) return;
    loadedNonce.current = seed.nonce;
    const id = nextId.current++;
    setTabs((prev) => [
      ...prev,
      {
        id,
        scheme: seed.request.scheme,
        host: seed.request.host,
        raw: rawRequest(seed.request),
        result: { status: "empty" },
      },
    ]);
    setActiveId(id);
  }, [seed]);

  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  function patchActive(patch: Partial<RepeaterTab>) {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === active.id ? { ...tab, ...patch } : tab)),
    );
  }

  function setResult(id: number, result: SendState) {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === id ? { ...tab, result } : tab)),
    );
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

  async function send() {
    // The result is keyed to this tab's id, so switching tabs while a
    // request is in flight doesn't misfile the response.
    const tab = active;
    if (!bridge || tab.host.trim() === "") return;
    setResult(tab.id, { status: "sending" });
    try {
      const response = await bridge.sendRequest({
        scheme: tab.scheme,
        host: tab.host.trim(),
        ...parseRawRequest(tab.raw),
      });
      setResult(tab.id, { status: "done", response });
    } catch (err) {
      setResult(tab.id, { status: "error", message: (err as Error).message });
    }
  }

  return (
    <div className="flex h-full w-full flex-col bg-neutral-950 text-neutral-200">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-neutral-800 bg-neutral-900 px-4">
        <span className="mr-1 text-sm font-semibold text-neutral-100">
          Repeater
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
          className="w-64 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-200 placeholder:text-neutral-600"
        />
        <button
          type="button"
          disabled={
            !bridge ||
            active.host.trim() === "" ||
            active.result.status === "sending"
          }
          onClick={send}
          title={bridge ? undefined : "Only available in the desktop app"}
          className="rounded border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-300 hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-sky-400/10"
        >
          {active.result.status === "sending" ? "Sending…" : "Send"}
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
                className="max-w-[12rem] truncate py-1 pr-1 pl-2 font-mono"
              >
                {tabTitle(tab)}
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

      <div className="grid min-h-0 flex-1 grid-cols-2">
        <div className="flex min-h-0 flex-col border-r border-neutral-800">
          <div className="flex h-8 shrink-0 items-center border-b border-neutral-800 bg-neutral-900/60 px-3 text-xs font-medium tracking-wide text-neutral-500 uppercase">
            Request
          </div>
          <textarea
            value={active.raw}
            onChange={(event) => patchActive({ raw: event.target.value })}
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
            {active.result.status === "done" &&
              formatResponse(active.result.response)}
            {active.result.status === "error" && (
              <span className="text-rose-400">{active.result.message}</span>
            )}
            {active.result.status === "sending" && (
              <span className="text-neutral-500">Waiting for response…</span>
            )}
            {active.result.status === "empty" && (
              <span className="text-neutral-600">No response yet</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
