import { useEffect, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius, spacing } from '../theme';

// Gray placeholder shapes that pulse while real content loads.
// Wrap a group of <Bone>s in one <Skeleton> so they all pulse together.

export function Skeleton({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  // Created once and kept for the component's lifetime.
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    let cancelled = false;

    // Skip the pulse for people who turned on Reduce Motion.
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled || reduceMotion) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
      );
      loop.start();
    });

    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      style={[style, { opacity }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    >
      {children}
    </Animated.View>
  );
}

type BoneProps = {
  width?: DimensionValue;
  height: number;
  rounded?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export function Bone({ width = '100%', height, rounded = 6, color = colors.card, style }: BoneProps) {
  return <View style={[{ width, height, borderRadius: rounded, backgroundColor: color }, style]} />;
}

// Lighter bones that sit on top of a gray card.
const ON_CARD = 'rgba(255, 255, 255, 0.6)';

// Same shape and size as a search-result ProductCard.
function ProductCardSkeleton({ nameWidth }: { nameWidth: DimensionValue }) {
  return (
    <View style={styles.card}>
      <Bone width={57} height={47} rounded={radius.image} color={ON_CARD} />
      <View style={styles.cardInfo}>
        <Bone width={nameWidth} height={14} color={ON_CARD} />
        <Bone width="45%" height={11} color={ON_CARD} />
        <Bone width="55%" height={10} color={ON_CARD} />
      </View>
      <View style={styles.cardPrice}>
        <Bone width={44} height={14} color={ON_CARD} />
        <Bone width={34} height={10} color={ON_CARD} />
      </View>
    </View>
  );
}

// Varied name widths so the list doesn't look like a copy-paste.
const NAME_WIDTHS: DimensionValue[] = ['70%', '55%', '80%', '62%', '48%', '74%'];

export function SearchResultsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <Skeleton style={styles.results}>
      {/* Stands in for the "N results for …" line and the sort chips */}
      <Bone width={150} height={13} />
      <View style={styles.chips}>
        <Bone width={128} height={32} rounded={radius.chip} />
        <Bone width={78} height={32} rounded={radius.chip} />
      </View>
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} nameWidth={NAME_WIDTHS[i % NAME_WIDTHS.length]} />
      ))}
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  results: { gap: 10, paddingTop: spacing.lg },
  chips: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderRadius: radius.card,
  },
  cardInfo: { flex: 1, gap: 6 },
  cardPrice: { alignItems: 'flex-end', gap: 6 },
});
