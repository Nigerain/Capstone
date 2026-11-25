import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  priceStatus,
  timeAgo,
  type MyPrice,
  type PriceStatusKind,
} from '../services/activityService';
import { colors, fonts } from '../theme';
import { formatPrice } from '../utils/format';

// Status colors from the Figma frame "Activity Tab – v2".
const STATUS_COLORS: Record<
  PriceStatusKind,
  { text: string; iconBg: string; icon: string }
> = {
  confirmed: {
    text: colors.positive,
    iconBg: colors.successRing,
    icon: colors.confirmedText,
  },
  waiting: {
    text: colors.warningText,
    iconBg: colors.scanBanner,
    icon: colors.warningText,
  },
  incorrect: {
    text: colors.incorrectText,
    iconBg: colors.incorrectBg,
    icon: colors.incorrectText,
  },
};

type Props = {
  price: MyPrice;
  onPress?: () => void; // left out when there's no item page to open
};

// One price the user posted: item, store, how voters responded, price, age.
export function ActivityRow({ price, onPress }: Props) {
  const status = priceStatus(price);
  const tint = STATUS_COLORS[status.kind];
  const amount = formatPrice(price.price);
  const age = timeAgo(price.submittedAt);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${price.itemName} at ${price.storeName}, ${amount}, ${status.text}, posted ${age}`}
      accessibilityHint={onPress ? 'Opens the product page' : undefined}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.icon, { backgroundColor: tint.iconBg }]}>
        <Feather name="tag" size={18} color={tint.icon} />
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {price.itemName}
        </Text>
        <Text style={styles.detail} numberOfLines={1}>
          {price.storeName}
        </Text>
        <Text style={[styles.status, { color: tint.text }]} numberOfLines={1}>
          {status.text}
        </Text>
      </View>

      <View style={styles.right}>
        <Text style={styles.price}>{amount}</Text>
        <Text style={styles.time}>{age}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.pickerRowBorder,
    backgroundColor: colors.pickerRow,
  },
  pressed: { opacity: 0.7 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.semibold, fontSize: 14, color: colors.darkButton },
  detail: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  status: { fontFamily: fonts.semibold, fontSize: 11 },
  right: { alignItems: 'flex-end', gap: 2 },
  price: { fontFamily: fonts.semibold, fontSize: 14, color: colors.darkButton },
  time: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
  },
});
