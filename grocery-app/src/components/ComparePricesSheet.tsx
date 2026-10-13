import { Feather } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing, typography } from '../theme';
import type { Item } from '../types/price';
import { formatDistance, formatPrice, formatSize } from '../utils/format';

type Props = {
  visible: boolean;
  item: Item;
  onClose: () => void;
};

export function ComparePricesSheet({ visible, item, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const sorted = [...item.prices].sort((a, b) => a.price - b.price);
  const lowest = sorted[0]?.price ?? 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose} // Android back button
    >
      <View style={styles.overlay}>
        {/* Tapping the dimmed area closes the sheet */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close compare prices"
        />

        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Text style={typography.heading}>Compare Prices</Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close compare prices"
            >
              <Feather name="x" size={22} color={colors.text} />
            </Pressable>
          </View>
          <Text style={typography.meta}>
            {item.name} · {item.brand} · {formatSize(item.size, item.sizeUnit)}
          </Text>
          <Text style={[typography.small, styles.sortNote]}>Sorted by lowest price</Text>

          <ScrollView style={styles.list}>
            {sorted.map((price) => {
              const isBest = price.price === lowest;
              return (
                <View key={price.id} style={styles.row}>
                  <View style={styles.storeIcon}>
                    <Feather name="shopping-cart" size={18} color={colors.text} />
                  </View>
                  <View style={styles.storeInfo}>
                    <Text style={typography.cardTitle}>{price.store}</Text>
                    <Text style={typography.small}>{formatDistance(price.distanceMi)}</Text>
                  </View>
                  <View style={styles.priceColumn}>
                    {isBest && (
                      <View style={styles.badge}>
                        <Text style={typography.badge}>BEST</Text>
                      </View>
                    )}
                    <Text style={typography.cardTitle}>{formatPrice(price.price)}</Text>
                    {!isBest && (
                      <Text style={typography.small}>+{formatPrice(price.price - lowest)}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    maxHeight: '75%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 47,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.card,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sortNote: { marginTop: spacing.sm },
  list: { marginTop: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.card,
  },
  storeIcon: {
    width: 38,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeInfo: { flex: 1, gap: 2 },
  priceColumn: { alignItems: 'flex-end', gap: 2 },
  badge: {
    backgroundColor: colors.badge,
    borderRadius: radius.chip,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
});