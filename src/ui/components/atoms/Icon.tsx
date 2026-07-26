import { memo } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@ui/providers/ThemeProvider';

/** Props for the {@link Icon} component. */
interface IconProps {
  name: keyof typeof MaterialCommunityIcons.glyphMap;
  size?: number;
  color?: string;
  accessibilityLabel?: string;
}

function IconComponent({ name, size = 24, color, accessibilityLabel }: IconProps) {
  const { colors } = useTheme();

  return (
    <MaterialCommunityIcons
      name={name}
      size={size}
      color={color ?? colors.onSurface}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
    />
  );
}

/** A themed MaterialCommunityIcons wrapper with accessible defaults. */
export const Icon = memo(IconComponent);
