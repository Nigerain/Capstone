import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../theme';

type Props = {
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  value?: string; // "Key Food", "2 mi"; left out for rows like Help
  onPress: () => void;
};

// Figma component "Settings Row": one row in the Profile settings list.
export function SettingsRow({ icon, label, value, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Feather name={icon} size={20} color={colors.darkButton} />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      <Feather name="chevron-right" size={16} color={colors.darkButton} />
    </Pressable>
  );
}

// The thin line between rows (not after the last one).
export function SettingsDivider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 16,
    paddingRight: 14,
    paddingVertical: 14,
  },
  pressed: { backgroundColor: colors.background },
  label: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.darkButton,
  },
  value: {
    maxWidth: '45%', // long store names shrink with "…" instead of pushing the label
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  divider: { height: 1, backgroundColor: colors.pickerRowBorder },
});
