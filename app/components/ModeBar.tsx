import type { ModeId } from "~/types";

interface ModeBarProps {
  mode: ModeId;
  onModeChange: (mode: ModeId) => void;
}

const segmentStyle = (active: boolean): React.CSSProperties => ({
  width: "50%",
  height: "100%",
  border: "none",
  background: active ? "var(--color-surface-hi)" : "transparent",
  color: active ? "var(--color-amber)" : "var(--color-muted)",
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: "pointer",
});

export function ModeBar({ mode, onModeChange }: ModeBarProps) {
  return (
    <div
      style={{
        height: 48,
        display: "flex",
        alignItems: "stretch",
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-rule)",
        position: "relative",
        flexShrink: 0,
      }}
    >
      <button
        style={segmentStyle(mode === "crossSection")}
        onClick={() => onModeChange("crossSection")}
      >
        Cross Section
      </button>
      <button
        style={segmentStyle(mode === "rotation")}
        onClick={() => onModeChange("rotation")}
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
  );
}
