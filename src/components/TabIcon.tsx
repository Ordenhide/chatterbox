import React from 'react';
import Svg, {Circle, Path} from 'react-native-svg';

export type TabIconName = 'chats' | 'profile';

type TabIconProps = {
  name: TabIconName;
  color: string;
  size?: number;
};

/**
 * Minimal line-art tab icons (react-native-svg is already a linked
 * dependency, so this needs no native font linking/rebuild like
 * react-native-vector-icons would). Colored via the `color` react-navigation
 * passes to tabBarIcon, so active/inactive tint works, unlike static emoji.
 */
function TabIcon({name, color, size = 24}: TabIconProps) {
  const common = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  };

  switch (name) {
    case 'chats':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
            {...common}
          />
        </Svg>
      );
    case 'profile':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" {...common} />
          <Circle cx="12" cy="7" r="4" {...common} />
        </Svg>
      );
    default:
      return null;
  }
}

export default React.memo(TabIcon);
