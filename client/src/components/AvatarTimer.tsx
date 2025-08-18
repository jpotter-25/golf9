// client/src/components/AvatarTimer.tsx
// Purpose: Display a player's avatar with a circular border that changes color
// based on elapsed time. Avoids `react-native-svg` by using built-in components.
// Props:
// - avatarSource: image source (URI or require(...)).
// - durationMs: total duration for the timer (e.g., 25000 for 25s).
// - elapsedMs: how much time has elapsed (0..durationMs).
// - size: optional avatar diameter in pixels (defaults to 56).

import React, { useMemo } from 'react';
import { View, Image, StyleSheet } from 'react-native';

type Props = {
  avatarSource: any;
  durationMs: number;
  elapsedMs: number;
  size?: number;
};

const AvatarTimer: React.FC<Props> = ({
  avatarSource,
  durationMs,
  elapsedMs,
  size = 56,
}) => {
  // Calculate progress (0.0 – 1.0) based on elapsed vs. duration
  const progress = Math.min(1, Math.max(0, elapsedMs / Math.max(1, durationMs)));

  // Pick a color: green for the first ~60%, yellow for ~60–85%, red afterwards
  const color = useMemo(() => {
    if (progress < 0.6) return '#52E5A7';   // green
    if (progress < 0.85) return '#F7D154';  // yellow
    return '#F36C6C';                       // red
  }, [progress]);

  // Border thickness around the avatar
  const strokeWidth = 4;
  const outerSize = size + strokeWidth * 2;

  return (
    <View
      style={{
        width: outerSize,
        height: outerSize,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Colored border circle */}
      <View
        style={[
          styles.borderCircle,
          {
            width: outerSize,
            height: outerSize,
            borderRadius: outerSize / 2,
            borderColor: color,
            borderWidth: strokeWidth,
          },
        ]}
      />
      {/* Player avatar */}
      <Image
        source={avatarSource}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          position: 'absolute',
        }}
      />
    </View>
  );
};

export default AvatarTimer;

const styles = StyleSheet.create({
  borderCircle: {
    position: 'absolute',
  },
});
