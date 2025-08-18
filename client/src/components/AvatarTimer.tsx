// client/src/components/AvatarTimer.tsx
// Purpose: Circular progress ring around a player's avatar. Color shifts
// green -> yellow -> red as time elapses. Only render this in Online mode.
// Requires 'react-native-svg' (bundled with Expo).

import React, { useMemo } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

type Props = {
  /** avatar image uri or require() */
  avatarSource: any;
  /** total duration in ms */
  durationMs: number;
  /** elapsed in ms (0..durationMs) */
  elapsedMs: number;
  /** size of the avatar circle in px */
  size?: number;
};

const AvatarTimer: React.FC<Props> = ({ avatarSource, durationMs, elapsedMs, size = 56 }) => {
  const stroke = 6;
  const radius = (size + stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = Math.min(1, Math.max(0, elapsedMs / Math.max(1, durationMs)));
  const dashoffset = circumference * (1 - progress);

  // color ramp: 0..0.6 green -> 0.85 yellow -> 1 red
  const color = useMemo(() => {
    if (progress < 0.6) return '#52E5A7';   // green
    if (progress < 0.85) return '#F7D154';  // yellow
    return '#F36C6C';                       // red
  }, [progress]);

  return (
    <View style={{ width: size + stroke * 2, height: size + stroke * 2 }}>
      <Svg width={size + stroke * 2} height={size + stroke * 2}>
        <Circle
          cx={radius + stroke}
          cy={radius + stroke}
          r={radius}
          stroke="#2A2F57"
          strokeWidth={stroke}
          fill="transparent"
        />
        <Circle
          cx={radius + stroke}
          cy={radius + stroke}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="transparent"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
          rotation="-90"
          originX={radius + stroke}
          originY={radius + stroke}
        />
      </Svg>
      <Image source={avatarSource} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]} />
    </View>
  );
};

export default AvatarTimer;

const styles = StyleSheet.create({
  avatar: {
    position: 'absolute',
    top: 6,
    left: 6,
    resizeMode: 'cover',
  },
});
