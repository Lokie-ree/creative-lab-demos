import { describe, test, expect } from "vitest";
import { demoReducer, initialState } from "./useDemoReducer";
import type { DemoState } from "./useDemoReducer";

describe("SET_SOLID", () => {
  test("resets mode-A fields and rotation fields, preserves mode and completedModes", () => {
    const withData: DemoState = {
      ...initialState,
      solidId: "cone",
      mode: "rotation",
      planeInteracted: true,
      distinctShapes: new Set(["cone-circle"]),
      shapeLabel: "circle",
      labelVisible: true,
      rotationAngle: 180,
      rotationComplete: true,
      connectionVisible: true,
      connectionDismissed: true,
      completedModes: new Set(["cone-crossSection"]),
    };
    const next = demoReducer(withData, { type: "SET_SOLID", payload: "cylinder" });
    expect(next.solidId).toBe("cylinder");
    expect(next.mode).toBe("rotation");
    expect(next.planeInteracted).toBe(false);
    expect(next.distinctShapes.size).toBe(0);
    expect(next.shapeLabel).toBeNull();
    expect(next.labelVisible).toBe(false);
    expect(next.rotationAngle).toBe(0);
    expect(next.rotationComplete).toBe(false);
    expect(next.connectionVisible).toBe(false);
    expect(next.connectionDismissed).toBe(false);
    // completedModes is preserved across solid changes
    expect(next.completedModes.has("cone-crossSection")).toBe(true);
  });
});

describe("SET_MODE", () => {
  test("resets connectionVisible only, preserves rotation state", () => {
    const state: DemoState = {
      ...initialState,
      rotationAngle: 180,
      rotationComplete: true,
      connectionVisible: true,
    };
    const next = demoReducer(state, { type: "SET_MODE", payload: "crossSection" });
    expect(next.mode).toBe("crossSection");
    expect(next.connectionVisible).toBe(false);
    expect(next.rotationAngle).toBe(180);
    expect(next.rotationComplete).toBe(true);
  });

  test("sets connectionDismissed when switching while connection is visible", () => {
    const state: DemoState = { ...initialState, connectionVisible: true, connectionDismissed: false };
    const next = demoReducer(state, { type: "SET_MODE", payload: "crossSection" });
    expect(next.connectionDismissed).toBe(true);
  });

  test("preserves connectionDismissed when connection is not visible", () => {
    const state: DemoState = { ...initialState, connectionVisible: false, connectionDismissed: false };
    const next = demoReducer(state, { type: "SET_MODE", payload: "rotation" });
    expect(next.connectionDismissed).toBe(false);
  });
});

describe("REVEAL_LABEL", () => {
  test("first key — adds to distinctShapes, no completion yet", () => {
    const next = demoReducer(initialState, {
      type: "REVEAL_LABEL",
      payload: { label: "circle", key: "cone-circle" },
    });
    expect(next.shapeLabel).toBe("circle");
    expect(next.labelVisible).toBe(true);
    expect(next.distinctShapes.has("cone-circle")).toBe(true);
    expect(next.connectionVisible).toBe(false);
    expect(next.completedModes.has("cone-crossSection")).toBe(false);
  });

  test("second distinct key — marks crossSection complete", () => {
    const withOne: DemoState = {
      ...initialState,
      solidId: "cone",
      distinctShapes: new Set(["cone-circle"]),
    };
    const next = demoReducer(withOne, {
      type: "REVEAL_LABEL",
      payload: { label: "ellipse", key: "cone-ellipse" },
    });
    expect(next.completedModes.has("cone-crossSection")).toBe(true);
    expect(next.connectionVisible).toBe(false); // rotation not done yet
  });

  test("second key with rotation already done — shows connection for non-cube", () => {
    const withOne: DemoState = {
      ...initialState,
      solidId: "cone",
      distinctShapes: new Set(["cone-circle"]),
      completedModes: new Set(["cone-rotation"]),
      connectionDismissed: false,
    };
    const next = demoReducer(withOne, {
      type: "REVEAL_LABEL",
      payload: { label: "ellipse", key: "cone-ellipse" },
    });
    expect(next.connectionVisible).toBe(true);
  });

  test("connection never fires for cube", () => {
    const withOne: DemoState = {
      ...initialState,
      solidId: "cube",
      distinctShapes: new Set(["cube-square"]),
      completedModes: new Set(["cube-rotation"]),
    };
    const next = demoReducer(withOne, {
      type: "REVEAL_LABEL",
      payload: { label: "rectangle", key: "cube-rectangle" },
    });
    expect(next.connectionVisible).toBe(false);
  });

  test("connection suppressed if already dismissed", () => {
    const withOne: DemoState = {
      ...initialState,
      solidId: "cone",
      distinctShapes: new Set(["cone-circle"]),
      completedModes: new Set(["cone-rotation"]),
      connectionDismissed: true,
    };
    const next = demoReducer(withOne, {
      type: "REVEAL_LABEL",
      payload: { label: "ellipse", key: "cone-ellipse" },
    });
    expect(next.connectionVisible).toBe(false);
  });
});

describe("COMPLETE_ROTATION", () => {
  test("marks rotation complete and adds to completedModes", () => {
    const next = demoReducer({ ...initialState, solidId: "cylinder" }, { type: "COMPLETE_ROTATION" });
    expect(next.rotationComplete).toBe(true);
    expect(next.completedModes.has("cylinder-rotation")).toBe(true);
    expect(next.connectionVisible).toBe(false); // crossSection not done yet
  });

  test("fires connection when crossSection already done", () => {
    const state: DemoState = {
      ...initialState,
      solidId: "sphere",
      completedModes: new Set(["sphere-crossSection"]),
    };
    const next = demoReducer(state, { type: "COMPLETE_ROTATION" });
    expect(next.connectionVisible).toBe(true);
  });

  test("never fires connection for cube", () => {
    const state: DemoState = {
      ...initialState,
      solidId: "cube",
      completedModes: new Set(["cube-crossSection"]),
    };
    const next = demoReducer(state, { type: "COMPLETE_ROTATION" });
    expect(next.connectionVisible).toBe(false);
  });
});

describe("HIDE_CONNECTION", () => {
  test("clears connectionVisible and sets connectionDismissed", () => {
    const state: DemoState = { ...initialState, connectionVisible: true };
    const next = demoReducer(state, { type: "HIDE_CONNECTION" });
    expect(next.connectionVisible).toBe(false);
    expect(next.connectionDismissed).toBe(true);
  });
});
