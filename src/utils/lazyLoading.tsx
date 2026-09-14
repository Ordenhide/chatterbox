import React, { Suspense } from 'react';
import { View, ActivityIndicator } from 'react-native';

interface LazyLoadOptions {
  fallback?: React.ReactNode;
}

export function lazyLoad<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  options: LazyLoadOptions = {}
) {
  const LazyComponent = React.lazy(factory);
  const { fallback = <DefaultFallback /> } = options;
  
  return (props: React.ComponentProps<T>) => (
    <Suspense fallback={fallback}>
      <LazyComponent {...props} />
    </Suspense>
  );
}

function DefaultFallback() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

