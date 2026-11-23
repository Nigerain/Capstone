import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  isOwnPrice,
  removeVote,
  submitVote,
  voteErrorMessage,
  type Vote,
} from '../services/voteService';
import { useAuthStore } from '../store/useAuthStore';
import { useVoteStore } from '../store/useVoteStore';
import { colors, fonts } from '../theme';
import type { Item, Price } from '../types/price';
import {
  formatBrandSize,
  formatDistance,
  formatPrice,
  formatTimeAgo,
} from '../utils/format';

type Props = {
  item: Item;
  price: Price;
  onBack: () => void; // back to the Compare Prices list
  onAddPrice: () => void; // closes the sheet and opens Add a Price
};

type Pending = Vote | 'undo' | null;

// The vote side of the Compare Prices sheet, from the Figma frames
// "Vote Sheet – Is This Price Right?", "– Thanks for Confirming" and
// "– Your Own Price". "No, the price changed" has no frame yet, so it gets a
// thank-you in the same style that offers to add the new price.
// Left out for now: the "+2 reputation" chip (reputation is still tentative).
export function VoteSheetContent({ item, price, onBack, onAddPrice }: Props) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const override = useVoteStore((s) => s.votes[price.id]);
  const setVote = useVoteStore((s) => s.setVote);

  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);

  // This session's vote wins over what the data says, until the item reloads.
  const original = price.myVote ?? null;
  const myVote = override !== undefined ? override : original;

  // Counts as the backend sent them, adjusted for a vote it hasn't seen yet.
  const confirmed = adjust(
    price.confirmCount ?? 0,
    original === 'up',
    myVote === 'up'
  );
  const disputed = adjust(
    price.disputeCount ?? 0,
    original === 'down',
    myVote === 'down'
  );

  const run = async (next: Pending) => {
    setError(null);
    setPending(next);
    try {
      if (next === 'undo') await removeVote(price.id);
      else if (next) await submitVote(price.id, next);
      setVote(price.id, next === 'undo' ? null : next);
      // Counts on the product page and in search are now out of date.
      queryClient.invalidateQueries({ queryKey: ['items'] });
    } catch (e) {
      setError(voteErrorMessage(e));
    } finally {
      setPending(null);
    }
  };

  const subtitle = `${item.name} · ${formatBrandSize(item)}`;
  const distance =
    price.distanceMi != null ? formatDistance(price.distanceMi) : null;

  // --- Your own price -----------------------------------------------------
  if (isOwnPrice(price, user)) {
    return (
      <>
        <Header title="Your price" subtitle={subtitle} />
        <PriceCard
          store={price.store}
          meta={[
            distance,
            'Posted by you',
            formatTimeAgo(price.submittedAt, true),
          ]}
          price={price.price}
        />
        <View style={styles.infoBanner}>
          <Feather name="info" size={18} color={colors.warningText} />
          <Text style={styles.infoText}>
            You can’t vote on your own price. Other shoppers nearby will confirm
            it.
          </Text>
        </View>
        <View style={styles.stats}>
          <View style={[styles.stat, styles.statConfirmed]}>
            <Text style={[styles.statNumber, { color: colors.confirmedText }]}>
              {confirmed}
            </Text>
            <Text style={styles.statLabel}>Confirmed</Text>
          </View>
          <View style={[styles.stat, styles.statDisputed]}>
            <Text style={[styles.statNumber, { color: colors.warningText }]}>
              {disputed}
            </Text>
            <Text style={styles.statLabel}>Said it changed</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Button label="Update my price" onPress={onAddPrice} />
          <Button label="Close" variant="secondary" onPress={onBack} />
        </View>
      </>
    );
  }

  // --- After "Yes, still accurate" ----------------------------------------
  if (myVote === 'up') {
    return (
      <>
        <Done
          icon={
            <View style={styles.doneIconUp}>
              <Feather name="check" size={32} color={colors.onDark} />
            </View>
          }
          title="Thanks for confirming!"
          message={`${confirmed} ${confirmed === 1 ? 'shopper has' : 'shoppers have'} now confirmed ${formatPrice(price.price)} for ${item.name} at ${price.store}.`}
        />
        <ErrorLine message={error} />
        <View style={styles.actions}>
          <Button label="Done" onPress={onBack} />
        </View>
        <TextLink
          label="Undo my vote"
          busy={pending === 'undo'}
          onPress={() => run('undo')}
        />
      </>
    );
  }

  // --- After "No, the price changed" (no Figma frame yet) -----------------
  if (myVote === 'down') {
    return (
      <>
        <Done
          icon={
            <View style={styles.doneIconDown}>
              <Feather name="refresh-cw" size={28} color={colors.warningText} />
            </View>
          }
          title="Thanks for letting us know"
          message={`Know the new price at ${price.store}? Add it so shoppers nearby see the right one.`}
        />
        <ErrorLine message={error} />
        <View style={styles.actions}>
          <Button label="Add the new price" onPress={onAddPrice} />
          <Button label="Done" variant="secondary" onPress={onBack} />
        </View>
        <TextLink
          label="Undo my vote"
          busy={pending === 'undo'}
          onPress={() => run('undo')}
        />
      </>
    );
  }

  // --- Is this price still right? -----------------------------------------
  return (
    <>
      <Header title="Is this price still right?" subtitle={subtitle} />
      <PriceCard
        store={price.store}
        meta={[
          distance,
          price.submittedBy ? `Posted by ${price.submittedBy}` : null,
        ]}
        price={price.price}
      />
      <View style={styles.confidence}>
        <View style={[styles.chip, confirmed === 0 && styles.chipEmpty]}>
          <Feather
            name="shield"
            size={15}
            color={
              confirmed === 0 ? colors.textSecondary : colors.confirmedText
            }
          />
          <Text
            style={[styles.chipText, confirmed === 0 && styles.chipTextEmpty]}
          >
            {confirmed === 0
              ? 'No one has confirmed it yet'
              : `${confirmed} ${confirmed === 1 ? 'shopper' : 'shoppers'} confirmed`}
          </Text>
        </View>
        <View style={styles.clockRow}>
          <Feather name="clock" size={14} color={colors.textSecondary} />
          <Text style={styles.clockText}>
            {price.lastConfirmedAt
              ? `Last confirmed ${formatTimeAgo(price.lastConfirmedAt, true)}`
              : `Posted ${formatTimeAgo(price.submittedAt, true)}`}
          </Text>
        </View>
      </View>
      <ErrorLine message={error} />
      <View style={[styles.actions, styles.actionsAsk]}>
        <Button
          label="Yes, still accurate"
          busy={pending === 'up'}
          disabled={pending !== null}
          onPress={() => run('up')}
        />
        <Button
          label="No, the price changed"
          variant="secondary"
          busy={pending === 'down'}
          disabled={pending !== null}
          onPress={() => run('down')}
        />
      </View>
      <TextLink
        label="Report a problem with this listing"
        // TODO: no design or backend for reports yet.
        onPress={() =>
          Alert.alert('Coming soon', 'Reporting a listing isn’t built yet.')
        }
      />
    </>
  );
}

