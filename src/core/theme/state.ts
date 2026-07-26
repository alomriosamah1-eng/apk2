/** ARGB colour strings for each interactive state. */
export interface StateLayer {
  /** Colour for hover state. */
  hover: string;
  /** Colour for pressed state. */
  pressed: string;
  /** Colour for focused state. */
  focus: string;
  /** Colour for drag state. */
  drag: string;
}

interface ColorPalette {
  primary: string;
  onSurface: string;
  onSurfaceVariant: string;
  error: string;
  background: string;
}

/** Computes state-layer colours (hover, pressed, focus, drag) for a given theme palette. */
export function getStateLayers(colors: ColorPalette, isDark: boolean): {
  primary: StateLayer;
  surface: StateLayer;
  surfaceVariant: StateLayer;
  error: StateLayer;
} {
  const opacity = isDark ? 0.12 : 0.08;

  return {
    primary: {
      hover: `${colors.primary}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
      pressed: `${colors.primary}${Math.round((opacity * 2) * 255).toString(16).padStart(2, '0')}`,
      focus: `${colors.primary}${Math.round((opacity * 1.5) * 255).toString(16).padStart(2, '0')}`,
      drag: `${colors.primary}${Math.round((opacity * 2.5) * 255).toString(16).padStart(2, '0')}`,
    },
    surface: {
      hover: `${colors.onSurface}14`,
      pressed: `${colors.onSurface}1F`,
      focus: `${colors.onSurface}1A`,
      drag: `${colors.onSurface}29`,
    },
    surfaceVariant: {
      hover: `${colors.onSurfaceVariant}14`,
      pressed: `${colors.onSurfaceVariant}1F`,
      focus: `${colors.onSurfaceVariant}1A`,
      drag: `${colors.onSurfaceVariant}29`,
    },
    error: {
      hover: `${colors.error}14`,
      pressed: `${colors.error}1F`,
      focus: `${colors.error}1A`,
      drag: `${colors.error}29`,
    },
  };
}
