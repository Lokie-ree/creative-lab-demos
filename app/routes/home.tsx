import { useState, useRef, useCallback, useEffect } from "react";
import * as THREE from "three";
import type { SolidId, ModeId } from "~/types";
import { ModeBar } from "~/components/ModeBar";
import { SolidScene } from "~/components/SolidScene";
import { SolidSelector } from "~/components/SolidSelector";
import { ShapeLabel } from "~/components/ShapeLabel";
import { useShapeClassifier } from "~/hooks/useShapeClassifier";

export function meta() {
  return [{ title: "Cross-Section Explorer" }];
}

export default function Home() {
  const [solidId, setSolidId] = useState<SolidId>("cone");
  const [mode, setMode] = useState<ModeId>("crossSection");
  const [csgGeometry, setCsgGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [planeInteracted, setPlaneInteracted] = useState(false);
  const [connectionVisible, setConnectionVisible] = useState(false);
  const connectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSolidChange = useCallback((id: SolidId) => {
    setSolidId(id);
    setCsgGeometry(null);
    setPlaneInteracted(false);
    setConnectionVisible(false);
  }, []);

  const handleInteract = useCallback(() => {
    setPlaneInteracted(true);
  }, []);

  const handleShapeChange = useCallback((geo: THREE.BufferGeometry) => {
    setCsgGeometry(geo.clone()); // clone so reference changes and useMemo re-runs
  }, []);

  const classifyResult = useShapeClassifier(csgGeometry, solidId, planeInteracted);

  // Show connection moment for 4s on first classify result per solid
  const prevKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!classifyResult) return;
    if (classifyResult.key === prevKeyRef.current) return;
    prevKeyRef.current = classifyResult.key;
    setConnectionVisible(true);
    if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
    connectionTimerRef.current = setTimeout(() => setConnectionVisible(false), 4000);
  }, [classifyResult?.key]);

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
      <div style={{ flex: 1, overflow: "hidden", minHeight: 0, position: "relative" }}>
        <SolidScene
          solidId={solidId}
          mode={mode}
          onInteract={handleInteract}
          onShapeChange={handleShapeChange}
        />
        {mode === "crossSection" && (
          <ShapeLabel result={classifyResult} connectionVisible={connectionVisible} />
        )}
      </div>
      <SolidSelector solidId={solidId} onSolidChange={handleSolidChange} />
    </div>
  );
}
