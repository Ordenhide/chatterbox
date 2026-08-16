import React, {createContext, useCallback, useContext, useMemo, useRef} from 'react';
import {Animated} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';

/**
 * One shared scroll offset, published by whichever screen is on top and read
 * by anything that wants to move with it.
 *
 * This exists because the app backdrop (components/LiquidGlassBackground) is
 * mounted once in App.tsx *above* the navigator, so it has no scroll view of
 * its own to listen to — the scrolling happens several screens down the tree
 * from it. Passing an Animated.Value down through the navigator would mean
 * threading a prop through every screen; a context keeps the wiring at the two
 * ends that actually care.
 *
 * The value is driven natively (`useNativeDriver: true` on the Animated.event
 * below), so scroll position never crosses the JS bridge per frame and the
 * parallax keeps up with a fast flick. That is also why this is an
 * Animated.Value in a ref rather than component state: re-rendering the tree
 * on every scroll frame is exactly what this avoids.
 */
const ScrollMotionContext = createContext<Animated.Value | null>(null);

export function ScrollMotionProvider({children}: {children: React.ReactNode}) {
  // Created once for the app's lifetime. Screens reset it rather than
  // replacing it, so consumers can interpolate a stable value forever.
  const scrollY = useRef(new Animated.Value(0)).current;
  return <ScrollMotionContext.Provider value={scrollY}>{children}</ScrollMotionContext.Provider>;
}

/**
 * The raw offset, for consumers that only read it (the backdrop, reveals).
 * Returns null outside a provider so those consumers can degrade to a static
 * layout rather than crashing — parallax is decoration, not function.
 */
export function useScrollMotionValue(): Animated.Value | null {
  return useContext(ScrollMotionContext);
}

/**
 * The publishing half: attach the returned props to a ScrollView/FlatList and
 * that list becomes the app's scroll source while its screen is focused.
 *
 * Resets to 0 on focus because the value is shared. Without that, navigating
 * from a scrolled feed to a short screen would leave the backdrop parked at
 * the old offset, having drifted for a scroll that is no longer on screen.
 *
 * `scrollEventThrottle: 16` is required on iOS for a continuous stream (it
 * defaults to sending one event per drag otherwise) and is ignored on Android,
 * which always streams.
 */
export function useParallaxScroll() {
  const scrollY = useScrollMotionValue();

  useFocusEffect(
    useCallback(() => {
      scrollY?.setValue(0);
    }, [scrollY]),
  );

  const onScroll = useMemo(
    () =>
      scrollY
        ? Animated.event([{nativeEvent: {contentOffset: {y: scrollY}}}], {useNativeDriver: true})
        : undefined,
    [scrollY],
  );

  return {scrollY, onScroll, scrollEventThrottle: 16} as const;
}
