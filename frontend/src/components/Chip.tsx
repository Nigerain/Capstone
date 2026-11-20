import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, typography } from '../theme';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function Chip({ label, selected = false, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[typography.cardTitle, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.chip,
    backgroundColor: colors.card,
  },
  chipSelected: { backgroundColor: colors.darkButton },
  labelSelected: { color: colors.onDark },
  pressed: { opacity: 0.7 },
});