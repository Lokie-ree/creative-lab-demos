import type { SolidId } from "~/types";

const SOLIDS: { id: SolidId; label: string }[] = [
  { id: "cone", label: "Cone" },
  { id: "cylinder", label: "Cylinder" },
  { id: "cube", label: "Cube" },
  { id: "sphere", label: "Sphere" },
];

interface SolidSelectorProps {
  solidId: SolidId;
  onSolidChange: (id: SolidId) => void;
}

export function SolidSelector({ solidId, onSolidChange }: SolidSelectorProps) {
  return (
    <div
      className="solid-selector"
      style={{
        height: 52,
        display: "flex",
        background: "var(--color-surface)",
        borderTop: "1px solid var(--color-rule)",
        flexShrink: 0,
      }}
    >
      {SOLIDS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onSolidChange(id)}
          style={{
            flex: 1,
            height: "100%",
            background: "transparent",
            border: "none",
            borderLeft:
              solidId === id
                ? "3px solid var(--color-amber)"
                : "3px solid transparent",
            color: solidId === id ? "var(--color-ink)" : "var(--color-muted)",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
