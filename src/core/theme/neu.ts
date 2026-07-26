import { ViewStyle, Platform } from 'react-native';

/** Neumorphic shadow presets for raised and pressed states. */
export interface NeuShadow {
  /** Default raised state. */
  raised: ViewStyle;
  /** Small raised state. */
  raisedSm: ViewStyle;
  /** Large raised state. */
  raisedLg: ViewStyle;
  /** Default pressed state. */
  pressed: ViewStyle;
  /** Small pressed state. */
  pressedSm: ViewStyle;
}

/** Creates neumorphic shadow styles based on the provided surface colours and platform. */
export function createNeuShadow(colors: {
  surface: string;
  shadow: string;
  shadowLight: string;
}): NeuShadow {
  const isIOS = Platform.OS === 'ios';
  const baseElevation = Platform.select({ android: 4, default: 2 });

  if (isIOS) {
    return {
      raised: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      raisedSm: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      raisedLg: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 8, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      pressed: {
        shadowColor: colors.shadow,
        shadowOffset: { width: -2, height: -2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      pressedSm: {
        shadowColor: colors.shadow,
        shadowOffset: { width: -1, height: -1 },
        shadowOpacity: 0.15,
        shadowRadius: 2,
      },
    };
  }

  return {
    raised: { elevation: baseElevation + 2 },
    raisedSm: { elevation: baseElevation },
    raisedLg: { elevation: baseElevation + 6 },
    pressed: { elevation: 1 },
    pressedSm: { elevation: 0 },
  };
}
