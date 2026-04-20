// app/components/ShapeLabel.tsx
import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { ClassifyResult } from "~/hooks/useShapeClassifier";

interface ShapeLabelProps {
  result: ClassifyResult | null;
  connectionVisible: boolean;
}

const CONNECTION_SENTENCES: Record<string, string> = {
  "cone-circle": "A horizontal cut through a cone is always a circle.",
  "cone-ellipse": "Tilt the cut and the circle stretches into an ellipse.",
  "cone-triangle": "Cut through the apex and you get a triangle.",
  "cone-parabola": "A cut parallel to the slant gives a parabola.",
  "cone-point": "The apex itself is just a point.",
  "cylinder-circle": "A flat cut through a cylinder is a circle.",
  "cylinder-ellipse": "Tilt it and the circle becomes an ellipse.",
  "cylinder-rectangle": "A side cut through a cylinder gives a rectangle.",
  "cube-square": "A horizontal cut through a cube is a square.",
  "cube-rectangle": "Cut off-axis and the square becomes a rectangle.",
  "cube-hexagon": "Tilt at 45° and a cube reveals a hexagon.",
  "cube-triangle": "A corner cut gives a triangle.",
  "sphere-circle": "Every cross-section of a sphere is a circle.",
};

export function ShapeLabel({ result, connectionVisible }: ShapeLabelProps) {
  const labelRef = useRef<HTMLDivElement>(null);
  const connectionRef = useRef<HTMLDivElement>(null);

  // Animate label in when shape changes
  useEffect(() => {
    if (!labelRef.current) return;
    const tween = gsap.fromTo(
      labelRef.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
    );
    return () => { tween.kill(); };
  }, [result?.key]);

  // Animate connection sentence on visibility toggle
  useEffect(() => {
    if (!connectionRef.current) return;
    let tween: gsap.core.Tween;
    if (connectionVisible) {
      tween = gsap.fromTo(
        connectionRef.current,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
      );
    } else {
      tween = gsap.to(connectionRef.current, { opacity: 0, duration: 0.3 });
    }
    return () => { tween.kill(); };
  }, [connectionVisible]);

  if (!result) return null;

  const sentence = CONNECTION_SENTENCES[result.key] ?? null;

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
        {result.label}
      </div>
      {/* opacity 0 is load-bearing — GSAP controls visibility from here */}
      {sentence && (
        <div
          ref={connectionRef}
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            color: "var(--color-muted)",
            letterSpacing: "0.03em",
            opacity: 0,
          }}
        >
          {sentence}
        </div>
      )}
    </div>
  );
}
