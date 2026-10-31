import React from 'react';
import { View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { SOCIAL_BUTTON_RADIUS, useSocialButtonHeight } from './socialButtonStyles';

export function AppleSignInButton({ disabled, onPress }: { disabled?: boolean; onPress: () => void }) {
  const height = useSocialButtonHeight();
  // Parents render only after isAvailableAsync succeeds.
  return (
    <View pointerEvents={disabled ? 'none' : 'auto'} accessibilityState={{ disabled: !!disabled }} style={{ opacity: disabled ? 0.5 : 1 }}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
        cornerRadius={SOCIAL_BUTTON_RADIUS} style={{ height, minWidth: 0, alignSelf: 'stretch' }}
        onPress={() => { if (!disabled) onPress(); }}
      />
    </View>
  );
}
