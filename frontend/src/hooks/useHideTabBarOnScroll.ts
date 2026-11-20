import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { useTabBarStore } from '../store/useTabBarStore';

// Ignore tiny finger wobbles; only react to a real scroll.
const MIN_SCROLL_DELTA = 10;
// Near the top of the list the bar always shows.
const TOP_ZONE = 40;

// Spread onto a ScrollView or FlatList: hides the tab bar when scrolling
// down and brings it back when scrolling up, like the X app.
export function useHideTabBarOnScroll() {
  const setHidden = useTabBarStore((s) => s.setHidden);
  const lastY = useRef(0);

  // Coming back to this screen (e.g. from Product Detail) always shows the bar.
  useFocusEffect(
    useCallback(() => {
      setHidden(false);
    }, [setHidden])
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      // Clamp so the iOS bounce at the top or bottom doesn't count as scrolling.
      const maxY = Math.max(0, contentSize.height - layoutMeasurement.height);
      const y = Math.min(Math.max(contentOffset.y, 0), maxY);

      if (y <= TOP_ZONE) {
        setHidden(false);
        lastY.current = y;
        return;
      }

      const delta = y - lastY.current;
      if (Math.abs(delta) < MIN_SCROLL_DELTA) return;

      setHidden(delta > 0); // down → hide, up → show
      lastY.current = y;
    },
    [setHidden]
  );

  return { onScroll, scrollEventThrottle: 16 };
}
