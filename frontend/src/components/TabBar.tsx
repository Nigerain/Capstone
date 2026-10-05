import { Feather } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { TabParamList } from '../navigation/types';
import { colors, spacing } from '../theme';

type IconName = ComponentProps<typeof Feather>['name'];

const ICONS: Record<keyof TabParamList, IconName> = {
  Home: 'home',
  Search: 'search',
  Activity: 'list',
  Profile: 'user',
};

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

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
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
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