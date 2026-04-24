import type { ModeId, SolidId } from "~/types";

interface ModeBarProps {
  mode: ModeId;
  onModeChange: (mode: ModeId) => void;
  solidId: SolidId;
  physicsMode: boolean;
  onPhysicsToggle: () => void;
  rotationComplete: boolean;
}

const segmentStyle = (active: boolean, disabled?: boolean): React.CSSProperties => ({
  flex: 1,
  height: "100%",
  border: "none",
  background: active ? "var(--color-surface-hi)" : "transparent",
  color: active ? "var(--color-amber)" : "var(--color-muted)",
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: disabled ? "default" : "pointer",
  pointerEvents: disabled ? "none" : "auto",
  opacity: disabled ? 0.4 : 1,
});

export function ModeBar({ mode, onModeChange, solidId, physicsMode, onPhysicsToggle, rotationComplete }: ModeBarProps) {
  const rotationDisabled = solidId === "cube";
  const physicsDisabled = mode === "rotation" && !rotationComplete;

  return (
    <div style={{ flexShrink: 0 }}>
      <div
        style={{
          height: 48,
          display: "flex",
          alignItems: "stretch",
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-rule)",
        }}
      >
        <button
          style={segmentStyle(mode === "crossSection")}
          onClick={() => onModeChange("crossSection")}
        >
          <span className="mode-label-full">Cross Section</span>
          <span className="mode-label-short">CS</span>
        </button>
        <button
          style={segmentStyle(mode === "rotation", rotationDisabled)}
          onClick={() => !rotationDisabled && onModeChange("rotation")}
        >
          <span className="mode-label-full">Rotation</span>
          <span className="mode-label-short">ROT</span>
        </button>
        <button
          onClick={physicsDisabled ? undefined : onPhysicsToggle}
          disabled={physicsDisabled}
          className="physics-btn"
          style={{
            flex: "0 0 auto",
            height: "100%",
            padding: "0 16px",
            border: "none",
            borderLeft: `1px solid ${physicsMode && !physicsDisabled ? "var(--color-amber)" : "var(--color-rule)"}`,
            background: "transparent",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            letterSpacing: "0.08em",
            color: physicsMode && !physicsDisabled ? "var(--color-amber)" : "var(--color-muted)",
            cursor: physicsDisabled ? "not-allowed" : "pointer",
            opacity: physicsDisabled ? 0.4 : 1,
          }}
        >
          <span>◆</span>
          <span className="physics-btn-label"> PHYSICS</span>
        </button>
      </div>
      {rotationDisabled && (
        <div
          style={{
            position: "absolute",
            top: 48,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 11,
            color: "var(--color-muted)",
            fontFamily: "'DM Sans', sans-serif",
            letterSpacing: "0.04em",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          Cube is not a solid of revolution
        </div>
      )}
    </div>
  );
}
