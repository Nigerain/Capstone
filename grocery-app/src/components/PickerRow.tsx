import { Feather } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../theme';
import { Bone, Skeleton } from './Skeleton';

type Props = {
  title: string;
  subtitle?: string | null;
  selected: boolean;
  onPress: () => void;
  // Store rows show a map pin in a circle; item rows show a product thumbnail;
  // plain option rows (like the search radius) show nothing.
  lead: { kind: 'store' } | { kind: 'thumb'; imageUri?: string } | { kind: 'none' };
};

// Figma component "Picker Row": one selectable row on the Store Picker and
// Item Picker. Selected rows get a yellow outline and a green check.
export function PickerRow({ title, subtitle, selected, onPress, lead }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && styles.pressed,
      ]}
    >
      {lead.kind === 'store' ? (
        <View style={styles.storeLead}>
          <Feather name="map-pin" size={20} color={colors.text} />
        </View>
      ) : lead.kind === 'none' ? null : lead.imageUri ? (
        <Image source={{ uri: lead.imageUri }} style={styles.thumb} />
      ) : (
        <View style={styles.thumb} />
      )}

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {selected ? (
        <View style={[styles.radio, styles.radioOn]}>
          <Feather name="check" size={14} color={colors.onDark} />
        </View>
      ) : (
        <View style={[styles.radio, styles.radioOff]} />
      )}
    </Pressable>
  );
}

const LEAD_SIZE = 44;
const RADIO_SIZE = 24;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 12,
    paddingRight: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.pickerRowBorder,
    backgroundColor: colors.pickerRow,
  },
  rowSelected: {
    borderWidth: 1.5,
    borderColor: colors.scanned,
    backgroundColor: colors.pickerSelected,
    // Keeps the row the same size when the border gets thicker.
    paddingLeft: 11.5,
    paddingRight: 13.5,
    paddingVertical: 9.5,
  },
  pressed: { opacity: 0.7 },
  storeLead: {
    width: LEAD_SIZE,
    height: LEAD_SIZE,
    borderRadius: LEAD_SIZE / 2,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    width: LEAD_SIZE,
    height: LEAD_SIZE,
    borderRadius: 10,
    backgroundColor: colors.card,
  },
  info: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.semibold, fontSize: 15, color: colors.darkButton },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  radio: {
    width: RADIO_SIZE,
    height: RADIO_SIZE,
    borderRadius: RADIO_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: colors.positive },
  radioOff: { borderWidth: 1.5, borderColor: colors.radioBorder },
});

// Gray stand-ins for picker rows while the list loads.
export function PickerRowsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <Skeleton style={skeletonStyles.list}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.row}>
          <Bone width={LEAD_SIZE} height={LEAD_SIZE} rounded={10} />
          <View style={styles.info}>
            <Bone width={i % 2 ? '55%' : '70%'} height={14} />
            <Bone width="40%" height={11} />
          </View>
          <View style={[styles.radio, styles.radioOff]} />
        </View>
      ))}
    </Skeleton>
  );
}

const skeletonStyles = StyleSheet.create({
  list: { gap: 12 },
});
