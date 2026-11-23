import { Feather } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, radius, spacing, typography } from '../theme';
import type { Item, Price } from '../types/price';
import {
  daysSince,
  formatBrandSize,
  formatDistance,
  formatPrice,
  formatTimeAgo,
} from '../utils/format';
import { VoteSheetContent } from './VoteSheetContent';

const SLIDE_MS = 280;
// Figma marks prices this old "May be outdated".
const OUTDATED_DAYS = 14;

type Props = {
  visible: boolean;
  item: Item;
  onClose: () => void;
  onAddPrice: () => void;
};

// Tapping a store row slides the list left and the vote sheet in from the
// right, inside the same sheet (a second Modal on top is unreliable on iOS).
export function ComparePricesSheet({ visible, item, onClose, onAddPrice }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height: windowHeight } = useWindowDimensions();

  // The price being voted on; stays set while sliding back, then clears.
  const [selected, setSelected] = useState<Price | null>(null);
  // 0 = list showing, 1 = vote sheet showing. Drives the slide and the height.
  const [progress] = useState(() => new Animated.Value(0));
  const [listHeight, setListHeight] = useState(0);
  const [voteHeight, setVoteHeight] = useState(0);
  // Wait to slide until the vote page has measured itself, so the sheet
  // can grow or shrink to fit it smoothly.
  const opening = useRef(false);

  const slideTo = (toValue: 0 | 1, done?: () => void) =>
    Animated.timing(progress, {
      toValue,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // height can't use the native driver
    }).start(done);

  const openVote = (price: Price) => {
    opening.current = true;
    setVoteHeight(0);
    setSelected(price);
  };

  const backToList = () => slideTo(0, () => setSelected(null));

  // Every time the sheet opens, it starts on the list. Done while rendering
  // (not in an effect), so the first frame already shows the list.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      progress.setValue(0);
      setSelected(null);
    }
  }

  const sheetHeight =
    listHeight > 0 && voteHeight > 0
      ? progress.interpolate({ inputRange: [0, 1], outputRange: [listHeight, voteHeight] })
      : undefined;
  const listX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -width] });
  const voteX = progress.interpolate({ inputRange: [0, 1], outputRange: [width, 0] });
  const sorted = [...item.prices].sort((a, b) => a.price - b.price);
  const lowest = sorted[0]?.price ?? 0;
  const isSingleStore = sorted.length === 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      // Android back button: from the vote sheet, back to the list first.
      onRequestClose={selected ? backToList : onClose}
    >
      <View style={styles.overlay}>
        {/* Tapping the dimmed area closes the sheet */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close compare prices"
        />

        <Animated.View style={[styles.sheet, sheetHeight && { height: sheetHeight }]}>
          <Animated.View
            style={[
              styles.listPage,
              { paddingBottom: insets.bottom + spacing.lg, transform: [{ translateX: listX }] },
            ]}
            onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
            // Hide the off-screen list from screen readers while voting.
            importantForAccessibility={selected ? 'no-hide-descendants' : 'auto'}
            accessibilityElementsHidden={!!selected}
          >
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
            {item.name} · {formatBrandSize(item)}
          </Text>
          {sorted.length > 0 && (
            <Text style={[typography.small, styles.sortNote]}>
              {sorted.length > 1
                ? 'Sorted by lowest price · Tap a price to confirm it'
                : 'Tap the price to confirm it'}
            </Text>
          )}

          {sorted.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={typography.cardTitle}>No prices to compare yet</Text>
              <Text style={typography.meta}>Add the price you saw and it will show up here.</Text>
            </View>
          )}

          <ScrollView style={[styles.list, { maxHeight: windowHeight * 0.5 }]}>
            {sorted.map((price) => {
              // With one store there's nothing to beat, so no BEST badge.
              const isBest = !isSingleStore && price.price === lowest;
              return (
                <Pressable
                  key={price.id}
                  onPress={() => openVote(price)}
                  accessibilityRole="button"
                  accessibilityLabel={`${price.store}, ${formatPrice(price.price)}`}
                  accessibilityHint="Opens a sheet to confirm this price"
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <View style={styles.storeIcon}>
                    <Feather name="shopping-cart" size={18} color={colors.text} />
                  </View>
                  <View style={styles.storeInfo}>
                    <Text style={typography.cardTitle}>{price.store}</Text>
                    <RowMeta price={price} />
                  </View>
                  <View style={styles.priceColumn}>
                    {isBest && (
                      <View style={styles.badge}>
                        <Text style={typography.badge}>BEST</Text>
                      </View>
                    )}
                    <Text style={typography.cardTitle}>{formatPrice(price.price)}</Text>
                    {!isBest && !isSingleStore && (
                      <Text style={typography.small}>+{formatPrice(price.price - lowest)}</Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {sorted.length <= 1 && (
            <View style={styles.footer}>
              {isSingleStore && (
                <Text style={[typography.meta, styles.footerText]}>
                  Only one store so far. Seen it somewhere else?
                </Text>
              )}
              <Pressable
                onPress={onAddPrice}
                accessibilityRole="button"
                style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
              >
                <Text style={styles.addButtonText}>Add a Price</Text>
              </Pressable>
            </View>
          )}
          </Animated.View>

          {selected && (
            <Animated.View
              style={[
                styles.votePage,
                { paddingBottom: insets.bottom + 34, transform: [{ translateX: voteX }] },
              ]}
              onLayout={(e) => {
                setVoteHeight(e.nativeEvent.layout.height);
                if (opening.current) {
                  opening.current = false;
                  slideTo(1);
                }
              }}
            >
              <View style={styles.voteHandleRow}>
                <Pressable
                  onPress={backToList}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Back to compare prices"
                  style={styles.backButton}
                >
                  <Feather name="chevron-left" size={22} color={colors.text} />
                </Pressable>
                <View style={styles.voteHandle} />
              </View>
              <VoteSheetContent
                item={item}
                price={selected}
                onBack={backToList}
                onAddPrice={onAddPrice}
              />
            </Animated.View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// "0.4 mi · 12 confirmed · 2d ago", or "May be outdated" for old prices.
function RowMeta({ price }: { price: Price }) {
  const ageDays = daysSince(price.submittedAt);
  const confirmed = price.confirmCount ?? 0;
  const parts: { text: string; style?: object }[] = [];
  if (price.distanceMi != null) parts.push({ text: formatDistance(price.distanceMi) });
  if (ageDays > OUTDATED_DAYS) parts.push({ text: 'May be outdated', style: styles.outdated });
  else if (confirmed > 0) parts.push({ text: `${confirmed} confirmed`, style: styles.confirmed });
  parts.push({ text: formatTimeAgo(price.submittedAt) });

  return (
    <Text style={typography.small}>
      {parts.map((part, i) => (
        <Text key={i} style={part.style}>
          {i > 0 ? ' · ' : ''}
          {part.text}
        </Text>
      ))}
    </Text>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  listPage: {
    paddingHorizontal: 20,
    paddingTop: spacing.sm,
  },
  // Sits beside the list, off to the right, until it slides in.
  votePage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: colors.pickerRow,
  },
  voteHandleRow: { alignItems: 'center', justifyContent: 'center', minHeight: 22 },
  voteHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.radioBorder },
  backButton: { position: 'absolute', left: 0 },
  rowPressed: { opacity: 0.6 },
  confirmed: { color: colors.positive },
  outdated: { color: colors.warningText },
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
  list: { marginTop: spacing.sm, flexGrow: 0 },
  emptyBox: { marginTop: spacing.lg, gap: spacing.xs },
  footer: { marginTop: spacing.lg, gap: spacing.md },
  footerText: { textAlign: 'center' },
  addButton: {
    height: 48,
    borderRadius: radius.round,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  addButtonText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.onDark },
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