// A count from the backend, plus or minus a vote it hasn't counted yet.
function adjust(
  count: number,
  wasCounted: boolean,
  isCounted: boolean
): number {
  return Math.max(0, count - (wasCounted ? 1 : 0) + (isCounted ? 1 : 0));
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

function PriceCard({
  store,
  meta,
  price,
}: {
  store: string;
  meta: (string | null)[];
  price: number;
}) {
  const line = meta.filter(Boolean).join(' · ');
  return (
    <View style={styles.priceCard}>
      <View style={styles.priceCardText}>
        <Text style={styles.store}>{store}</Text>
        {line ? <Text style={styles.meta}>{line}</Text> : null}
      </View>
      <Text style={styles.price}>{formatPrice(price)}</Text>
    </View>
  );
}

function Done({
  icon,
  title,
  message,
}: {
  icon: ReactNode;
  title: string;
  message: string;
}) {
  return (
    <View style={styles.done} accessibilityLiveRegion="polite">
      {icon}
      <Text style={[styles.title, styles.center]} accessibilityRole="header">
        {title}
      </Text>
      <Text style={[styles.subtitle, styles.center]}>{message}</Text>
    </View>
  );
}

function Button({
  label,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  busy?: boolean;
  disabled?: boolean;
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: disabled || busy }}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        (pressed || (disabled && !busy)) && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? colors.onDark : colors.dark} />
      ) : (
        <Text
          style={
            primary ? styles.buttonPrimaryText : styles.buttonSecondaryText
          }
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function TextLink({
  label,
  onPress,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      hitSlop={8}
    >
      {busy ? (
        <ActivityIndicator color={colors.textSecondary} />
      ) : (
        <Text style={styles.link}>{label}</Text>
      )}
    </Pressable>
  );
}

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text style={styles.error} accessibilityLiveRegion="polite">
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  title: {
    fontFamily: fonts.headingSemibold,
    fontSize: 22,
    color: colors.darkButton,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  center: { textAlign: 'center' },
  priceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.pickerRowBorder,
    backgroundColor: colors.surface,
  },
  priceCardText: { flex: 1, gap: 3 },
  store: { fontFamily: fonts.semibold, fontSize: 16, color: colors.darkButton },
  meta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  price: { fontFamily: fonts.heading, fontSize: 26, color: colors.darkButton },
  confidence: { gap: 8, alignItems: 'flex-start' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
    paddingRight: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.successRing,
  },
  chipEmpty: { backgroundColor: colors.closeButton },
  chipText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.confirmedText,
  },
  chipTextEmpty: { color: colors.textSecondary },
  clockRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clockText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.scanned,
    backgroundColor: colors.scanBanner,
  },
  infoText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.warningText,
  },
  stats: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    gap: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  statConfirmed: { backgroundColor: colors.successRing },
  statDisputed: { backgroundColor: colors.scanBanner },
  statNumber: { fontFamily: fonts.heading, fontSize: 22 },
  statLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  done: { alignItems: 'center', gap: 10, paddingTop: 8 },
  doneIconUp: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.positive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneIconDown: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.scanBanner,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: 10, paddingTop: 8 },
  actionsAsk: { paddingTop: 4 },
  button: {
    height: 54,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: { backgroundColor: colors.dark },
  buttonSecondary: { borderWidth: 1.5, borderColor: colors.dark },
  buttonPrimaryText: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    color: colors.onDark,
  },
  buttonSecondaryText: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    color: colors.dark,
  },
  pressed: { opacity: 0.7 },
  link: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  error: { fontFamily: fonts.body, fontSize: 12, color: colors.error },
});
