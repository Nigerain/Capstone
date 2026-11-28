import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SeeAllCard, SHELF_CARD_WIDTH, ShelfCard } from '../components/ShelfCard';
import { Bone, Skeleton } from '../components/Skeleton';
import { StateMessage } from '../components/StateMessage';
import { SHELF_PREVIEW_COUNT, type Shelf } from '../constants/categories';
import { useCategoryShelves } from '../hooks/useCategoryShelves';
import { isNetworkError } from '../services/api';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, spacing, typography } from '../theme';
import type { Item } from '../types/price';
import { formatItemUnitPrice, formatSize, formatStoreLine } from '../utils/format';
import { getBestPrice } from '../utils/price';

// Figma: "Category Screen – Dairy" (and Meat, Produce, Pantry, Frozen).
// Vertical list of shelves; each shelf scrolls sideways on its own.

type Props = NativeStackScreenProps<RootStackParamList, 'Category'>;

const CARD_GAP = 12;

export function CategoryScreen({ route, navigation }: Props) {
  const { category } = route.params;
  const { data: shelves, isPending, isError, error, refetch } = useCategoryShelves(category);
  const insets = useSafeAreaInsets();

  // Shelves where "See all" was tapped show every item instead of the first 10.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggle = (title: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });

  const openItem = (item: Item) => navigation.navigate('ProductDetail', { itemId: item.id });

  const renderBody = () => {
    if (isPending) return <CategorySkeleton />;

    if (isError) {
      const offline = isNetworkError(error);
      return (
        <View style={styles.state}>
          <StateMessage
            icon={offline ? 'wifi-off' : 'alert-circle'}
            title={offline ? 'Can’t connect' : 'Something went wrong'}
            message={
              offline
                ? 'Check your internet connection and try again.'
                : `We couldn’t load ${category} right now. Please try again.`
            }
            action={{ label: 'Try Again', onPress: () => refetch() }}
          />
        </View>
      );
    }

    if (!shelves.length) {
      return (
        <View style={styles.state}>
          <StateMessage
            icon="shopping-bag"
            title={`No prices in ${category} yet`}
            message="Be the first to add one. It helps shoppers near you save."
            action={{ label: 'Add a Price', onPress: () => navigation.navigate('AddPrice') }}
          />
        </View>
      );
    }

    return (
      <FlatList
        data={shelves}
        keyExtractor={(shelf) => shelf.title}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xl }]}
        ListHeaderComponent={<Text style={styles.subtitle}>Lowest reported prices near you</Text>}
        renderItem={({ item: shelf }) => (
          <ShelfRow
            shelf={shelf}
            expanded={expanded.has(shelf.title)}
            onToggle={() => toggle(shelf.title)}
            onOpenItem={openItem}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
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
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Feather name="chevron-left" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle} accessibilityRole="header">
          {category}
        </Text>
        {/* Same width as the back button, so the title stays centered */}
        <View style={styles.backButtonSpacer} />
      </View>

      {renderBody()}
    </SafeAreaView>
  );
}

// Cheapest first, matching the "Lowest price" order in Figma.
function byBestPrice(a: Item, b: Item): number {
  return (getBestPrice(a)?.price ?? Infinity) - (getBestPrice(b)?.price ?? Infinity);
}

function ShelfRow({
  shelf,
  expanded,
  onToggle,
  onOpenItem,
}: {
  shelf: Shelf;
  expanded: boolean;
  onToggle: () => void;
  onOpenItem: (item: Item) => void;
}) {
  const sorted = [...shelf.items].sort(byBestPrice);
  const hasMore = sorted.length > SHELF_PREVIEW_COUNT;
  const visible = expanded ? sorted : sorted.slice(0, SHELF_PREVIEW_COUNT);

  return (
    <View style={styles.shelf}>
      <View style={styles.shelfHeader}>
        <Text style={styles.shelfTitle} accessibilityRole="header">
          {shelf.title}
        </Text>
        {hasMore && (
          <Pressable onPress={onToggle} hitSlop={8} accessibilityRole="button">
            <Text style={typography.link}>{expanded ? 'Show less' : 'See all'}</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        horizontal
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.row}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => {
          const best = getBestPrice(item);
          // groupIntoShelves only gets priced items, but stay safe.
          if (!best) return null;
          // "Horizon · 1 gal"; either part can be missing on user-added items.
          const brandSize = [item.brand, formatSize(item.size, item.sizeUnit)]
            .filter(Boolean)
            .join(' · ');
          return (
            <ShelfCard
              name={item.name}
              brandSize={brandSize || null}
              price={best.price}
              unitPrice={formatItemUnitPrice(item, best)}
              store={formatStoreLine(best)}
              imageUri={item.imageUri}
              onPress={() => onOpenItem(item)}
            />
          );
        }}
        ListFooterComponent={
          hasMore && !expanded ? <SeeAllCard count={sorted.length} onPress={onToggle} /> : undefined
        }
      />
    </View>
  );
}

// Same shape as the real screen: a few shelves of card outlines.
function CategorySkeleton() {
  return (
    <Skeleton style={styles.skeleton}>
      <Bone width={220} height={13} />
      {[0, 1, 2].map((shelf) => (
        <View key={shelf} style={styles.skeletonShelf}>
          <Bone width={110} height={18} />
          <View style={styles.skeletonRow}>
            {[0, 1, 2].map((card) => (
              <View key={card} style={styles.skeletonCard}>
                <Bone height={76} rounded={radius.image} />
                <Bone width="85%" height={13} />
                <Bone width="60%" height={11} />
                <Bone width="45%" height={16} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </Skeleton>
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
  pressed: { opacity: 0.7 },
  state: { paddingHorizontal: 20 },
  list: { paddingTop: spacing.lg, gap: 26 },
  subtitle: { ...typography.meta, paddingHorizontal: spacing.gutter },
  shelf: { gap: 10 },
  shelfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.gutter,
  },
  shelfTitle: { fontFamily: fonts.semibold, fontSize: 18, color: colors.text },
  row: { paddingHorizontal: spacing.gutter, gap: CARD_GAP },
  skeleton: { paddingTop: spacing.lg, paddingHorizontal: spacing.gutter, gap: 26 },
  skeletonShelf: { gap: 10 },
  skeletonRow: { flexDirection: 'row', gap: CARD_GAP },
  skeletonCard: { width: SHELF_CARD_WIDTH, gap: 6 },
});
