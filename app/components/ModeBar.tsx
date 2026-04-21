import type { ModeId, SolidId } from "~/types";

interface ModeBarProps {
  mode: ModeId;
  onModeChange: (mode: ModeId) => void;
  solidId: SolidId;
}

const segmentStyle = (active: boolean, disabled?: boolean): React.CSSProperties => ({
  width: "50%",
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

export function ModeBar({ mode, onModeChange, solidId }: ModeBarProps) {
  const rotationDisabled = solidId === "cube";

  return (
    <div style={{ flexShrink: 0 }}>
      <div
        style={{
          height: 48,
          display: "flex",
          alignItems: "stretch",
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-rule)",
          position: "relative",
        }}
      >
        <button
          style={segmentStyle(mode === "crossSection")}
          onClick={() => onModeChange("crossSection")}
        >
          Cross Section
        </button>
        <button
          style={segmentStyle(mode === "rotation", rotationDisabled)}
          onClick={() => !rotationDisabled && onModeChange("rotation")}
        >
          Rotation
        </button>
        <button
          disabled
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            height: 28,
            padding: "0 12px",
            border: "1px solid var(--color-rule)",
            background: "transparent",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            letterSpacing: "0.08em",
            color: "var(--color-muted)",
            cursor: "default",
          }}
        >
          ◆ PHYSICS
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
