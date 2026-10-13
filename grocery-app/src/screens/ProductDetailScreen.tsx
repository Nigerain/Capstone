import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ComparePricesSheet } from '../components/ComparePricesSheet';
import { useItem } from '../hooks/useItem';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, spacing, typography } from '../theme';
import { formatDistance, formatPrice, formatSize, formatUnitPrice } from '../utils/format';
import { getBestPrice, getUnitPrice } from '../utils/price';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;

export function ProductDetailScreen({ route, navigation }: Props) {
  const { itemId } = route.params;
  const { data: item, isLoading, isError } = useItem(itemId);
  const [compareOpen, setCompareOpen] = useState(false);

  const best = item ? getBestPrice(item) : undefined;
  const storeCount = item?.prices.length ?? 0;

  const renderBody = () => {
    if (isLoading) {
      return <Text style={[typography.meta, styles.status]}>Loading…</Text>;
    }
    if (isError || !item) {
      return <Text style={[typography.meta, styles.status]}>We couldn't find this product.</Text>;
    }

    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.imageBox}>
          {item.imageUri ? (
            <Image source={{ uri: item.imageUri }} style={styles.image} resizeMode="contain" />
          ) : (
            <Feather name="shopping-bag" size={64} color={colors.textMuted} />
          )}
        </View>

        <View>
          <Text style={typography.heading}>{item.name}</Text>
          <Text style={[typography.meta, styles.brandSize]}>
            {item.brand} · {formatSize(item.size, item.sizeUnit)}
          </Text>
        </View>

        {best ? (
          <View style={styles.bestCard}>
            <View style={styles.bestBadge}>
              <Text style={styles.bestBadgeText}>Best price</Text>
            </View>
            <View style={styles.bestPriceRow}>
              <Text style={styles.bestPrice}>{formatPrice(best.price)}</Text>
              <Text style={typography.small}>
                {formatUnitPrice(getUnitPrice(item, best), item.sizeUnit)}
              </Text>
            </View>
            <Text style={typography.meta}>
              {best.store} · {formatDistance(best.distanceMi)}
            </Text>
          </View>
        ) : (
          <Text style={typography.subtitle}>No prices shared for this product yet.</Text>
        )}

        {storeCount > 0 && (
          <Pressable
            onPress={() => setCompareOpen(true)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.compareButton, pressed && styles.pressed]}
          >
            <Feather name="bar-chart-2" size={22} color={colors.text} />
            <Text style={styles.compareText}>Compare Prices</Text>
            <Text style={typography.meta}>
              · {storeCount} {storeCount === 1 ? 'store' : 'stores'}
            </Text>
          </Pressable>
        )}

        <View>
          <Text style={styles.sectionTitle}>Details</Text>
          <DetailRow label="Category" value={item.category} />
          <DetailRow label="Brand" value={item.brand} />
          <DetailRow label="Size" value={formatSize(item.size, item.sizeUnit)} isLast />
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          style={styles.backButton}
        >
          <Feather name="chevron-left" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Product Detail</Text>
        {/* Same width as the back button, so the title stays centered */}
        <View style={styles.backButtonSpacer} />
      </View>

      {renderBody()}

      {item && (
        <ComparePricesSheet
          visible={compareOpen}
          item={item}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </SafeAreaView>
  );
}

function DetailRow({ label, value, isLast = false }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View style={[styles.detailRow, !isLast && styles.detailDivider]}>
      <Text style={typography.meta}>{label}</Text>
      <Text style={typography.cardTitle}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 47,
    height: 47,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonSpacer: { width: 47 },
  topTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.text },
  status: { marginTop: spacing.xl, paddingHorizontal: 20 },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: spacing.lg },
  imageBox: {
    height: 282,
    borderRadius: 16,
    backgroundColor: colors.imageBox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '70%', height: '70%' },
  brandSize: { marginTop: spacing.xs, fontSize: 15 },
  bestCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.xs,
  },
  bestBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.badge,
    borderRadius: radius.chip,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  bestBadgeText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.onDark },
  bestPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  bestPrice: { fontFamily: fonts.semibold, fontSize: 28, color: colors.text },
  compareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 51,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.7 },
  compareText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.text, marginBottom: spacing.xs },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  detailDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.textMuted,
  },
});