import { Feather } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useVoteOnPrice } from '../hooks/useVoteOnPrice';
import type { Vote } from '../services/voteService';
import { colors, fonts } from '../theme';
import type { Price } from '../types/price';

type Props = {
  price: Price;
  // 'regular' = Product Detail best-price card, 'compact' = Compare Prices rows.
  size?: 'regular' | 'compact';
};

// The thumbs pill from the Figma "VoteControl" component: 👍 count 👎.
// Thumbs up = "still accurate", thumbs down = "the price changed". Tapping the
// thumb you already picked takes the vote back. The count is how many shoppers
// confirmed the price.
export function VoteControl({ price, size = 'regular' }: Props) {
  const { myVote, confirmed, pending, isOwn, toggle } = useVoteOnPrice(price);
  const compact = size === 'compact';

  // The backend refuses votes on your own price, so show a label instead.
  if (isOwn) {
    return (
      <View style={[styles.ownTag, compact && styles.ownTagCompact]}>
        <Text style={styles.ownTagText}>Your price</Text>
      </View>
    );
  }

  const onPress = async (vote: Vote) => {
    const error = await toggle(vote);
    // The pill has no room for an error line, so say it in an alert.
    if (error) Alert.alert('Vote not saved', error);
  };

  const busy = pending !== null;
  const upActive = myVote === 'up';
  const downActive = myVote === 'down';
  const iconSize = compact ? 15 : 18;

  return (
    <View
      style={[
        styles.pill,
        compact ? styles.pillCompact : styles.pillRegular,
        upActive && styles.pillUp,
        downActive && styles.pillDown,
      ]}
    >
      <Pressable
        onPress={() => onPress('up')}
        disabled={busy}
        hitSlop={compact ? 10 : 4}
        accessibilityRole="button"
        accessibilityLabel={
          upActive ? 'Undo still accurate vote' : 'Price is still accurate'
        }
        accessibilityState={{
          selected: upActive,
          busy: pending === 'up' || (upActive && pending === 'undo'),
        }}
        style={({ pressed }) => [
          styles.button,
          compact ? styles.buttonCompact : styles.buttonRegular,
          pressed && styles.pressed,
        ]}
      >
        {pending === 'up' || (upActive && pending === 'undo') ? (
          <ActivityIndicator size="small" color={colors.voteActive} />
        ) : (
          <Feather
            name="thumbs-up"
            size={iconSize}
            color={upActive ? colors.voteActive : colors.voteIcon}
          />
        )}
      </Pressable>

      <Text
        style={[
          styles.count,
          compact && styles.countCompact,
          upActive && styles.countUp,
        ]}
        accessibilityLabel={`${confirmed} confirmed`}
      >
        {confirmed}
      </Text>

      <Pressable
        onPress={() => onPress('down')}
        disabled={busy}
        hitSlop={compact ? 10 : 4}
        accessibilityRole="button"
        accessibilityLabel={
          downActive ? 'Undo price changed vote' : 'Price has changed'
        }
        accessibilityState={{
          selected: downActive,
          busy: pending === 'down' || (downActive && pending === 'undo'),
        }}
        style={({ pressed }) => [
          styles.button,
          compact ? styles.buttonCompact : styles.buttonRegular,
          pressed && styles.pressed,
        ]}
      >
        {pending === 'down' || (downActive && pending === 'undo') ? (
          <ActivityIndicator size="small" color={colors.warningText} />
        ) : (
          <Feather
            name="thumbs-down"
            size={iconSize}
            color={downActive ? colors.warningText : colors.voteIcon}
          />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  // Figma: 103 x 41 on Product Detail, gray outline.
  pillRegular: { padding: 2, gap: 2, borderColor: colors.voteBorder },
  // Figma: 104 x 27 in Compare Prices rows, green outline.
  pillCompact: { paddingHorizontal: 4, gap: 4, borderColor: colors.voteActive },
  pillUp: {
    backgroundColor: colors.voteActiveBg,
    borderColor: colors.voteActive,
  },
  pillDown: {
    backgroundColor: colors.scanBanner,
    borderColor: colors.warningText,
  },
  button: { alignItems: 'center', justifyContent: 'center' },
  buttonRegular: { width: 36, height: 36, borderRadius: 18 },
  // Small to match Figma; hitSlop keeps the tap area near 44pt.
  buttonCompact: { width: 28, height: 25 },
  pressed: { opacity: 0.5 },
  count: {
    minWidth: 18,
    textAlign: 'center',
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
  countCompact: { fontSize: 14 },
  countUp: { color: colors.voteActive },
  ownTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 22,
    backgroundColor: colors.scanBanner,
  },
  ownTagCompact: { paddingVertical: 3 },
  ownTagText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.warningText,
  },
});
