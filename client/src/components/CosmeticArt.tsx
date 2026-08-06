import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Polygon,
  Rect,
  Stop,
} from 'react-native-svg';
import {
  getAvatarAccessoryVisual,
  getAvatarFrameVisual,
  getAvatarIconVisual,
  getCardBackVisual,
  getTableThemeVisual,
  type AvatarAccessoryVisual,
  type AvatarFrameVisual,
  type AvatarIconVisual,
  type CardBackVisual,
  type TableThemeVisual,
} from '../theme/cosmetics';

export function CardBackArtwork({
  cardBackId,
  style,
}: {
  cardBackId?: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const visual = getCardBackVisual(cardBackId);
  const gradientId = `card-back-${visual.pattern}`;
  return (
    <View pointerEvents="none" style={[styles.fill, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 150" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={gradientId} x1="12" y1="8" x2="88" y2="142" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={visual.secondaryColor} />
            <Stop offset="0.52" stopColor={visual.backgroundColor} />
            <Stop offset="1" stopColor={visual.secondaryColor} />
          </LinearGradient>
        </Defs>
        <Rect x="1.5" y="1.5" width="97" height="147" rx="9" fill={`url(#${gradientId})`} stroke={visual.borderColor} strokeWidth="3" />
        <Rect x="7" y="7" width="86" height="136" rx="6" fill="none" stroke={visual.accentColor} strokeWidth="1.2" opacity={0.86} />
        <Rect x="10" y="10" width="80" height="130" rx="4" fill="none" stroke={visual.borderColor} strokeWidth="0.55" opacity={0.56} />
        <CardBackPattern visual={visual} />
      </Svg>
    </View>
  );
}

function CardBackPattern({ visual }: { visual: CardBackVisual }) {
  const sharedCorners = (
    <G fill="none" stroke={visual.accentColor} strokeWidth="1.1" opacity={0.76}>
      <Path d="M12 27 Q22 24 25 13 M12 34 Q29 29 31 12" />
      <Path d="M88 27 Q78 24 75 13 M88 34 Q71 29 69 12" />
      <Path d="M12 123 Q22 126 25 137 M12 116 Q29 121 31 138" />
      <Path d="M88 123 Q78 126 75 137 M88 116 Q71 121 69 138" />
    </G>
  );

  if (visual.pattern === 'heritage') {
    return (
      <>
        {sharedCorners}
        <G fill="none" stroke={visual.accentColor} opacity={0.62}>
          <Polygon points="50,28 74,50 50,72 26,50" strokeWidth="1.2" />
          <Polygon points="50,78 70,96 50,122 30,96" strokeWidth="1.2" />
          <Path d="M22 75 H78 M50 18 V132" strokeWidth="0.7" />
        </G>
        <Circle cx="50" cy="75" r="17" fill={visual.secondaryColor} stroke={visual.borderColor} strokeWidth="2" />
        <Path d="M50 52 C39 64 35 70 35 80 C35 91 43 98 50 91 C57 98 65 91 65 80 C65 70 61 64 50 52 Z" fill={visual.accentColor} opacity={0.9} />
        <Path d="M50 88 L42 104 H58 Z" fill={visual.accentColor} opacity={0.9} />
      </>
    );
  }

  if (visual.pattern === 'filigree') {
    return (
      <>
        {sharedCorners}
        <G fill="none" stroke={visual.accentColor} strokeWidth="1.25" opacity={0.86}>
          <Path d="M17 75 C17 44 37 42 50 55 C63 42 83 44 83 75 C83 106 63 108 50 95 C37 108 17 106 17 75 Z" />
          <Path d="M24 75 C34 58 42 58 50 68 C58 58 66 58 76 75 C66 92 58 92 50 82 C42 92 34 92 24 75 Z" />
          <Path d="M50 18 C44 29 36 32 28 35 M50 18 C56 29 64 32 72 35 M50 132 C44 121 36 118 28 115 M50 132 C56 121 64 118 72 115" />
        </G>
        <Circle cx="50" cy="75" r="9" fill={visual.borderColor} opacity={0.22} />
        <Polygon points="50,61 61,75 50,89 39,75" fill={visual.accentColor} stroke={visual.borderColor} strokeWidth="1.5" />
      </>
    );
  }

  if (visual.pattern === 'vine') {
    return (
      <>
        {sharedCorners}
        <G fill="none" stroke={visual.accentColor} strokeWidth="1.15" opacity={0.8}>
          <Path d="M22 130 C76 110 24 91 71 72 C22 54 75 38 44 19" />
          <Path d="M78 20 C31 38 79 59 31 77 C78 96 27 112 58 132" opacity={0.5} />
        </G>
        <G fill={visual.borderColor} opacity={0.72}>
          <Polygon points="31,112 22,105 35,103" />
          <Polygon points="60,95 70,88 57,86" />
          <Polygon points="39,57 29,50 42,48" />
          <Polygon points="67,39 76,32 63,31" />
        </G>
        <Circle cx="50" cy="75" r="18" fill={visual.secondaryColor} stroke={visual.borderColor} strokeWidth="2" />
        <Polygon points="50,55 65,68 60,88 40,88 35,68" fill={visual.backgroundColor} stroke={visual.accentColor} strokeWidth="1.5" />
        <Path d="M50 59 L56 73 L50 87 L44 73 Z" fill={visual.accentColor} />
      </>
    );
  }

  if (visual.pattern === 'circuit') {
    return (
      <>
        <G fill="none" stroke={visual.accentColor} strokeWidth="1" opacity={0.7}>
          <Path d="M14 32 H35 V52 H45 M86 32 H65 V52 H55 M14 118 H35 V98 H45 M86 118 H65 V98 H55" />
          <Path d="M14 55 H26 V75 H37 M86 55 H74 V75 H63 M14 95 H26 V75 M86 95 H74 V75" opacity={0.54} />
        </G>
        <G fill={visual.borderColor}>
          {[['14', '32'], ['86', '32'], ['14', '118'], ['86', '118'], ['14', '55'], ['86', '55'], ['14', '95'], ['86', '95']].map(([cx, cy]) => (
            <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.2" />
          ))}
        </G>
        <Polygon points="50,49 71,61 71,89 50,101 29,89 29,61" fill={visual.secondaryColor} stroke={visual.borderColor} strokeWidth="2" />
        <Polygon points="50,57 64,66 64,84 50,93 36,84 36,66" fill="none" stroke={visual.accentColor} strokeWidth="1.5" />
        <Circle cx="50" cy="75" r="7" fill={visual.accentColor} opacity={0.82} />
      </>
    );
  }

  if (visual.pattern === 'sunburst') {
    return (
      <>
        {sharedCorners}
        <G stroke={visual.borderColor} strokeWidth="1.1" opacity={0.62}>
          {[0, 30, 60, 90, 120, 150].map(angle => (
            <Path key={angle} d="M50 75 L50 18" transform={`rotate(${angle} 50 75)`} />
          ))}
        </G>
        <Circle cx="50" cy="75" r="27" fill={visual.secondaryColor} stroke={visual.borderColor} strokeWidth="2.2" />
        <Circle cx="50" cy="75" r="19" fill={visual.backgroundColor} stroke={visual.accentColor} strokeWidth="1.2" />
        <Path d="M35 72 L41 79 L50 62 L59 79 L65 72 L62 89 H38 Z" fill={visual.accentColor} stroke={visual.borderColor} strokeWidth="1.2" />
      </>
    );
  }

  if (visual.pattern === 'masterwork' || visual.pattern === 'celestial') {
    const celestial = visual.pattern === 'celestial';
    return (
      <>
        {sharedCorners}
        <G fill="none" stroke={visual.accentColor} opacity={0.62}>
          <Circle cx="50" cy="75" r="39" strokeWidth="0.8" strokeDasharray="3 5" />
          <Circle cx="50" cy="75" r="29" strokeWidth="1" />
          <Path d="M18 75 Q50 35 82 75 Q50 115 18 75 Z" strokeWidth="1" />
        </G>
        <G fill={visual.borderColor}>
          <Circle cx="20" cy="42" r="1.8" />
          <Circle cx="78" cy="49" r="1.4" />
          <Circle cx="30" cy="113" r="1.3" />
          <Circle cx="73" cy="108" r="1.9" />
        </G>
        <Polygon points={celestial ? '50,47 58,66 78,67 62,80 67,101 50,89 33,101 38,80 22,67 42,66' : '50,45 70,63 63,90 50,105 37,90 30,63'} fill={visual.secondaryColor} stroke={visual.borderColor} strokeWidth="2" />
        <Polygon points="50,55 62,75 50,95 38,75" fill={visual.accentColor} opacity={0.88} />
      </>
    );
  }

  const champion = visual.pattern === 'champion';
  return (
    <>
      {sharedCorners}
      <G fill="none" stroke={visual.accentColor} strokeWidth="1.2" opacity={0.72}>
        <Path d="M17 65 C22 48 31 37 43 31 M83 65 C78 48 69 37 57 31 M17 85 C22 102 31 113 43 119 M83 85 C78 102 69 113 57 119" />
      </G>
      <Path d="M50 43 L72 52 L68 82 C66 96 57 105 50 110 C43 105 34 96 32 82 L28 52 Z" fill={visual.secondaryColor} stroke={visual.borderColor} strokeWidth="2.4" />
      <Path d="M50 51 L64 57 L61 79 C60 89 54 96 50 99 C46 96 40 89 39 79 L36 57 Z" fill={visual.backgroundColor} stroke={visual.accentColor} strokeWidth="1.2" />
      {champion ? <Path d="M38 64 L43 70 L50 58 L57 70 L62 64 L59 82 H41 Z" fill={visual.accentColor} /> : <Polygon points="50,59 57,72 50,86 43,72" fill={visual.accentColor} />}
    </>
  );
}

export function AvatarFrameArtwork({ frameId }: { frameId?: string | null }) {
  const visual = getAvatarFrameVisual(frameId);
  return (
    <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 72 72">
      <Circle cx="36" cy="36" r="32.5" fill="none" stroke={visual.borderColor} strokeWidth="4" />
      <Circle cx="36" cy="36" r="28.8" fill="none" stroke={visual.innerBorderColor} strokeWidth="1.3" opacity={0.9} />
      <AvatarFramePattern visual={visual} />
    </Svg>
  );
}

function AvatarFramePattern({ visual }: { visual: AvatarFrameVisual }) {
  if (visual.style === 'notched') {
    return <Circle cx="36" cy="36" r="32.5" fill="none" stroke={visual.accentColor} strokeWidth="1.8" strokeDasharray="2 12" />;
  }
  if (visual.style === 'segmented') {
    return (
      <>
        <Circle cx="36" cy="36" r="32.5" fill="none" stroke={visual.accentColor} strokeWidth="2.2" strokeDasharray="16 9" />
        <Circle cx="36" cy="3.5" r="2.6" fill={visual.accentColor} />
      </>
    );
  }
  if (visual.style === 'halo') {
    return (
      <>
        <Circle cx="36" cy="36" r="32.5" fill="none" stroke={visual.accentColor} strokeWidth="1.6" strokeDasharray="1.5 5" />
        {[0, 90, 180, 270].map(angle => <Polygon key={angle} points="36,0.5 39,5 36,8 33,5" fill={visual.accentColor} transform={`rotate(${angle} 36 36)`} />)}
      </>
    );
  }
  if (visual.style === 'bronze') {
    return <Circle cx="36" cy="36" r="32" fill="none" stroke={visual.accentColor} strokeWidth="2" strokeDasharray="7 3 1 3" />;
  }
  if (visual.style === 'faceted' || visual.style === 'astral') {
    return (
      <>
        {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
          <Polygon key={angle} points="36,0 40,5 36,10 32,5" fill={visual.accentColor} transform={`rotate(${angle} 36 36)`} opacity={visual.style === 'astral' ? 0.96 : 0.8} />
        ))}
        {visual.style === 'astral' ? <Circle cx="36" cy="36" r="25.5" fill="none" stroke={visual.accentColor} strokeWidth="0.8" strokeDasharray="2 5" /> : null}
      </>
    );
  }
  return (
    <>
      <Path d="M11 17 L18 10 M61 17 L54 10 M11 55 L18 62 M61 55 L54 62" stroke={visual.accentColor} strokeWidth="3" strokeLinecap="round" />
      <Circle cx="36" cy="3.5" r="2.5" fill={visual.accentColor} />
      <Circle cx="36" cy="68.5" r="2.5" fill={visual.accentColor} />
    </>
  );
}

export function AvatarIconArtwork({ iconId }: { iconId?: string | null }) {
  const visual = getAvatarIconVisual(iconId);
  return (
    <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 64 64">
      <Circle cx="32" cy="32" r="27" fill={visual.glowColor} opacity={0.08} />
      <AvatarIconPattern visual={visual} />
    </Svg>
  );
}

function AvatarIconPattern({ visual }: { visual: AvatarIconVisual }) {
  if (visual.icon === 'nine') {
    return (
      <>
        <Circle cx="31" cy="26" r="13" fill="none" stroke={visual.color} strokeWidth="5" />
        <Path d="M42 31 C42 45 36 51 24 51" fill="none" stroke={visual.color} strokeWidth="5" strokeLinecap="round" />
        <Circle cx="31" cy="26" r="4" fill={visual.secondaryColor} />
      </>
    );
  }
  if (visual.icon === 'starforge') {
    return (
      <>
        <Circle cx="32" cy="32" r="20" fill="none" stroke={visual.secondaryColor} strokeWidth="2" opacity={0.72} />
        <Polygon points="32,7 38,25 57,32 38,39 32,57 26,39 7,32 26,25" fill={visual.color} />
        <Polygon points="32,17 36,28 47,32 36,36 32,47 28,36 17,32 28,28" fill={visual.secondaryColor} />
        <Circle cx="32" cy="32" r="5" fill={visual.color} />
      </>
    );
  }
  if (visual.icon === 'shield') {
    return (
      <>
        <Path d="M32 7 L52 15 L49 36 C47 47 40 54 32 59 C24 54 17 47 15 36 L12 15 Z" fill={visual.secondaryColor} stroke={visual.color} strokeWidth="3" strokeLinejoin="round" />
        <Path d="M32 14 L44 19 L42 34 C41 41 37 46 32 50 C27 46 23 41 22 34 L20 19 Z" fill={visual.backgroundColor} opacity={0.9} />
        <Path d="M23 29 L30 36 L43 22" fill="none" stroke={visual.color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </>
    );
  }
  if (visual.icon === 'trophy') {
    return (
      <>
        <Path d="M20 12 H44 V25 C44 37 39 43 32 43 C25 43 20 37 20 25 Z" fill={visual.secondaryColor} stroke={visual.color} strokeWidth="3" />
        <Path d="M20 18 H12 C12 31 18 35 24 35 M44 18 H52 C52 31 46 35 40 35" fill="none" stroke={visual.color} strokeWidth="3" strokeLinecap="round" />
        <Path d="M32 43 V51 M22 56 H42 M26 51 H38" stroke={visual.color} strokeWidth="4" strokeLinecap="round" />
        <Polygon points="32,18 35,25 43,25 37,30 39,37 32,33 25,37 27,30 21,25 29,25" fill={visual.color} opacity={0.88} />
      </>
    );
  }
  if (visual.icon === 'diamond') {
    return (
      <>
        <Polygon points="14,22 23,10 41,10 50,22 32,55" fill={visual.secondaryColor} stroke={visual.color} strokeWidth="3" />
        <Path d="M14 22 H50 M23 10 L27 22 L32 55 L37 22 L41 10 M27 22 H37" fill="none" stroke={visual.color} strokeWidth="1.8" opacity={0.88} />
        <Polygon points="32,14 37,22 32,43 27,22" fill={visual.color} opacity={0.48} />
      </>
    );
  }
  return (
    <>
      <Path d="M32 8 C38 18 49 19 54 27 C46 25 42 31 42 38 C38 33 35 30 32 27 C29 30 26 33 22 38 C22 31 18 25 10 27 C15 19 26 18 32 8 Z" fill={visual.secondaryColor} stroke={visual.color} strokeWidth="2.5" />
      <Path d="M32 24 C42 32 44 42 32 56 C20 42 22 32 32 24 Z" fill={visual.color} />
      <Path d="M32 34 L38 44 L32 50 L26 44 Z" fill={visual.secondaryColor} />
    </>
  );
}

export function AvatarAccessoryArtwork({ accessoryId }: { accessoryId?: string | null }) {
  const visual = getAvatarAccessoryVisual(accessoryId);
  if (visual.icon === 'none') return null;
  return (
    <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 48 48">
      <AvatarAccessoryPattern visual={visual} />
    </Svg>
  );
}

function AvatarAccessoryPattern({ visual }: { visual: AvatarAccessoryVisual }) {
  if (visual.icon === 'watch') {
    return (
      <>
        <Path d="M19 3 H29 L31 13 H17 Z M17 35 H31 L29 45 H19 Z" fill={visual.secondaryColor} />
        <Rect x="12" y="11" width="24" height="26" rx="7" fill={visual.backgroundColor} stroke={visual.color} strokeWidth="3" />
        <Circle cx="24" cy="24" r="8" fill="none" stroke={visual.color} strokeWidth="2" />
        <Path d="M24 18 V24 L29 27" stroke={visual.secondaryColor} strokeWidth="2.5" strokeLinecap="round" />
      </>
    );
  }
  if (visual.icon === 'gem') {
    return (
      <>
        <Polygon points="8,17 16,7 32,7 40,17 24,42" fill={visual.secondaryColor} stroke={visual.color} strokeWidth="2.5" />
        <Path d="M8 17 H40 M16 7 L19 17 L24 42 L29 17 L32 7 M19 17 H29" fill="none" stroke={visual.color} strokeWidth="1.5" />
      </>
    );
  }
  if (visual.icon === 'rocket') {
    return (
      <>
        <Path d="M26 5 C36 10 39 20 34 30 L26 38 L16 28 L20 14 Z" fill={visual.color} stroke={visual.secondaryColor} strokeWidth="2" />
        <Circle cx="27" cy="18" r="5" fill={visual.backgroundColor} stroke={visual.secondaryColor} strokeWidth="2" />
        <Path d="M17 25 L9 29 L15 35 M29 35 L25 43 L19 37" fill={visual.secondaryColor} />
        <Path d="M16 35 L10 42" stroke={visual.color} strokeWidth="3" strokeLinecap="round" />
      </>
    );
  }
  if (visual.icon === 'comet') {
    return (
      <>
        <Path d="M7 37 C15 24 22 17 36 10" fill="none" stroke={visual.secondaryColor} strokeWidth="5" strokeLinecap="round" opacity={0.74} />
        <Path d="M8 29 C18 21 25 16 36 11" fill="none" stroke={visual.color} strokeWidth="2" strokeLinecap="round" />
        <Circle cx="34" cy="13" r="9" fill={visual.secondaryColor} stroke={visual.color} strokeWidth="2.5" />
        <Polygon points="34,7 36,11 41,12 37,15 38,20 34,17 30,20 31,15 27,12 32,11" fill={visual.color} />
      </>
    );
  }
  return (
    <>
      <Path d="M7 15 L15 24 L24 8 L33 24 L41 15 L37 37 H11 Z" fill={visual.secondaryColor} stroke={visual.color} strokeWidth="2.5" strokeLinejoin="round" />
      <Circle cx="15" cy="15" r="3" fill={visual.color} />
      <Circle cx="24" cy="8" r="3" fill={visual.color} />
      <Circle cx="41" cy="15" r="3" fill={visual.color} />
      <Path d="M13 31 H35" stroke={visual.color} strokeWidth="3" strokeLinecap="round" />
    </>
  );
}

export function TableSurfaceDecoration({
  tableThemeId,
  visual: suppliedVisual,
  style,
}: {
  tableThemeId?: string | null;
  visual?: TableThemeVisual;
  style?: StyleProp<ViewStyle>;
}) {
  const visual = suppliedVisual ?? getTableThemeVisual(tableThemeId);
  return (
    <View pointerEvents="none" style={[styles.fill, styles.tableDecoration, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 180" preserveAspectRatio="xMidYMid slice">
        <TablePattern visual={visual} />
      </Svg>
    </View>
  );
}

function TablePattern({ visual }: { visual: TableThemeVisual }) {
  if (visual.pattern === 'carbon') {
    return (
      <G fill="none" stroke={visual.patternColor} strokeWidth="0.7" opacity={0.22}>
        {[-80, -60, -40, -20, 0, 20, 40, 60, 80, 100, 120, 140, 160].map(offset => <Path key={`a-${offset}`} d={`M${offset} 0 L${offset + 90} 180`} />)}
        {[-80, -60, -40, -20, 0, 20, 40, 60, 80, 100, 120, 140, 160].map(offset => <Path key={`b-${offset}`} d={`M${offset + 90} 0 L${offset} 180`} />)}
      </G>
    );
  }
  if (visual.pattern === 'constellation' || visual.pattern === 'aurora') {
    return (
      <>
        <G fill="none" stroke={visual.patternColor} strokeWidth="0.8" opacity={visual.pattern === 'aurora' ? 0.22 : 0.16}>
          <Path d="M5 42 L24 28 L45 39 L67 21 L91 35 M9 128 L31 112 L48 125 L72 103 L96 118" />
          <Path d="M24 28 L31 67 L54 82 L67 21 M31 112 L30 84 L54 82 L72 103" opacity={0.65} />
          {visual.pattern === 'aurora' ? <Path d="M-10 70 C20 34 36 105 64 63 C82 38 96 53 112 31 M-12 148 C19 112 42 163 69 131 C87 109 101 119 113 99" stroke={visual.secondaryAccentColor} strokeWidth="2" /> : null}
        </G>
        <G fill={visual.accentColor} opacity={0.28}>
          {[[24, 28], [45, 39], [67, 21], [31, 67], [54, 82], [31, 112], [48, 125], [72, 103]].map(([cx, cy]) => <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.4" />)}
        </G>
      </>
    );
  }
  if (visual.pattern === 'faceted') {
    return (
      <G fill="none" stroke={visual.patternColor} strokeWidth="0.8" opacity={0.18}>
        <Path d="M0 34 L25 8 L50 38 L78 4 L100 31 M0 34 L24 72 L50 38 L76 78 L100 31 M0 116 L24 72 L51 112 L76 78 L100 120 M0 116 L26 164 L51 112 L77 172 L100 120" />
      </G>
    );
  }
  if (visual.pattern === 'club') {
    return (
      <G fill="none" stroke={visual.patternColor} strokeWidth="1" opacity={0.15}>
        <Path d="M50 16 L72 25 L69 52 C67 64 59 72 50 78 C41 72 33 64 31 52 L28 25 Z" />
        <Path d="M50 102 L72 111 L69 138 C67 150 59 158 50 164 C41 158 33 150 31 138 L28 111 Z" />
        <Path d="M8 62 L25 69 M92 62 L75 69 M8 148 L25 155 M92 148 L75 155" />
      </G>
    );
  }
  return (
    <G fill="none" stroke={visual.patternColor} opacity={0.12}>
      <Circle cx="50" cy="90" r="34" strokeWidth="0.8" />
      <Circle cx="50" cy="90" r="24" strokeWidth="0.6" strokeDasharray="2 5" />
      <Path d="M10 90 H90 M50 28 V152" strokeWidth="0.5" />
      <Polygon points="50,48 73,90 50,132 27,90" strokeWidth="0.8" />
    </G>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject },
  tableDecoration: { opacity: 1 },
});
