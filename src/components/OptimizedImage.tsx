import React from 'react';
import {Image, ImageResizeMode, ImageSourcePropType, ImageStyle, Platform, StyleProp} from 'react-native';

interface OptimizedImageProps {
  uri?: string;
  source?: ImageSourcePropType;
  resizeMode?: ImageResizeMode;
  /** Provide alongside `height` for remote images — lets the native image
   *  pipeline downsample during decode instead of decoding at full source
   *  resolution. This is the main lever for avoiding jank/OOM on low-end
   *  devices when rendering image-heavy lists (chat bubbles, moments feed). */
  width?: number;
  height?: number;
  style?: StyleProp<ImageStyle>;
  onLoad?: () => void;
  onError?: () => void;
  testID?: string;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = React.memo(
  ({uri, source, resizeMode = 'cover', width, height, style, onLoad, onError, testID}) => {
    const imageSource = source ?? (uri ? {uri} : undefined);
    if (!imageSource) return null;

    return (
      <Image
        source={imageSource}
        resizeMode={resizeMode}
        // Forces Fresco (Android) / ImageIO (iOS) to decode at the displayed
        // size rather than the source's native resolution.
        resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
        style={[width != null && {width}, height != null && {height}, style]}
        onLoad={onLoad}
        onError={onError}
        testID={testID}
      />
    );
  },
);

export default OptimizedImage;

/** Warms the native image cache so images already look loaded when scrolled into view. */
export function preloadImages(urls: string[]) {
  urls
    .filter((url): url is string => typeof url === 'string' && url.length > 0)
    .forEach(url => {
      Image.prefetch(url).catch(() => undefined);
    });
}
