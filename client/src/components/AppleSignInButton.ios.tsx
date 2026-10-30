import React from 'react';
import { View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

export function AppleSignInButton({ disabled, onPress }: { disabled?: boolean; onPress: () => void }) {
  // Parents render only after isAvailableAsync succeeds.
  return (
    <View pointerEvents={disabled ? 'none' : 'auto'} accessibilityState={{ disabled: !!disabled }} style={{ opacity: disabled ? 0.5 : 1 }}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={8} style={{ height: 48, minWidth: 200, alignSelf: 'stretch' }}
        onPress={() => { if (!disabled) onPress(); }}
      />
    </View>
  );
}
