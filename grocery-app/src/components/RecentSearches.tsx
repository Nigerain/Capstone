import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

type Props = {
  searches: string[];
  onSelect: (term: string) => void;
  onRemove: (term: string) => void;
  onClear: () => void;
};

export function RecentSearches({ searches, onSelect, onRemove, onClear }: Props) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={typography.heading}>Recent searches</Text>
        <Pressable onPress={onClear} hitSlop={8} accessibilityRole="button">
          <Text style={typography.link}>Clear</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        {searches.map((term) => (
          <Pressable
            key={term}
            onPress={() => onSelect(term)}
            accessibilityRole="button"
            accessibilityLabel={`Search ${term}`}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Feather name="search" size={18} color={colors.text} />
            <Text style={[typography.input, styles.term]} numberOfLines={1}>
              {term}
            </Text>
            <Pressable
              onPress={() => onRemove(term)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${term} from recent searches`}
            >
              <Feather name="x" size={16} color={colors.text} />
            </Pressable>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xl, gap: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panel: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
  },
  pressed: { opacity: 0.6 },
  term: { flex: 1 },
});