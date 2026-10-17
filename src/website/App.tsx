import { useState } from "react";

import Sidebar from "./Sidebar";
import Intruder from "./intruder/Intruder";
import Proxy from "./proxy/Proxy";
import type { CapturedRequest } from "./proxy/types";
import Repeater from "./repeater/Repeater";
import type { RequestSeed, Screen } from "./screens";

export default function App() {
  const [screen, setScreen] = useState<Screen>("proxy");
  const [repeaterSeed, setRepeaterSeed] = useState<RequestSeed | undefined>();
  const [intruderSeed, setIntruderSeed] = useState<RequestSeed | undefined>();

  function sendToRepeater(request: CapturedRequest) {
    setRepeaterSeed({ request, nonce: Date.now() });
    setScreen("repeater");
  }

  function sendToIntruder(request: CapturedRequest) {
    setIntruderSeed({ request, nonce: Date.now() });
    setScreen("intruder");
  }

  // Every screen stays mounted and inactive ones are hidden, so their
  // state (a Repeater response, an Intruder run) survives navigation.
  return (
    <div className="flex h-screen w-screen bg-neutral-950 text-neutral-200">
      <Sidebar screen={screen} onNavigate={setScreen} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Pane active={screen === "proxy"}>
          <Proxy
            onSendToRepeater={sendToRepeater}
            onSendToIntruder={sendToIntruder}
          />
        </Pane>
        <Pane active={screen === "repeater"}>
          <Repeater seed={repeaterSeed} />
        </Pane>
        <Pane active={screen === "intruder"}>
          <Intruder seed={intruderSeed} />
        </Pane>
      </div>
    </div>
  );
}

function Pane({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={active ? "flex min-h-0 flex-1" : "hidden"}>{children}</div>
  );
}
