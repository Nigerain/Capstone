import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ComparePricesSheet } from '../components/ComparePricesSheet';
import { Bone, Skeleton } from '../components/Skeleton';
import { StateMessage } from '../components/StateMessage';
import { isNetworkError, isNotFound } from '../services/api';
import { useItem } from '../hooks/useItem';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, spacing, typography } from '../theme';
import { formatBrandSize, formatItemUnitPrice, formatPrice, formatSize, formatStoreLine } from '../utils/format';
import { getBestPrice } from '../utils/price';


type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;

export function ProductDetailScreen({ route, navigation }: Props) {
  const { itemId } = route.params;
  const { data: item, isPending, isError, error, refetch } = useItem(itemId);
  const [compareOpen, setCompareOpen] = useState(false);

  const best = item ? getBestPrice(item) : undefined;
  const storeCount = item?.prices.length ?? 0;
  const goToAddPrice = () => navigation.navigate('AddPrice');

  const renderBody = () => {
    if (isPending) {
      return <ProductDetailSkeleton />;
    }

    // Couldn't reach the server (or it broke): the product may be fine, so offer a retry.
    if (isError && !isNotFound(error)) {
      const offline = isNetworkError(error);
      return (
        <View style={styles.state}>
          <StateMessage
            icon={offline ? 'wifi-off' : 'alert-circle'}
            title={offline ? 'Can’t connect' : 'Something went wrong'}
            message={
              offline
                ? 'Check your internet connection and try again.'
                : 'We couldn’t load this product right now. Please try again.'
            }
            action={{ label: 'Try Again', onPress: () => refetch() }}
            secondaryAction={{ label: 'Back to search', onPress: () => navigation.goBack() }}
          />
        </View>
      );
    }

    // The server answered, but there's no product to show (404, or no prices to build it from).
    if (!item) {
      return (
        <View style={styles.state}>
          <StateMessage
            icon="package"
            title="Product not found"
            message="This product may have been removed, or nobody has shared a price for it yet."
            action={{ label: 'Back to Search', onPress: () => navigation.goBack() }}
            secondaryAction={{ label: 'Add a price for it', onPress: goToAddPrice }}
          />
        </View>
      );
    }
    const sizeLabel = formatSize(item.size, item.sizeUnit);

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
            {item.brand} · {formatBrandSize(item)}
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
              {formatItemUnitPrice(item, best)}
              </Text>
            </View>
            <Text style={typography.meta}>
            {formatStoreLine(best)}
            </Text>
          </View>
        ) : (
          <View style={styles.noPricesCard}>
            <View style={styles.noPricesText}>
              <Text style={typography.cardTitle}>No prices yet</Text>
              <Text style={typography.meta}>
                Be the first to share what this costs at your store.
              </Text>
            </View>
            <Pressable
              onPress={goToAddPrice}
              accessibilityRole="button"
              style={({ pressed }) => [styles.addPriceButton, pressed && styles.pressed]}
            >
              <Text style={styles.addPriceText}>Add a Price</Text>
            </Pressable>
          </View>
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
          {item.category && <DetailRow label="Category" value={item.category} />}
          <DetailRow label="Brand" value={item.brand} isLast={!sizeLabel} />
          {sizeLabel && <DetailRow label="Size" value={sizeLabel} isLast />}
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
          onAddPrice={() => {
            setCompareOpen(false);
            goToAddPrice();
          }}
        />
      )}
    </SafeAreaView>
  );
}

// Mirrors the real layout (image, title, best-price card, compare button, details)
// so nothing jumps around when the product arrives.
function ProductDetailSkeleton() {
  return (
    <Skeleton style={styles.content}>
      <Bone height={282} rounded={16} />
      <View style={styles.skeletonTitle}>
        <Bone width="75%" height={26} />
        <Bone width="45%" height={15} />
      </View>
      <Bone height={104} rounded={radius.card} />
      <Bone height={51} rounded={radius.card} />
      <View style={styles.skeletonTitle}>
        <Bone width={90} height={20} />
        <Bone height={15} />
        <Bone height={15} />
      </View>
    </Skeleton>
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
  state: { paddingHorizontal: 20 },
  skeletonTitle: { gap: spacing.sm },
  noPricesCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.md,
  },
  noPricesText: { gap: spacing.xs },
  addPriceButton: {
    height: 44,
    borderRadius: radius.round,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPriceText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onDark },
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