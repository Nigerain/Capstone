import { Feather } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '../theme';
import { formatPrice } from '../utils/format';

// Sizes from the Figma components "Shelf Card" and "Shelf See All Card".
export const SHELF_CARD_WIDTH = 132;
export const SEE_ALL_CARD_WIDTH = 110;
const CARD_HEIGHT = 189;

type Props = {
  name: string;
  brandSize: string | null; // "Horizon · 1 gal"
  price: number; // lowest reported price
  unitPrice: string | null; // "$0.04/oz"
  store: string; // "Key Food · 0.4 mi"
  imageUri?: string;
  onPress: () => void;
};

// One product on a category shelf: lowest price near you and where it is.
export function ShelfCard({ name, brandSize, price, unitPrice, store, imageUri, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${formatPrice(price)} at ${store}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.imageBox}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
        ) : (
          <Feather name="shopping-bag" size={22} color={colors.textMuted} />
        )}
      </View>

      {/* Always two lines tall, so every card in a row lines up */}
      <Text style={styles.name} numberOfLines={2}>
        {name}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {brandSize ?? ' '}
      </Text>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatPrice(price)}</Text>
        {unitPrice && (
          <Text style={styles.unitPrice} numberOfLines={1}>
            {unitPrice}
          </Text>
        )}
      </View>
      <Text style={styles.store} numberOfLines={1}>
        {store}
      </Text>
    </Pressable>
  );
}

// Last card in a shelf that has more items than its row shows.
export function SeeAllCard({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`See all ${count} items`}
      style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
    >
      <View style={styles.arrowCircle}>
        <Feather name="arrow-right" size={18} color={colors.onDark} />
      </View>
      <Text style={styles.seeAllLabel}>See all</Text>
      <Text style={styles.meta}>{count} items</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SHELF_CARD_WIDTH,
    height: CARD_HEIGHT,
    padding: 8,
    gap: 5,
    borderRadius: radius.card,
    backgroundColor: colors.background,
  },
  pressed: { opacity: 0.7 },
  imageBox: {
    height: 76,
    borderRadius: radius.image,
    backgroundColor: colors.field,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  name: {
    height: 32,
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 16,
    color: colors.text,
  },
  meta: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  price: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  unitPrice: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary },
  store: { fontFamily: fonts.medium, fontSize: 11, color: colors.positive },
  seeAll: {
    width: SEE_ALL_CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  arrowCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.darkButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seeAllLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
});
