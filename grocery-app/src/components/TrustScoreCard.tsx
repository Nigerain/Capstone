import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useMyStats } from '../hooks/useMyStats';
import { colors, fonts } from '../theme';
import { Bone, Skeleton } from './Skeleton';

// Figma "Trust score card" on Profile Tab – v2: the user's trust score as a
// percentage, with a line explaining where it comes from.
export function TrustScoreCard() {
  const { data, isPending, isError, refetch } = useMyStats();

  if (isPending) return <TrustScoreCardSkeleton />;

  if (isError) {
    return (
      <View style={[styles.card, styles.errorCard]}>
        <Text style={styles.caption}>Couldn’t load your trust score.</Text>
        <Pressable onPress={() => refetch()} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.retry}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  // Clamp in case the backend ever sends something outside 0-1.
  const percent = Math.round(Math.min(Math.max(data.trustScore, 0), 1) * 100);

  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={`Trust score ${percent} percent. Based on how shoppers voted on your prices.`}
    >
      <View style={styles.iconCircle}>
        <Feather name="award" size={20} color={colors.scanBannerText} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{percent}% trust score</Text>
        <Text style={styles.caption}>Based on how shoppers voted on your prices</Text>
      </View>
    </View>
  );
}

// Same shape as the card, in gray, while the score loads.
function TrustScoreCardSkeleton() {
  return (
    <Skeleton style={styles.card}>
      <Bone width={40} height={40} rounded={20} />
      <View style={styles.text}>
        <Bone width="45%" height={15} />
        <Bone width="80%" height={12} />
      </View>
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.pickerRowBorder,
    backgroundColor: colors.pickerRow,
  },
  errorCard: { flexDirection: 'column' },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.scanBanner,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.semibold, fontSize: 15, color: colors.darkButton },
  caption: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  retry: { fontFamily: fonts.semibold, fontSize: 14, color: colors.positive },
});
