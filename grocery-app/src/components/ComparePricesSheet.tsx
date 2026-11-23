import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  PanResponder,
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
import { VoteControl } from './VoteControl';
import { VoteSheetContent } from './VoteSheetContent';

const SLIDE_MS = 280;
// Figma marks prices this old "May be outdated".
const OUTDATED_DAYS = 14;
// One height for both pages, so the sheet doesn't jump when sliding.
// About Figma's Compare Prices size; never shorter than the vote sheet needs
// on most phones, never taller than most of the screen.
const SHEET_SCREEN_SHARE = 0.6;
const SHEET_MIN = 500;
const SHEET_MAX_SCREEN_SHARE = 0.88;
// Swipe down this far (points), or flick this fast, to close.
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 1;

type Props = {
  visible: boolean;
  item: Item;
  onClose: () => void;
  onAddPrice: () => void;
};

// Tapping a store row slides the list left and the vote sheet in from the
// right, inside the same sheet (a second Modal on top is unreliable on iOS).
// Dragging the top of the sheet (the bar and header) down closes it.
export function ComparePricesSheet({ visible, item, onClose, onAddPrice }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.round(
    Math.min(
      Math.max(windowHeight * SHEET_SCREEN_SHARE, SHEET_MIN),
      windowHeight * SHEET_MAX_SCREEN_SHARE
    )
  );

  // The price being voted on; stays set while sliding back, then clears.
  const [selected, setSelected] = useState<Price | null>(null);
  // 0 = list showing, 1 = vote sheet showing.
  const [progress] = useState(() => new Animated.Value(0));
  // How far the sheet is dragged down, in points.
  const [dragY] = useState(() => new Animated.Value(0));

  // Set when a swipe has carried the sheet off screen; the effect below then
  // tells the parent to close. (The drag handlers are made once, so they
  // can't call the latest onClose themselves.)
  const [swipedAway, setSwipedAway] = useState(false);
  useEffect(() => {
    if (swipedAway) onClose();
  }, [swipedAway, onClose]);

  const [pan] = useState(() => {
    const springBack = () =>
      Animated.spring(dragY, { toValue: 0, bounciness: 4, useNativeDriver: true }).start();
    return PanResponder.create({
      // Taps (X, back chevron) still work: only a downward drag takes over.
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => dragY.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) {
          Animated.timing(dragY, {
            toValue: Dimensions.get('window').height,
            duration: 200,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }).start(() => setSwipedAway(true));
        } else {
          springBack();
        }
      },
      onPanResponderTerminate: springBack,
    });
  });

  const slideTo = (toValue: 0 | 1, done?: () => void) =>
    Animated.timing(progress, {
      toValue,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(done);

  const openVote = (price: Price) => {
    setSelected(price);
    slideTo(1);
  };

  const backToList = () => slideTo(0, () => setSelected(null));

  // Every time the sheet opens, it starts on the list, back in place. Done
  // while rendering (not in an effect), so the first frame is already right.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      progress.setValue(0);
      dragY.setValue(0);
      setSelected(null);
      setSwipedAway(false);
    }
  }

  const listX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -width] });
  const voteX = progress.interpolate({ inputRange: [0, 1], outputRange: [width, 0] });
  // The dimmed background fades as the sheet is dragged away.
  const backdropOpacity = dragY.interpolate({
    inputRange: [0, sheetHeight],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
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
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityLabel="Close compare prices"
          />
        </Animated.View>

        <Animated.View
          style={[styles.sheet, { height: sheetHeight, transform: [{ translateY: dragY }] }]}
        >
          <Animated.View
            style={[
              styles.page,
              styles.listPage,
              { paddingBottom: insets.bottom + spacing.lg, transform: [{ translateX: listX }] },
            ]}
            // Hide the off-screen list from screen readers while voting.
            importantForAccessibility={selected ? 'no-hide-descendants' : 'auto'}
            accessibilityElementsHidden={!!selected}
          >
            {/* Drag area: the bar and the header */}
            <View {...pan.panHandlers}>
              <View style={styles.handleZone}>
                <View style={styles.handle} />
              </View>

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
            </View>

            {sorted.length === 0 && (
              <View style={styles.emptyBox}>
                <Text style={typography.cardTitle}>No prices to compare yet</Text>
                <Text style={typography.meta}>Add the price you saw and it will show up here.</Text>
              </View>
            )}

            <ScrollView style={styles.list}>
              {sorted.map((price) => {
                // With one store there's nothing to beat, so no BEST badge.
                const isBest = !isSingleStore && price.price === lowest;
                return (
                  <Pressable
                    key={price.id}
                    onPress={() => openVote(price)}
                    accessibilityRole="button"
                    accessibilityLabel={`${price.store}, ${formatPrice(price.price)}`}
                    accessibilityHint="Opens the details for this price"
                    style={({ pressed }) => [
                      styles.row,
                      isBest && styles.rowBest,
                      pressed && styles.rowPressed,
                    ]}
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
                      <Text style={styles.rowPrice}>{formatPrice(price.price)}</Text>
                      {/* Quick vote; tapping the rest of the row still opens the vote sheet */}
                      <VoteControl price={price} size="compact" />
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
              style={[styles.page, styles.votePage, { transform: [{ translateX: voteX }] }]}
            >
              {/* Drag area: the bar */}
              <View style={styles.voteHandleRow} {...pan.panHandlers}>
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
              {/* Scrolls only if a small phone can't fit the vote sheet. */}
              <ScrollView
                contentContainerStyle={[
                  styles.voteContent,
                  { paddingBottom: insets.bottom + 34 },
                ]}
                showsVerticalScrollIndicator={false}
              >
                <VoteSheetContent
                  item={item}
                  price={selected}
                  onBack={backToList}
                  onAddPrice={onAddPrice}
                />
              </ScrollView>
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
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  // Both pages fill the sheet; the vote page starts off to the right.
  page: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  listPage: { paddingHorizontal: 20 },
  votePage: { backgroundColor: colors.pickerRow },
  // Taller than the bar itself, so it's easy to grab.
  handleZone: { alignItems: 'center', paddingTop: spacing.sm, paddingBottom: spacing.md },
  handle: {
    width: 47,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sortNote: { marginTop: spacing.sm },
  list: { marginTop: spacing.sm, flex: 1 },
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
  priceColumn: { alignItems: 'flex-end', gap: 4 },
  rowPrice: { fontFamily: fonts.badge, fontSize: 20, color: colors.text },
  // Figma: the cheapest row is light green, edge to edge.
  rowBest: {
    backgroundColor: colors.successRing,
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  badge: {
    backgroundColor: colors.badge,
    borderRadius: radius.chip,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  voteHandleRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  voteHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.radioBorder },
  backButton: { position: 'absolute', left: 24, top: 12 },
  voteContent: { gap: 16, paddingHorizontal: 24 },
  rowPressed: { opacity: 0.6 },
  confirmed: { color: colors.positive },
  outdated: { color: colors.warningText },
});
