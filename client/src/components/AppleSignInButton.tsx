import React from 'react';
import { Pressable, Text } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { socialButtonStyles as styles, useSocialButtonHeight } from './socialButtonStyles';

export type AppleSignInButtonProps = { disabled?: boolean; onPress: () => void };

// Shared presentation gives iOS the same text metrics as Google. Authentication
// still uses expo-apple-authentication's native signInAsync on iOS.
// Artwork: Apple's "Logo - SIWA - Left-aligned - Black - Medium.svg" from
// https://developer.apple.com/design/resources/ (Logo-Sign-in-with-Apple.dmg).
// Preserve the path, full 31x44 viewBox, white background and built-in padding.
export function AppleSignInButton({ disabled, onPress }: AppleSignInButtonProps) {
  const height = useSocialButtonHeight();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Continue with Apple"
      accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={() => { if (!disabled) onPress(); }}
      style={[styles.button, { height, gap: 0, backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' }, disabled && styles.disabled]}>
      <Svg width={height * 31 / 44} height={height} viewBox="0 0 31 44" accessible={false} style={{ flexShrink: 0 }}>
        <Rect fill="#FFFFFF" x="0" y="0" width="31" height="44" />
        <Path fill="#000000" fillRule="nonzero" d="M15.7099491,14.8846154 C16.5675461,14.8846154 17.642562,14.3048315 18.28274,13.5317864 C18.8625238,12.8312142 19.2852829,11.852829 19.2852829,10.8744437 C19.2852829,10.7415766 19.2732041,10.6087095 19.2490464,10.5 C18.2948188,10.5362365 17.1473299,11.140178 16.4588366,11.9494596 C15.9152893,12.56548 15.4200572,13.5317864 15.4200572,14.5222505 C15.4200572,14.6671964 15.4442149,14.8121424 15.4562937,14.8604577 C15.5166879,14.8725366 15.6133185,14.8846154 15.7099491,14.8846154 Z M12.6902416,29.5 C13.8618881,29.5 14.3812778,28.714876 15.8428163,28.714876 C17.3285124,28.714876 17.6546408,29.4758423 18.9591545,29.4758423 C20.2395105,29.4758423 21.0971074,28.292117 21.9063891,27.1325493 C22.8123013,25.8038779 23.1867451,24.4993643 23.2109027,24.4389701 C23.1263509,24.4148125 20.6743484,23.4122695 20.6743484,20.5979021 C20.6743484,18.1579784 22.6069612,17.0588048 22.7156707,16.974253 C21.4353147,15.1382708 19.490623,15.0899555 18.9591545,15.0899555 C17.5217737,15.0899555 16.3501271,15.9596313 15.6133185,15.9596313 C14.8161157,15.9596313 13.7652575,15.1382708 12.521138,15.1382708 C10.1536872,15.1382708 7.75,17.0950413 7.75,20.7911634 C7.75,23.0861411 8.64383344,25.513986 9.74300699,27.0842339 C10.6851558,28.4129053 11.5065162,29.5 12.6902416,29.5 Z" />
      </Svg>
      <Text style={[styles.text, { color: '#000' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.5}>Continue with Apple</Text>
    </Pressable>
  );
}
