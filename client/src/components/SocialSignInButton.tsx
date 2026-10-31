import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { socialButtonStyles as styles, useSocialButtonHeight } from './socialButtonStyles';

export function SocialSignInButton({ provider, disabled, onPress }: {
  provider: 'google' | 'facebook'; disabled?: boolean; onPress: () => void;
}) {
  const height = useSocialButtonHeight();
  const label = `Continue with ${provider === 'google' ? 'Google' : 'Facebook'}`;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }} disabled={disabled}
      onPress={() => { if (!disabled) onPress(); }}
      style={[styles.button, { height }, disabled && styles.disabled]}>
      {provider === 'google' ? (
        <Image source={require('../../assets/google-signin-g.png')} style={styles.mark} resizeMode="contain" accessible={false} />
      ) : (
        <View style={[styles.mark, styles.facebookMark]} accessible={false}>
          <Text style={styles.facebookText} allowFontScaling={false}>f</Text>
        </View>
      )}
      <Text style={styles.text} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.5}>{label}</Text>
    </Pressable>
  );
}
