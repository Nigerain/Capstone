import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing, typography } from '../theme';

type Props = {
  query: string;
  onAddPrice: () => void;
  onSearch: (term: string) => void;
};

export function NoResults({ query, onAddPrice, onSearch }: Props) {
  const words = query.trim().split(/\s+/);
  const broader = words.length > 1 ? words[words.length - 1] : null;

  return (
    <View style={styles.container}>
      <View style={styles.circle}>
        <Feather name="search" size={52} color={colors.text} />
      </View>

      <Text style={[typography.heading, styles.title]}>No prices yet</Text>
      <Text style={[typography.subtitle, styles.message]}>
        Nobody has shared a price for “{query}” near you. Add one and help your neighbors save.
      </Text>

      <Pressable
        onPress={onAddPrice}
        accessibilityRole="button"
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>Add a Price</Text>
      </Pressable>

      {broader && (
        <Pressable onPress={() => onSearch(broader)} hitSlop={8} accessibilityRole="button">
          <Text style={[typography.link, styles.link]}>
            Or try a broader search, like “{broader}”
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginTop: 48 },
  circle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { marginTop: 20 },
  message: { marginTop: spacing.sm, maxWidth: 300, textAlign: 'center' },
  button: {
    alignSelf: 'stretch',
    height: 54,
    marginTop: spacing.xl,
    borderRadius: radius.round,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  buttonText: { fontFamily: fonts.semibold, fontSize: 18, color: colors.onDark },
  link: { marginTop: spacing.lg },
});