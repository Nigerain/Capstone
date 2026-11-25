import { Feather } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ActivityRow } from '../components/ActivityRow';
import { Bone, Skeleton } from '../components/Skeleton';
import { StateMessage } from '../components/StateMessage';
import { useHideTabBarOnScroll } from '../hooks/useHideTabBarOnScroll';
import { useMyActivity } from '../hooks/useMyActivity';
import { isNetworkError } from '../services/api';
import { groupByWeek, type MyActivity } from '../services/activityService';
import { useAuthStore } from '../store/useAuthStore';
import { colors, fonts, spacing } from '../theme';

// Built from the Figma frames "Activity Tab – v2 (My prices)" and
// "Activity Tab – v2 Empty state": the prices this user posted, grouped
// into This week / Earlier, each with how voters responded.
export function ActivityScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const { data, isPending, isError, error, refetch } = useMyActivity();

  if (!user) {
    return (
      <View style={styles.centered}>
        <StateMessage
          icon="list"
          title="See your prices here"
          message="Log in to see the prices you’ve posted and how shoppers voted on them."
          action={{
            label: 'Log in',
            onPress: () => navigation.navigate('Login'),
          }}
          secondaryAction={{
            label: 'Create an account',
            onPress: () => navigation.navigate('Signup'),
          }}
        />
      </View>
    );
  }

  if (isPending) return <ActivitySkeleton />;

  if (isError) {
    const offline = isNetworkError(error);
    return (
      <View style={styles.centered}>
        <StateMessage
          icon={offline ? 'wifi-off' : 'alert-circle'}
          title="Couldn’t load your activity"
          message={
            offline
              ? 'Check your connection and try again.'
              : 'Something went wrong on our end. Try again in a moment.'
          }
          action={{ label: 'Try again', onPress: () => refetch() }}
        />
      </View>
    );
  }

  return <ActivityList activity={data} refetch={refetch} />;
}

function ActivityList({
  activity,
  refetch,
}: {
  activity: MyActivity;
  refetch: () => Promise<unknown>;
}) {
  const navigation = useNavigation();
  const tabBarHeight = useBottomTabBarHeight();
  const hideTabBarOnScroll = useHideTabBarOnScroll();
  // Only the pull-to-refresh spinner, not background refetches.
  const [refreshing, setRefreshing] = useState(false);

  const sections = useMemo(
    () => groupByWeek(activity.prices),
    [activity.prices]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const hasPrices = sections.length > 0;

  return (
    <SectionList
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: tabBarHeight + spacing.xl },
      ]}
      sections={sections}
      keyExtractor={(p) => p.id}
      stickySectionHeadersEnabled={false}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.textSecondary}
        />
      }
      ListHeaderComponent={
        <Header
          pricesAdded={activity.pricesAdded}
          confirmations={activity.confirmations}
        />
      }
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {section.title}
        </Text>
      )}
      renderItem={({ item }) => (
        <ActivityRow
          price={item}
          onPress={
            item.itemId
              ? () =>
                  navigation.navigate('ProductDetail', { itemId: item.itemId })
              : undefined
          }
        />
      )}
      ItemSeparatorComponent={RowGap}
      ListEmptyComponent={
        <EmptyState onAdd={() => navigation.navigate('AddPrice')} />
      }
      ListFooterComponent={
        hasPrices ? (
          <Text style={styles.hint}>
            Tap a price to see it on the product page
          </Text>
        ) : undefined
      }
      {...hideTabBarOnScroll}
    />
  );
}

function Header({
  pricesAdded,
  confirmations,
}: {
  pricesAdded: number;
  confirmations: number;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.titleBlock}>
        <Text style={styles.title} accessibilityRole="header">
          Your activity
        </Text>
        <Text style={styles.subtitle}>
          Prices you’ve posted and how shoppers voted
        </Text>
      </View>
      <View style={styles.stats}>
        <StatCard value={pricesAdded} label="Prices added" />
        <StatCard
          value={confirmations}
          label="Confirmations received"
          valueColor={colors.confirmedText}
        />
      </View>
    </View>
  );
}

function StatCard({
  value,
  label,
  valueColor = colors.darkButton,
}: {
  value: number;
  label: string;
  valueColor?: string;
}) {
  return (
    <View
      style={styles.statCard}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Feather name="tag" size={28} color={colors.confirmedText} />
      </View>
      <Text style={styles.emptyTitle} accessibilityRole="header">
        No prices posted yet
      </Text>
      <Text style={styles.emptyMessage}>
        Spot a price at the store? Scan the tag or type it in. Your posts and
        their votes will show up here.
      </Text>
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}
      >
        <Feather name="plus" size={16} color={colors.onDark} />
        <Text style={styles.emptyButtonText}>Post your first price</Text>
      </Pressable>
    </View>
  );
}

function RowGap() {
  return <View style={styles.rowGap} />;
}

// Same layout as the loaded screen, in gray.
function ActivitySkeleton() {
  return (
    <View style={[styles.screen, styles.content]}>
      <Skeleton style={styles.header}>
        <View style={styles.titleBlock}>
          <Bone width={160} height={26} />
          <Bone width="75%" height={13} />
        </View>
        <View style={styles.stats}>
          <Bone width="48%" height={69} rounded={14} />
          <Bone width="48%" height={69} rounded={14} />
        </View>
        <Bone width={80} height={14} style={styles.skeletonSection} />
        {[0, 1, 2].map((i) => (
          <Bone key={i} height={73} rounded={14} />
        ))}
      </Skeleton>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.gutter,
  },
  content: { paddingHorizontal: spacing.gutter, paddingTop: spacing.lg },
  header: { gap: 14 },
  titleBlock: { gap: 4 },
  title: {
    fontFamily: fonts.headingSemibold,
    fontSize: 24,
    color: colors.darkButton,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  stats: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    gap: 2,
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.pickerRowBorder,
    backgroundColor: colors.pickerRow,
  },
  statValue: { fontFamily: fonts.heading, fontSize: 22 },
  statLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 22,
    marginBottom: 12,
  },
  rowGap: { height: 14 },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 18,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    paddingTop: 36,
    paddingBottom: 32,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.pickerRowBorder,
    backgroundColor: colors.pickerRow,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.successRing,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: fonts.headingSemibold,
    fontSize: 20,
    color: colors.darkButton,
    textAlign: 'center',
  },
  emptyMessage: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: colors.darkButton,
  },
  emptyButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.onDark,
  },
  pressed: { opacity: 0.85 },
  skeletonSection: { marginTop: 8 },
});
