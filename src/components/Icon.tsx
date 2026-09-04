import React from 'react';
import {I18nManager, StyleSheet} from 'react-native';
import type {StyleProp, ViewStyle} from 'react-native';
import Svg, {Circle, Line, Path, Rect} from 'react-native-svg';

// Mirrors web/src/components/Icon.tsx (same path data, same 24x24 viewBox) so
// the two apps stay visually consistent. react-native-svg is already a
// linked dependency (see TabIcon.tsx), so this needs no native font linking
// like react-native-vector-icons would.
export type IconName =
  | 'eye'
  | 'eyeOff'
  | 'play'
  | 'pause'
  | 'heartFilled'
  | 'flame'
  | 'pin'
  | 'globe'
  | 'mic'
  | 'sparkles'
  | 'music'
  | 'list'
  | 'check'
  | 'close'
  | 'timer'
  | 'camera'
  | 'calendar'
  | 'phone'
  | 'bookmark'
  | 'lock'
  | 'key'
  | 'shield'
  | 'ghost'
  | 'blocked'
  | 'alertTriangle'
  | 'forward'
  | 'droplet'
  | 'wallet'
  | 'person'
  | 'book'
  | 'muteSpeaker'
  | 'rain'
  | 'oceanWave'
  | 'forest'
  | 'coffee'
  | 'lightning'
  | 'wind'
  | 'gift'
  | 'square'
  | 'checkSquare'
  | 'seedling'
  | 'cat'
  | 'dog'
  | 'rabbit'
  | 'fox'
  | 'faceNeutral'
  | 'faceSad'
  | 'faceSleepy';

const FILLED = new Set<IconName>(['play', 'heartFilled']);

/**
 * Glyphs that point somewhere, and so have to be flipped under RTL.
 *
 * Only these. A symmetric glyph gains nothing from mirroring and a
 * near-symmetric one (a clock, a shield) comes out subtly wrong, so this is a
 * list rather than a blanket transform. `forward` marks a forwarded message
 * and labels the swipe-to-reply affordance; in an Arabic layout an unflipped
 * one points back the way the text reads.
 */
const DIRECTIONAL = new Set<IconName>(['forward']);

