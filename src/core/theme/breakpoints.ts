/** Minimum width breakpoints for responsive layout decisions. */
export const breakpoints = {
  smallPhone: 360,
  mediumPhone: 400,
  largePhone: 480,
  smallTablet: 600,
  largeTablet: 840,
} as const;

/** Valid keys for breakpoints. */
export type BreakpointKey = keyof typeof breakpoints;

/** Device category ranges defined by min/max width in pixels. */
export const deviceCategory = {
  smallPhone: { min: 0, max: 359 },
  mediumPhone: { min: 360, max: 399 },
  largePhone: { min: 400, max: 599 },
  smallTablet: { min: 600, max: 839 },
  largeTablet: { min: 840, max: Infinity },
} as const;
