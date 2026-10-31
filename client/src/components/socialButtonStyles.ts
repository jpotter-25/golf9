import { StyleSheet, useWindowDimensions } from 'react-native';

// Apple retains its native control on iOS. The other providers share its
// neutral light treatment, dimensions and spacing rather than competing colors.
export const SOCIAL_BUTTON_RADIUS = 10;
export function useSocialButtonHeight() {
  const { fontScale } = useWindowDimensions();
  return Math.ceil(52 * Math.max(1, Math.min(fontScale, 1.5)));
}
export const socialButtonStyles = StyleSheet.create({
  group: { gap: 12, alignSelf: 'stretch' },
  button: {
    width: '100%', minWidth: 0, alignSelf: 'stretch', borderRadius: SOCIAL_BUTTON_RADIUS,
    backgroundColor: '#FFFFFF', borderColor: '#747775', borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    paddingHorizontal: 16,
  },
  text: { color: '#1F1F1F', fontSize: 16, fontWeight: '500', flexShrink: 1, textAlign: 'center' },
  mark: { width: 22, height: 22, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  facebookMark: { backgroundColor: '#1877F2', borderRadius: 11 },
  facebookText: { color: '#FFFFFF', fontSize: 21, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
