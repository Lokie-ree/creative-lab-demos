import { type ThreeElement } from "@react-three/fiber";
import type { Line } from "three";
declare module "@react-three/fiber" {
  interface ThreeElements {
    line_: ThreeElement<typeof Line>;
  }
}
