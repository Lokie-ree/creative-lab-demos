import type { Config } from "@react-router/dev/config";

export default {
  // SPA mode — no SSR Lambda. Required because three/r3f/csg are browser-only
  // (WebGL, HTMLCanvasElement) and crash Node.js if imported server-side.
  ssr: false,
} satisfies Config;
