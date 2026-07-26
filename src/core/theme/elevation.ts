import { ViewStyle } from 'react-native';

/** Elevation tokens combining shadow properties and surface tint. */
export interface ElevationToken {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
  surfaceTint: string;
}

/** Elevation levels from 0 (none) to 5 (highest). */
export const elevations: Record<number, ElevationToken> = {
  0: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    surfaceTint: 'rgba(0, 0, 0, 0)',
  },
  1: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    surfaceTint: 'rgba(108, 99, 255, 0.05)',
  },
  2: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    surfaceTint: 'rgba(108, 99, 255, 0.08)',
  },
  3: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    surfaceTint: 'rgba(108, 99, 255, 0.11)',
  },
  4: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    surfaceTint: 'rgba(108, 99, 255, 0.14)',
  },
  5: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 5,
    surfaceTint: 'rgba(108, 99, 255, 0.18)',
  },
};

/** Returns ViewStyle properties for the given elevation level. */
export function getElevation(level: number): ViewStyle {
  const token = elevations[level] ?? (elevations[0] as ElevationToken);
  return {
    shadowColor: token.shadowColor,
    shadowOffset: token.shadowOffset,
    shadowOpacity: token.shadowOpacity,
    shadowRadius: token.shadowRadius,
    elevation: token.elevation,
  };
}

/** Returns the surface tint colour for the given elevation level. */
export const surfaceTint = (level: number): string => {
  return elevations[level]?.surfaceTint ?? 'transparent';
};