export default function Icon({
  name,
  size = 18,
  color,
  strokeWidth = 1.9,
  style,
}: {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const filled = FILLED.has(name);
  const common = {
    stroke: filled ? 'none' : color,
    fill: filled ? color : 'none',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  // I18nManager.isRTL is fixed for the life of the process, so this is a plain
  // read rather than state — it cannot change without a relaunch.
  const mirrored = I18nManager.isRTL && DIRECTIONAL.has(name);
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={mirrored ? [styles.mirrored, style] : style}>
      {PATHS(common)[name]}
    </Svg>
  );
}

const PATHS = (common: {
  stroke: string;
  fill: string;
  strokeWidth: number;
  strokeLinecap: 'round';
  strokeLinejoin: 'round';
}): Record<IconName, React.ReactNode> => ({
  eye: (
    <>
      <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" {...common} />
      <Circle cx="12" cy="12" r="3" {...common} />
    </>
  ),
  eyeOff: (
    <>
      <Path
        d="M9.9 5.2A9.5 9.5 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.6M6.1 6.1A17 17 0 0 0 2 12s3.5 7 10 7a9.5 9.5 0 0 0 3.3-.6"
        {...common}
      />
      <Path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" {...common} />
      <Line x1="2" y1="2" x2="22" y2="22" {...common} />
    </>
  ),
  play: <Path d="M8 5v14l11-7z" {...common} />,
  pause: (
    <>
      <Rect x="6" y="5" width="4" height="14" rx="1" {...common} />
      <Rect x="14" y="5" width="4" height="14" rx="1" {...common} />
    </>
  ),
  heartFilled: (
    <Path
      d="M20.8 5.1a5.5 5.5 0 0 0-7.8 0L12 6.1l-1-1a5.5 5.5 0 0 0-7.8 7.7l1 1.1L12 21l7.8-7.1 1-1.1a5.5 5.5 0 0 0 0-7.7z"
      {...common}
    />
  ),
  flame: (
    <Path
      d="M12 2s5 4 5 9a5 5 0 0 1-10 0c0-1.5.6-2.7 1.3-3.6.2 1 .9 1.8 1.7 1.8 1 0 1.5-.8 1.3-2.4C11.2 5.6 12 3.6 12 2z"
      {...common}
    />
  ),
  pin: <Path d="M9 3h6l-1 7 3 2.5V14H8v-1.5L11 10 10 3M12 14v7" {...common} />,
  globe: (
    <>
      <Circle cx="12" cy="12" r="9" {...common} />
      <Path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" {...common} />
    </>
  ),
  mic: (
    <>
      <Rect x="9" y="2" width="6" height="12" rx="3" {...common} />
      <Path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4" {...common} />
    </>
  ),
  sparkles: (
    <>
      <Path d="M12 3l1.6 4.8L18 9.4l-4.4 1.6L12 16l-1.6-5L6 9.4l4.4-1.6L12 3z" {...common} />
      <Path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" {...common} />
    </>
  ),
  music: (
    <>
      <Path d="M9 18V5l12-2v13" {...common} />
      <Circle cx="6" cy="18" r="3" {...common} />
      <Circle cx="18" cy="16" r="3" {...common} />
    </>
  ),
  list: <Path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" {...common} />,
  check: <Path d="M20 6L9 17l-5-5" {...common} />,
  close: <Path d="M18 6L6 18M6 6l12 12" {...common} />,
  timer: (
    <>
      <Circle cx="12" cy="13" r="8" {...common} />
      <Path d="M12 9v4l2.5 2.5M9 2h6" {...common} />
    </>
  ),
  camera: (
    <>
      <Path d="M23 7l-7 5 7 5V7z" {...common} />
      <Rect x="1" y="5" width="15" height="14" rx="2.5" {...common} />
    </>
  ),
  calendar: (
    <>
      <Rect x="3" y="4" width="18" height="18" rx="2.5" {...common} />
      <Path d="M16 2v4M8 2v4M3 10h18" {...common} />
    </>
  ),
  phone: (
    <Path
      d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.1 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"
      {...common}
    />
  ),
  bookmark: <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" {...common} />,
  lock: (
    <>
      <Rect x="5" y="11" width="14" height="10" rx="2" {...common} />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" {...common} />
    </>
  ),
  key: (
    <>
      <Circle cx="8" cy="15" r="4" {...common} />
      <Path d="M11 12l9-9M17 6l3 3M14 9l2 2" {...common} />
    </>
  ),
  shield: <Path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" {...common} />,
  ghost: (
    <>
      <Path d="M6 20V10a6 6 0 0 1 12 0v10l-2.5-2-2 2-1.5-1.5L10.5 20 8 18l-2 2z" {...common} />
      <Path d="M9 10h.01M15 10h.01" {...common} />
    </>
  ),
  blocked: (
    <>
      <Circle cx="12" cy="12" r="9" {...common} />
      <Line x1="5.5" y1="5.5" x2="18.5" y2="18.5" {...common} />
    </>
  ),
  alertTriangle: (
    <>
      <Path d="M12 3L2 21h20L12 3z" {...common} />
      <Path d="M12 10v5M12 18h.01" {...common} />
    </>
  ),
  forward: <Path d="M15 17l5-5-5-5M20 12H9a5 5 0 0 0-5 5v2" {...common} />,
  droplet: <Path d="M12 3s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13z" {...common} />,
  wallet: (
    <>
      <Path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" {...common} />
      <Path d="M16 12h2" {...common} />
    </>
  ),
  person: (
    <>
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" {...common} />
      <Circle cx="12" cy="7" r="4" {...common} />
    </>
  ),
  book: (
    <>
      <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" {...common} />
      <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" {...common} />
    </>
  ),
  muteSpeaker: (
    <>
      <Path d="M11 5L6 9H3v6h3l5 4V5z" {...common} />
      <Line x1="16" y1="9" x2="21" y2="14" {...common} />
      <Line x1="21" y1="9" x2="16" y2="14" {...common} />
    </>
  ),
  rain: (
    <>
      <Path d="M17 13a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A4 4 0 0 0 7 14h10z" {...common} />
      <Path d="M8 18l-1 2M12 18l-1 2M16 18l-1 2" {...common} />
    </>
  ),
  oceanWave: (
    <>
      <Path d="M2 14c1.5-2 3.5-2 5 0s3.5 2 5 0 3.5-2 5 0 3.5 2 5 0" {...common} />
      <Path d="M2 19c1.5-2 3.5-2 5 0s3.5 2 5 0 3.5-2 5 0 3.5 2 5 0" {...common} />
    </>
  ),
  forest: (
    <>
      <Path d="M12 2L6 12h3l-4 8h14l-4-8h3L12 2z" {...common} />
      <Path d="M12 22v-4" {...common} />
    </>
  ),
  coffee: (
    <>
      <Path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8z" {...common} />
      <Path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17" {...common} />
      <Path d="M8 3c0 1-1 1-1 2M12 3c0 1-1 1-1 2" {...common} />
    </>
  ),
  lightning: <Path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" {...common} />,
  wind: (
    <>
      <Path d="M3 8h11a2.5 2.5 0 1 0-2.5-2.5" {...common} />
      <Path d="M3 13h15a2.5 2.5 0 1 1-2.5 2.5" {...common} />
      <Path d="M3 18h9a2 2 0 1 0-2-2" {...common} />
    </>
  ),
  gift: (
    <>
      <Rect x="3" y="8" width="18" height="13" rx="1.5" {...common} />
      <Path d="M3 12h18M12 8v13" {...common} />
      <Path d="M7.5 8a2.5 2.5 0 1 1 4.5-2 2.5 2.5 0 1 1 4.5 2" {...common} />
    </>
  ),
  square: <Rect x="4" y="4" width="16" height="16" rx="3" {...common} />,
  checkSquare: (
    <>
      <Rect x="4" y="4" width="16" height="16" rx="3" {...common} />
      <Path d="M8 12l2.5 2.5L16 9" {...common} />
    </>
  ),
  seedling: (
    <>
      <Path d="M12 21V10" {...common} />
      <Path d="M12 10C12 10 6 10 6 4c6 0 6 6 6 6z" {...common} />
      <Path d="M12 14c0 0 6 0 6-6c-6 0-6 6-6 6z" {...common} />
    </>
  ),
  cat: (
    <>
      <Path d="M5 9l2-5 3 3h4l3-3 2 5" {...common} />
      <Circle cx="12" cy="13" r="8" {...common} />
      <Path d="M9 13h.01M15 13h.01" {...common} />
      <Path d="M10 17c.6.5 1.3.5 2 .5s1.4 0 2-.5" {...common} />
    </>
  ),
  dog: (
    <>
      <Circle cx="12" cy="13" r="8" {...common} />
      <Path d="M5 9c-2-2-3-1-3 2s2 3 3 2M19 9c2-2 3-1 3 2s-2 3-3 2" {...common} />
      <Path d="M9 13h.01M15 13h.01" {...common} />
      <Path d="M10 19c.6.4 1.3.4 2 .4s1.4 0 2-.4" {...common} />
    </>
  ),
  rabbit: (
    <>
      <Circle cx="12" cy="15" r="6" {...common} />
      <Path d="M9 9C8 4 8 2 9.5 2S11 5 11 9M15 9c1-5 1-7-.5-7S13 5 13 9" {...common} />
      <Path d="M10 15h.01M14 15h.01" {...common} />
      <Path d="M11 18h2" {...common} />
    </>
  ),
  fox: (
    <>
      <Path d="M4 8l4 2 4-4 4 4 4-2-2 6a6 6 0 0 1-12 0z" {...common} />
      <Path d="M10 14h.01M14 14h.01" {...common} />
      <Path d="M12 16l-1 1.5h2L12 16z" {...common} />
    </>
  ),
  faceNeutral: (
    <>
      <Circle cx="12" cy="12" r="9" {...common} />
      <Path d="M8 15h8" {...common} />
      <Path d="M9 9h.01M15 9h.01" {...common} />
    </>
  ),
  faceSad: (
    <>
      <Circle cx="12" cy="12" r="9" {...common} />
      <Path d="M8 16s1.5-2 4-2 4 2 4 2" {...common} />
      <Path d="M9 9h.01M15 9h.01" {...common} />
    </>
  ),
  faceSleepy: (
    <>
      <Circle cx="12" cy="12" r="9" {...common} />
      <Path d="M8 9c.5.5 1.5.5 2 0M14 9c.5.5 1.5.5 2 0" {...common} />
      <Path d="M9 15c1 1 5 1 6 0" {...common} />
    </>
  ),
});

const styles = StyleSheet.create({
  mirrored: {transform: [{scaleX: -1}]},
});
