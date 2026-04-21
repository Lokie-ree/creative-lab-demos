import { useReducer, useRef, useEffect } from "react";
import type { SolidId } from "~/types";
import { demoReducer, initialState } from "~/hooks/useDemoReducer";
import { useSolidRotation } from "~/hooks/useSolidRotation";
import { rotationMaterial, silhouetteMaterial } from "~/data/materials";
import { ModeBar } from "~/components/ModeBar";
import { SolidScene } from "~/components/SolidScene";
import { SolidSelector } from "~/components/SolidSelector";
import { ShapeLabel } from "~/components/ShapeLabel";
import { useShapeClassifier } from "~/hooks/useShapeClassifier";

export function meta() {
  return [{ title: "Cross-Section Explorer" }];
}

const ROTATION_LABELS: Record<string, string> = {
  cone: "cone",
  cylinder: "cylinder",
  sphere: "sphere",
};

export default function Home() {
  const [state, dispatch] = useReducer(demoReducer, initialState);
  const connectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRotationComplete = () => {
    dispatch({ type: "COMPLETE_ROTATION" });
  };

  const { angle: rotationAngle, geometry: rotationGeometry, start, reset } = useSolidRotation(
    state.solidId,
    handleRotationComplete,
  );

  const classifyResult = useShapeClassifier(
    state.csgGeometry,
    state.solidId,
    state.planeInteracted,
  );

  useEffect(() => {
    if (!classifyResult) return;
    dispatch({ type: "REVEAL_LABEL", payload: { label: classifyResult.label, key: classifyResult.key } });
  }, [classifyResult?.key]);

  useEffect(() => {
    if (!state.connectionVisible) return;
    if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
    connectionTimerRef.current = setTimeout(() => {
      dispatch({ type: "HIDE_CONNECTION" });
    }, 4000);
    return () => {
      if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
    };
  }, [state.connectionVisible]);

  useEffect(() => {
    reset();
    rotationMaterial.opacity = 0;
    silhouetteMaterial.opacity = 0.75; // restore after rotation-complete fade
  }, [state.solidId]);

  const handleSolidChange = (id: SolidId) => {
    if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
    dispatch({ type: "SET_SOLID", payload: id });
  };

  const rotationLabel =
    state.rotationComplete && state.mode === "rotation"
      ? ROTATION_LABELS[state.solidId]
      : undefined;

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
      <ModeBar
        mode={state.mode}
        onModeChange={(m) => dispatch({ type: "SET_MODE", payload: m })}
        solidId={state.solidId}
      />
      <div style={{ flex: 1, overflow: "hidden", minHeight: 0, position: "relative" }}>
        <SolidScene
          solidId={state.solidId}
          mode={state.mode}
          onInteract={() => dispatch({ type: "PLANE_INTERACTED" })}
          onShapeChange={(geo) => dispatch({ type: "SET_CSG_GEOMETRY", payload: geo.clone() })}
          rotationAngle={rotationAngle}
          rotationComplete={state.rotationComplete}
          rotationGeometry={rotationGeometry}
        />
        {state.mode === "crossSection" && (
          <ShapeLabel result={classifyResult} connectionVisible={state.connectionVisible} />
        )}
        {state.mode === "rotation" && state.rotationComplete && (
          <ShapeLabel
            result={null}
            connectionVisible={state.connectionVisible}
            rotationLabel={rotationLabel}
          />
        )}
        {state.mode === "rotation" && state.solidId !== "cube" && (
          <div
            style={{
              position: "absolute",
              bottom: 80,
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            <button
              onClick={() => (state.rotationComplete ? reset() : start())}
              style={{
                height: 36,
                padding: "0 20px",
                border: "1px solid var(--color-rule)",
                background: "transparent",
                color: "var(--color-amber)",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                letterSpacing: "0.12em",
                cursor: "pointer",
              }}
            >
              {state.rotationComplete ? "RESET" : "ROTATE →"}
            </button>
          </div>
        )}
      </div>
      <SolidSelector solidId={state.solidId} onSolidChange={handleSolidChange} />
    </div>
  );
}
