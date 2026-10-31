import React from 'react';
import { Pressable, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { socialButtonStyles as styles, useSocialButtonHeight } from './socialButtonStyles';

export type AppleSignInButtonProps = { disabled?: boolean; onPress: () => void };

// Apple brand glyph: Font Awesome Free 6.7.2, Copyright 2024 Fonticons, Inc.
// CC BY 4.0: https://fontawesome.com/license/free — unmodified glyph.
export function AppleSignInButton({ disabled, onPress }: AppleSignInButtonProps) {
  const height = useSocialButtonHeight();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Continue with Apple"
      accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={() => { if (!disabled) onPress(); }}
      style={[styles.button, { height, backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' }, disabled && styles.disabled]}>
      <Svg width={20} height={24} viewBox="0 0 384 512" accessible={false}>
        <Path fill="#000" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
      </Svg>
      <Text style={[styles.text, { color: '#000' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.5}>Continue with Apple</Text>
    </Pressable>
  );
}
