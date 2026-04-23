const isTouchDevice =
  typeof window !== 'undefined' &&
  window.matchMedia('(pointer: coarse)').matches

export const SEGMENTS = {
  cone:     isTouchDevice ? 32 : 64,
  cylinder: isTouchDevice ? 32 : 64,
  sphere:   isTouchDevice
    ? ([32, 16] as [number, number])
    : ([64, 32] as [number, number]),
} as const
