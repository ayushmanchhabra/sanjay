import type { Screen } from "./screens";

const SCREENS: { id: Screen; label: string }[] = [
  { id: "proxy", label: "Proxy" },
  { id: "repeater", label: "Repeater" },
  { id: "intruder", label: "Intruder" },
];

export default function Sidebar({
  screen,
  onNavigate,
}: {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
}) {
  return (
    <nav className="flex w-40 shrink-0 flex-col border-r border-neutral-800 bg-neutral-900">
      <div className="flex h-11 shrink-0 items-center border-b border-neutral-800 px-4 text-sm font-semibold tracking-wide text-neutral-100">
        Sanjay
      </div>
      <div className="flex flex-col gap-0.5 p-2">
        {SCREENS.map(({ id, label }) => {
          const isActive = id === screen;
          return (
            <button
              type="button"
              key={id}
              onClick={() => onNavigate(id)}
              className={`rounded px-3 py-1.5 text-left text-sm transition-colors ${
                isActive
                  ? "bg-sky-500/15 font-medium text-sky-300"
                  : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
