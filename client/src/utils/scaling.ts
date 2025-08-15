// src/utils/scaling.ts
// Purpose: Hook to calculate sizes based on screen dimensions and safe areas for consistent scaling.

import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useScale() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // usable height excluding safe areas
  const usableH = height - insets.top - insets.bottom;
  const usableW = width - 16; // small padding

  // base card size derived from smallest dimension for consistency
  const base = Math.min(usableW, usableH) / 6.2; // tuned to fit 3x3 + piles

  const cardW = base * 0.95;
  const cardH = base * 1.35;
  const gap = Math.max(8, base * 0.12);

  return { cardW, cardH, gap, usableW, usableH };
}
