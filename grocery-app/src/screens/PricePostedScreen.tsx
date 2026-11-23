import { Feather } from '@expo/vector-icons';
import { CommonActions, type NavigationProp } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../navigation/types';
import { useScanStore } from '../store/useScanStore';
import { colors, fonts, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PricePosted'>;

const CLOSE_SIZE = 47;

/**
 * Swaps the whole Add a Price flow (entry, camera, form...) for this screen,
 * so closing it lands back on the tabs instead of the form. Keeps the tabs'
 * own state, so the user returns to the tab they were on.
 */
export function showPricePosted(
  navigation: NavigationProp<RootStackParamList>,
  params: RootStackParamList['PricePosted']
) {
  navigation.dispatch((state) =>
    CommonActions.reset({
      ...state,
      index: 1,
      routes: [state.routes[0], { name: 'PricePosted', params }],
    })
  );
}

// Built from the Figma frame "Submission – Price Posted".
// Left out for now: the "+5 reputation" chip (the reputation system is still
// tentative and the backend doesn't send points).
export function PricePostedScreen({ navigation, route }: Props) {
  const {
    itemId,
    itemName,
    brand,
    unitSize,
    storeName,
    price,
    isPublic,
    fromScan,
  } = route.params;

  // The scan photo is only for the thumbnail here; forget it on the way out.
  const photo = useScanStore((s) => s.photo);
  useEffect(() => () => useScanStore.getState().clear(), []);

  const meta = [brand, unitSize, storeName].filter(Boolean).join(' · ');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.popToTop()}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.pressed,
          ]}
        >
          <Feather name="x" size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.checkRing}>
          <View style={styles.checkCircle}>
            <Feather name="check" size={40} color={colors.onDark} />
          </View>
        </View>

        <Text style={styles.title} accessibilityRole="header">
          {isPublic ? 'Price posted!' : 'Price saved!'}
        </Text>
        <Text style={styles.subtitle}>
          {isPublic
            ? 'Thanks for helping shoppers near you save.'
            : 'It’s private, so only you can see it.'}
        </Text>

        <View
          style={styles.summary}
          accessible
          accessibilityLabel={`${itemName}${meta ? `, ${meta}` : ''}, $${price.toFixed(2)}`}
        >
          {fromScan && photo ? (
            <Image source={{ uri: photo.uri }} style={styles.thumb} />
          ) : (
            <View style={styles.thumb} />
          )}
          <View style={styles.summaryText}>
            <Text style={styles.itemName} numberOfLines={2}>
              {itemName}
            </Text>
            {meta ? (
              <Text style={styles.meta} numberOfLines={1}>
                {meta}
              </Text>
            ) : null}
          </View>
          <Text style={styles.price}>${price.toFixed(2)}</Text>
        </View>

        {isPublic && (
          <Text style={styles.note}>
            Other shoppers can now confirm it. You can follow its votes in
            Activity.
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => navigation.replace('AddPrice')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>Add another price</Text>
        </Pressable>
        {/* Needs the item's id from the backend; hidden when there isn't one. */}
        {itemId ? (
          <Pressable
            onPress={() => navigation.replace('ProductDetail', { itemId })}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.secondary,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryText}>View item</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 21, paddingTop: spacing.sm },
  closeButton: {
    width: CLOSE_SIZE,
    height: CLOSE_SIZE,
    borderRadius: CLOSE_SIZE / 2,
    backgroundColor: colors.closeButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 76,
    gap: 14,
  },
  checkRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.successRing,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.positive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.headingSemibold,
    fontSize: 28,
    color: colors.darkButton,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    // Figma's 6 pt spacer before the card, on top of the 14 pt gap.
    marginBottom: 6,
  },
  summary: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.pickerRowBorder,
    backgroundColor: colors.pickerRow,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.card,
  },
  summaryText: { flex: 1, gap: 2 },
  itemName: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.darkButton,
  },
  meta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  price: {
    fontFamily: fonts.heading,
    fontSize: 22,
    color: colors.darkButton,
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actions: {
    paddingHorizontal: 31,
    paddingBottom: spacing.md,
    gap: 10,
  },
  primary: {
    height: 54,
    borderRadius: 30,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    color: colors.onDark,
  },
  secondary: {
    height: 54,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    color: colors.dark,
  },
  pressed: { opacity: 0.7 },
});
