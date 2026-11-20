import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, typography } from '../theme';

// One layout for every empty, error and not-found state:
// icon in a circle, title, message, an optional button, and an optional link under it.

type Action = { label: string; onPress: () => void };

type Props = {
  icon: ComponentProps<typeof Feather>['name'];
  title: string;
  message: string;
  action?: Action;
  secondaryAction?: Action;
};

export function StateMessage({ icon, title, message, action, secondaryAction }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.circle}>
        <Feather name={icon} size={52} color={colors.text} />
      </View>

      <Text style={[typography.heading, styles.title]} accessibilityRole="header">
        {title}
      </Text>
      <Text style={[typography.subtitle, styles.message]}>{message}</Text>

      {action && (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>{action.label}</Text>
        </Pressable>
      )}

      {secondaryAction && (
        <Pressable onPress={secondaryAction.onPress} hitSlop={8} accessibilityRole="button">
          <Text style={[typography.link, styles.link]}>{secondaryAction.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

// Spacing matches the Figma frame "Search Screen – No Results":
// 82 below the search bar, 14 between items, with extra room under the circle and above the button.
const ITEM_GAP = 14;

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginTop: 82, gap: ITEM_GAP },
  circle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20, // 34 to the title
  },
  title: { textAlign: 'center' },
  message: { maxWidth: 300, textAlign: 'center', marginBottom: 24 }, // 38 to the button
  button: {
    width: '100%',
    maxWidth: 332,
    height: 54,
    borderRadius: radius.round,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  buttonText: { fontFamily: fonts.bodySemibold, fontSize: 18, color: colors.onDark },
  link: { textAlign: 'center' },
});
