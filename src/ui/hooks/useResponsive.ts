import { useWindowDimensions } from 'react-native';
import { useMemo } from 'react';
import { breakpoints, deviceCategory } from '@core/theme';

export function useResponsive() {
  const { width, height, fontScale } = useWindowDimensions();

  const category = useMemo(() => {
    if (width <= deviceCategory.smallPhone.max) return 'smallPhone' as const;
    if (width <= deviceCategory.mediumPhone.max) return 'mediumPhone' as const;
    if (width <= deviceCategory.largePhone.max) return 'largePhone' as const;
    if (width <= deviceCategory.smallTablet.max) return 'smallTablet' as const;
    return 'largeTablet' as const;
  }, [width]);

  const isTablet = width >= breakpoints.smallTablet;
  const isSmallDevice = width < breakpoints.mediumPhone;

  const scale = useMemo(() => {
    return Math.min(width / 375, 1.4);
  }, [width]);

  const scaleFont = useMemo(() => {
    return (size: number) => Math.round(size * Math.min(scale, 1.2) * fontScale);
  }, [scale, fontScale]);

  const scaleSize = useMemo(() => {
    return (size: number) => Math.round(size * scale);
  }, [scale]);

  const numColumns = isTablet ? 2 : 1;

  return {
    width,
    height,
    fontScale,
    category,
    isTablet,
    isSmallDevice,
    scale,
    scaleFont,
    scaleSize,
    numColumns,
    isLandscape: width > height,
  };
}
