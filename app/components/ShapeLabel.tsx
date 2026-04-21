import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { ClassifyResult } from "~/hooks/useShapeClassifier";

interface ShapeLabelProps {
  result: ClassifyResult | null;
  connectionVisible: boolean;
  rotationLabel?: string;
}

export function ShapeLabel({ result, connectionVisible, rotationLabel }: ShapeLabelProps) {
  const labelRef = useRef<HTMLDivElement>(null);
  const connectionRef = useRef<HTMLDivElement>(null);

  const displayLabel = rotationLabel ?? result?.label ?? null;
  const animKey = rotationLabel ?? result?.key;

  useEffect(() => {
    if (!labelRef.current || !displayLabel) return;
    const tween = gsap.fromTo(
      labelRef.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
    );
    return () => { tween.kill(); };
  }, [animKey]);

  useEffect(() => {
    if (!connectionRef.current || !connectionVisible) return;
    const tween = gsap.fromTo(
      connectionRef.current,
      { opacity: 0, y: 6 },
      { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
    );
    return () => { tween.kill(); };
  }, [connectionVisible]);

  if (!result && !rotationLabel) return null;

  const sentence = connectionVisible
    ? "That cross section — it's the shape you started with."
    : null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 68,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        pointerEvents: "none",
      }}
    >
      <div
        ref={labelRef}
        style={{
          fontFamily: "'Fraunces', serif",
          fontStyle: "italic",
          fontSize: 28,
          color: "var(--color-amber)",
          letterSpacing: "0.01em",
          textTransform: "lowercase",
        }}
      >
        {displayLabel}
      </div>
      {sentence && (
        <div
          ref={connectionRef}
          style={{
            fontFamily: "'Fraunces', serif",
            fontStyle: "italic",
            fontSize: 16,
            color: "var(--color-amber)",
            letterSpacing: "0.01em",
            opacity: 0,
          }}
        >
          {sentence}
        </div>
      )}
    </div>
  );
}
