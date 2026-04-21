import { useReducer, useRef, useEffect } from "react";
import type { SolidId } from "~/types";
import { demoReducer, initialState } from "~/hooks/useDemoReducer";
import { ModeBar } from "~/components/ModeBar";
import { SolidScene } from "~/components/SolidScene";
import { SolidSelector } from "~/components/SolidSelector";
import { ShapeLabel } from "~/components/ShapeLabel";
import { useShapeClassifier } from "~/hooks/useShapeClassifier";

export function meta() {
  return [{ title: "Cross-Section Explorer" }];
}

export default function Home() {
  const [state, dispatch] = useReducer(demoReducer, initialState);
  const connectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const classifyResult = useShapeClassifier(
    state.csgGeometry,
    state.solidId,
    state.planeInteracted,
  );

  // Dispatch REVEAL_LABEL when classifier produces a new key
  useEffect(() => {
    if (!classifyResult) return;
    dispatch({ type: "REVEAL_LABEL", payload: { label: classifyResult.label, key: classifyResult.key } });
  }, [classifyResult?.key]);

  // Auto-dismiss connection moment after 4s
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

  const handleSolidChange = (id: SolidId) => {
    if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
    dispatch({ type: "SET_SOLID", payload: id });
  };

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
        />
        {state.mode === "crossSection" && (
          <ShapeLabel result={classifyResult} connectionVisible={state.connectionVisible} />
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
              onClick={() => {/* wired in Sub-pass B */}}
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
