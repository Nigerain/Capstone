import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useMyStats } from '../hooks/useMyStats';
import type { MyStats } from '../services/statsService';
import { colors, fonts } from '../theme';
import { Bone, Skeleton } from './Skeleton';

// Figma "Reputation card" on the Profile tab: level, points, progress to the
// next level, then accuracy / prices / votes.
export function ReputationCard() {
  const { data, isPending, isError, refetch } = useMyStats();

  if (isPending) return <ReputationCardSkeleton />;

  if (isError) {
    return (
      <View style={[styles.card, styles.errorCard]}>
        <Text style={styles.caption}>Couldn’t load your reputation.</Text>
        <Pressable onPress={() => refetch()} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.retry}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return <ReputationCardContent stats={data} />;
}

function ReputationCardContent({ stats }: { stats: MyStats }) {
  const progress = Math.min(Math.max(stats.progress, 0), 1);

  return (
    <View style={styles.card}>
      <View style={styles.levelRow}>
        <View style={styles.awardCircle}>
          <Feather name="award" size={20} color={colors.scanBannerText} />
        </View>
        <View style={styles.levelText}>
          <Text style={styles.levelName}>{stats.levelName}</Text>
          <Text style={styles.caption}>
            {stats.points} reputation {stats.points === 1 ? 'point' : 'points'}
          </Text>
        </View>
      </View>

      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      >
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.caption}>
        {stats.nextLevelName
          ? `${stats.pointsToNextLevel} more points to reach ${stats.nextLevelName}`
          : 'You’ve reached the top level. Thanks for keeping prices honest!'}
      </Text>

      <View style={styles.divider} />

      <View style={styles.stats}>
        <Stat value={`${Math.round(stats.accuracy * 100)}%`} label="Accuracy" />
        <Stat value={String(stats.pricesSubmitted)} label="Prices" />
        <Stat value={String(stats.votesCast)} label="Votes" />
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// Same shape as the card, in gray, while the numbers load.
function ReputationCardSkeleton() {
  return (
    <Skeleton style={styles.card}>
      <View style={styles.levelRow}>
        <Bone width={40} height={40} rounded={20} />
        <View style={styles.levelText}>
          <Bone width="55%" height={15} />
          <Bone width="40%" height={12} />
        </View>
      </View>
      <Bone width="100%" height={8} rounded={4} />
      <Bone width="70%" height={12} />
      <View style={styles.divider} />
      <View style={styles.stats}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.stat}>
            <Bone width={40} height={18} />
            <Bone width={54} height={12} />
          </View>
        ))}
      </View>
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.pickerRowBorder,
    backgroundColor: colors.pickerRow,
  },
  errorCard: { alignItems: 'center' },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  awardCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.scanBanner,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelText: { flex: 1, gap: 2 },
  levelName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.darkButton },
  caption: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  retry: { fontFamily: fonts.semibold, fontSize: 14, color: colors.positive },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.pickerRowBorder,
    overflow: 'hidden',
  },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.positive },
  divider: { height: 1, backgroundColor: colors.pickerRowBorder },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: fonts.heading, fontSize: 18, color: colors.darkButton },
  statLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
});
