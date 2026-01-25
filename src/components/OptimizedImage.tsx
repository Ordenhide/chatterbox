import React from 'react';
import FastImage, { FastImageProps } from 'react-native-fast-image';
import { Platform, Image as RNImage, ImageProps as RNImageProps } from 'react-native';

interface OptimizedImageProps extends Omit<FastImageProps, 'source'> {
  uri?: string;
  source?: RNImageProps['source'];
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'center';
  priority?: 'low' | 'normal' | 'high';
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  uri,
  source,
  resizeMode = 'cover',
  priority = 'normal',
  ...props
}) => {
  // Use FastImage for remote images, RN Image for local
  const isRemoteUri = typeof uri === 'string' && (uri.startsWith('http') || uri.startsWith('https'));
  
  if (isRemoteUri && Platform.OS !== 'web') {
    return (
      <FastImage
        source={{
          uri,
          priority: FastImage.priority[priority],
          cache: FastImage.cacheControl.immutable,
        }}
        resizeMode={FastImage.resizeMode[resizeMode]}
        {...props}
      />
    );
  }
  
  // Fallback to regular Image for local assets or web
  const imageSource = source || (uri ? { uri } : undefined);
  return (
    <RNImage
      source={imageSource!}
      resizeMode={resizeMode}
      {...props as any}
    />
  );
};

// Preload images
export const preloadImages = (urls: string[]) => {
  if (Platform.OS === 'web') return;
  
  urls.forEach(url => {
    FastImage.preload([
      {
        uri: url,
        priority: FastImage.priority.normal,
      },
    ]);
  });
};
