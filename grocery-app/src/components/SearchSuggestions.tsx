import { Feather } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing } from '../theme';

type Props = {
  query: string;
  suggestions: string[];
  onSelect: (suggestion: string) => void;
};

export function SearchSuggestions({ query, suggestions, onSelect }: Props) {
  if (suggestions.length === 0) return null;

  return (
    <View style={styles.panel}>
      {suggestions.map((suggestion) => (
        <Pressable
          key={suggestion}
          onPress={() => onSelect(suggestion)}
          accessibilityRole="button"
          accessibilityLabel={`Search ${suggestion}`}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Feather name="search" size={18} color={colors.text} />
          <HighlightedText text={suggestion} match={query} />
        </Pressable>
      ))}
    </View>
  );
}

function HighlightedText({ text, match }: { text: string; match: string }) {
  const start = match ? text.toLowerCase().indexOf(match.toLowerCase()) : -1;

  if (start === -1) {
    return (
      <Text style={[styles.text, styles.bold]} numberOfLines={1}>
        {text}
      </Text>
    );
  }

  const end = start + match.length;
  return (
    <Text style={styles.text} numberOfLines={1}>
      <Text style={styles.bold}>{text.slice(0, start)}</Text>
      <Text style={styles.typed}>{text.slice(start, end)}</Text>
      <Text style={styles.bold}>{text.slice(end)}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      default: { elevation: 4 },
    }),
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14 },
  pressed: { opacity: 0.6 },
  text: { flex: 1, fontSize: 15, color: colors.text },
  bold: { fontFamily: fonts.semibold, color: colors.text },
  typed: { fontFamily: fonts.regular, color: colors.textSecondary },
});