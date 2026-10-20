import { Feather } from '@expo/vector-icons';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

type Props = {
  name: string;
  image?: ImageSourcePropType; // category illustration; a placeholder icon shows until it's added
  onPress?: () => void;
};

export function CategoryCard({ name, image, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Browse ${name}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {/* White oval behind the illustration, like the Figma design */}
      <View style={styles.oval}>
        {image ? (
          <Image source={image} style={styles.image} resizeMode="contain" />
        ) : (
          <Feather name="shopping-bag" size={22} color={colors.textMuted} />
        )}
      </View>
      <Text style={typography.title}>{name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 71,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.card,
  },
  pressed: { opacity: 0.8 },
  oval: {
    width: 75,
    height: 55,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: 47, height: 47 },
});
