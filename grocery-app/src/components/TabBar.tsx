import { Feather } from '@expo/vector-icons';
import {
  BottomTabBarHeightCallbackContext,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import {
  useContext,
  useEffect,
  useState,
  type ComponentProps,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { TabParamList } from '../navigation/types';
import { useTabBarStore } from '../store/useTabBarStore';
import { colors, spacing } from '../theme';

const SLIDE_MS = 200;

type IconName = ComponentProps<typeof Feather>['name'];

const ICONS: Record<keyof TabParamList, IconName> = {
  Home: 'home',
  Search: 'search',
  Activity: 'list',
  Profile: 'user',
};

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const reportHeight = useContext(BottomTabBarHeightCallbackContext);
  const hiddenByScroll = useTabBarStore((s) => s.hidden);
  const setHidden = useTabBarStore((s) => s.setHidden);

  const [height, setHeight] = useState(0);
  const [translateY] = useState(() => new Animated.Value(0));
  const [screenReaderOn, setScreenReaderOn] = useState(false);

  // Screen reader users navigate by swiping, so never hide the bar on them.
  const hidden = hiddenByScroll && !screenReaderOn;

  // Switching tabs always shows the bar again.
  useEffect(() => {
    setHidden(false);
  }, [state.index, setHidden]);

  useEffect(() => {
    // The web build always reports a screen reader as on, so only check on phones.
    if (Platform.OS === 'web') return;
    let active = true;
    AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (active) setScreenReaderOn(on);
    });
    const sub = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setScreenReaderOn
    );
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  // Slide down by the bar's own height to hide it, back to 0 to show it.
  useEffect(() => {
    Animated.timing(translateY, {
      toValue: hidden ? height : 0,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [hidden, height, translateY]);

  // Screens use this height (via useBottomTabBarHeight) to keep their last
  // items from sitting behind the bar.
  const handleLayout = (e: LayoutChangeEvent) => {
    const measured = e.nativeEvent.layout.height;
    setHeight(measured);
    reportHeight?.(measured);
  };

  const renderTab = (index: number) => {
    const route = state.routes[index];
    const focused = state.index === index;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    };

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={route.name}
        style={[styles.tab, focused && styles.tabActive]}
      >
        <Feather name={ICONS[route.name as keyof TabParamList]} size={28} color={colors.text} />
      </Pressable>
    );
  };

  return (
    <Animated.View
      onLayout={handleLayout}
      style={[
        styles.bar,
        {
          paddingBottom: Math.max(insets.bottom, spacing.md),
          transform: [{ translateY }],
          pointerEvents: hidden ? 'none' : 'auto',
        },
      ]}
    >
      {renderTab(0)}
      {renderTab(1)}

      <Pressable
        onPress={() => navigation.navigate('AddPrice')}
        accessibilityRole="button"
        accessibilityLabel="Add a price"
        style={styles.addButton}
      >
        <Feather name="plus" size={24} color={colors.onDark} />
      </Pressable>

      {renderTab(2)}
      {renderTab(3)}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    // Floats over the screen, so content can use the space while it's hidden.
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: 4,
    borderTopColor: colors.border,
  },
  tab: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: colors.border },
  addButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.darkButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
});