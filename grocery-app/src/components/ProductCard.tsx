import { Feather } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';
import { formatPrice } from '../utils/format';

type Props = {
  name: string;
  price: number;
  store: string; // e.g. "Key Food · 0.4 mi"
  variant?: 'result' | 'deal';
  brandSize?: string; // e.g. "Perdue · 1.5 lb" (result only)
  unitPrice?: string; // e.g. "$3.53/lb" (result only)
  isBest?: boolean; // shows the BEST badge (result only)
  dropPercent?: number; // e.g. 12 → "↘ 12%" (deal only)
  imageUri?: string;
  onPress?: () => void;
};

export function ProductCard({
  name,
  price,
  store,
  variant = 'result',
  brandSize,
  unitPrice,
  isBest = false,
  dropPercent,
  imageUri,
  onPress,
}: Props) {
  const isDeal = variant === 'deal';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${formatPrice(price)} at ${store}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {/* Product image, or a placeholder icon until real photos exist */}
      <View style={styles.imageBox}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
        ) : (
          <Feather name="shopping-bag" size={20} color={colors.textMuted} />
        )}
      </View>

      <View style={styles.info}>
        <Text style={typography.cardTitle} numberOfLines={1}>
          {name}
        </Text>
        {!isDeal && brandSize && (
          <Text style={typography.meta} numberOfLines={1}>
            {brandSize}
          </Text>
        )}
        <Text style={[typography.meta, !isDeal && styles.storeHighlight]} numberOfLines={1}>
          {store}
        </Text>
      </View>

      <View style={styles.priceColumn}>
        {!isDeal && isBest && (
          <View style={styles.badge}>
            <Text style={typography.badge}>BEST</Text>
          </View>
        )}
        <Text style={typography.cardTitle}>{formatPrice(price)}</Text>
        {!isDeal && unitPrice && <Text style={typography.small}>{unitPrice}</Text>}
        {isDeal && dropPercent !== undefined && (
          <View style={styles.drop}>
            <Feather name="arrow-down-right" size={10} color={colors.positive} />
            <Text style={[typography.small, styles.dropText]}>{dropPercent}%</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderRadius: radius.card,
  },
  pressed: { opacity: 0.8 },
  imageBox: {
    width: 57,
    height: 47,
    borderRadius: radius.image,
    backgroundColor: colors.imageBox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: 39, height: 39 },
  info: { flex: 1, gap: 2 },
  storeHighlight: { color: colors.positive, fontSize: 12 },
  priceColumn: { alignItems: 'flex-end', gap: 2 },
  badge: {
    backgroundColor: colors.badge,
    borderRadius: radius.chip,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  drop: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  dropText: { color: colors.positive },
});