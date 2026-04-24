import type * as THREE from "three";
import type { SolidId, ModeId } from "~/types";

export interface DemoState {
  mode: ModeId;
  solidId: SolidId;
  // Mode A
  csgGeometry: THREE.BufferGeometry | null;
  planeInteracted: boolean;
  distinctShapes: Set<string>;
  shapeLabel: string | null;
  labelVisible: boolean;
  // Mode B
  rotationAngle: number;
  rotationComplete: boolean;
  // Connection moment
  completedModes: Set<`${SolidId}-${ModeId}`>;
  connectionVisible: boolean;
  connectionDismissed: boolean;
  // Physics mode
  physicsMode: boolean;
}

export const initialState: DemoState = {
  mode: "crossSection",
  solidId: "cone",
  csgGeometry: null,
  planeInteracted: false,
  distinctShapes: new Set(),
  shapeLabel: null,
  labelVisible: false,
  rotationAngle: 0,
  rotationComplete: false,
  completedModes: new Set(),
  connectionVisible: false,
  connectionDismissed: false,
  physicsMode: false,
};

export type DemoAction =
  | { type: "SET_MODE"; payload: ModeId }
  | { type: "SET_SOLID"; payload: SolidId }
  | { type: "SET_CSG_GEOMETRY"; payload: THREE.BufferGeometry }
  | { type: "PLANE_INTERACTED" }
  | { type: "REVEAL_LABEL"; payload: { label: string; key: string } }
  | { type: "HIDE_LABEL" }
  | { type: "SET_ROTATION_ANGLE"; payload: number }
  | { type: "COMPLETE_ROTATION" }
  | { type: "RESET_ROTATION" }
  | { type: "HIDE_CONNECTION" }
  | { type: "TOGGLE_PHYSICS" };

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "SET_MODE":
      return {
        ...state,
        mode: action.payload,
        physicsMode: false,
        connectionVisible: false,
        connectionDismissed: state.connectionVisible ? true : state.connectionDismissed,
      };

    case "SET_SOLID":
      return {
        ...state,
        solidId: action.payload,
        csgGeometry: null,
        planeInteracted: false,
        distinctShapes: new Set(),
        shapeLabel: null,
        labelVisible: false,
        rotationAngle: 0,
        rotationComplete: false,
        physicsMode: false,
        connectionVisible: false,
        connectionDismissed: false,
      };

    case "SET_CSG_GEOMETRY":
      return { ...state, csgGeometry: action.payload };

    case "PLANE_INTERACTED":
      return { ...state, planeInteracted: true };

    case "REVEAL_LABEL": {
      const nextShapes = new Set(state.distinctShapes).add(action.payload.key);
      let nextCompleted = state.completedModes;
      let nextConnection = state.connectionVisible;
      if (nextShapes.size >= 2) {
        nextCompleted = new Set(state.completedModes).add(`${state.solidId}-crossSection`);
        const bothDone = nextCompleted.has(`${state.solidId}-rotation`);
        nextConnection = bothDone && state.solidId !== "cube" && !state.connectionDismissed;
      }
      return {
        ...state,
        shapeLabel: action.payload.label,
        labelVisible: true,
        distinctShapes: nextShapes,
        completedModes: nextCompleted,
        connectionVisible: nextConnection,
      };
    }

    case "HIDE_LABEL":
      return { ...state, labelVisible: false };

    case "SET_ROTATION_ANGLE":
      return { ...state, rotationAngle: action.payload };

    case "COMPLETE_ROTATION": {
      const nextCompleted = new Set(state.completedModes).add(`${state.solidId}-rotation`);
      const bothDone = nextCompleted.has(`${state.solidId}-crossSection`);
      const showConnection = bothDone && state.solidId !== "cube" && !state.connectionDismissed;
      return {
        ...state,
        rotationComplete: true,
        completedModes: nextCompleted,
        connectionVisible: showConnection,
      };
    }

    case "RESET_ROTATION":
      return { ...state, rotationAngle: 0, rotationComplete: false };

    case "HIDE_CONNECTION":
      return { ...state, connectionVisible: false, connectionDismissed: true };

    case "TOGGLE_PHYSICS":
      return { ...state, physicsMode: !state.physicsMode };

    default:
      return state;
  }
}
