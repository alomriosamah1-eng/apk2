/** Motion design tokens including duration presets and easing curves. */
export const motion = {
  duration: {
    instant: 50,
    fast: 100,
    short: 150,
    medium: 200,
    long: 300,
    slow: 400,
    verySlow: 600,
  },
  easing: {
    standard: [0.2, 0, 0, 1] as const,
    decelerate: [0, 0, 0.2, 1] as const,
    accelerate: [0.4, 0, 1, 1] as const,
    emphasis: [0.2, 0, 0, 1] as const,
    spring: {
      damping: 15,
      mass: 1,
      stiffness: 150,
    },
  },
} as const;

/** Valid keys for motion tokens. */
export type MotionKey = keyof typeof motion;
