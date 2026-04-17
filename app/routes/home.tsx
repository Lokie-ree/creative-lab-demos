import { useState } from "react";
import type { SolidId, ModeId } from "~/types";
import { ModeBar } from "~/components/ModeBar";
import { SolidScene } from "~/components/SolidScene";
import { SolidSelector } from "~/components/SolidSelector";

export function meta() {
  return [{ title: "Cross-Section Explorer" }];
}

export default function Home() {
  const [solidId, setSolidId] = useState<SolidId>("cone");
  const [mode, setMode] = useState<ModeId>("crossSection");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
        background: "var(--color-ground)",
      }}
    >
      <ModeBar mode={mode} onModeChange={setMode} />
      <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
        <SolidScene solidId={solidId} mode={mode} />
      </div>
      <SolidSelector solidId={solidId} onSolidChange={setSolidId} />
    </div>
  );
}
