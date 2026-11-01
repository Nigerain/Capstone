import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../navigation/types';
import { guessStore } from '../services/scanService';
import { useScanStore } from '../store/useScanStore';
import { colors, fonts, spacing, typography } from '../theme';
import type { GuessedStore, ScanResult } from '../types/scan';
import { formatDistance } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanConfirm'>;

type FormValues = {
  itemName: string;
  brand: string;
  unitSize: string;
  price: string; // kept as typed; parsed on submit
  sharePublicly: boolean;
};

// What the form starts with. A price OCR wasn't sure about starts blank,
// so the user types it instead of trusting a bad read.
function toFormValues(result: ScanResult | null): FormValues {
  const trustedPrice =
    result && !result.needsManualPrice && result.price !== null
      ? result.price.toFixed(2)
      : '';
  return {
    itemName: result?.itemName ?? '',
    brand: result?.brand ?? '',
    unitSize: result?.unitSize ?? '',
    price: trustedPrice,
    sharePublicly: true,
  };
}

// Built from the Figma frame "Confirmed Scan Screen".
// After a scan: fields OCR filled get a yellow outline and "SCANNED"; fields it
// couldn't fill get an orange outline. Every field is editable right here, so
// there's no separate "enter manually" path. Opened from "Enter manually" on
// the Couldn't Read screen, it's the same form, empty.
export function ScanConfirmScreen({ navigation }: Props) {
  const photo = useScanStore((s) => s.photo);
  const result = useScanStore((s) => s.result);
  const clearScan = useScanStore((s) => s.clear);

  // Snapshot of what OCR read, used to label fields "SCANNED".
  const [scanned] = useState(() => toFormValues(result));
  const fromScan = result !== null;

  const [store, setStore] = useState<GuessedStore | null>(null);
  useEffect(() => {
    guessStore().then(setStore);
  }, []);

  const {
    control,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: toFormValues(result) });

  const values = useWatch({ control });
  const [editingItem, setEditingItem] = useState(() => !result?.itemName);

  // A field is "scanned" while it still holds exactly what OCR read.
  const isScanned = (field: 'itemName' | 'price') =>
    fromScan && scanned[field] !== '' && values[field] === scanned[field];
  const needsInput = (field: 'itemName' | 'price') =>
    fromScan && !values[field];

  // Jump straight to the empty price when that's the only thing missing.
  useEffect(() => {
    if (result?.itemName && !scanned.price) {
      const timer = setTimeout(() => setFocus('price'), 400);
      return () => clearTimeout(timer);
    }
  }, [result, scanned.price, setFocus]);

  const onSubmit = handleSubmit(async () => {
    // TODO(backend): POST /api/v1/prices once the form has an item id and a
    // store id (needs the Item Picker and Store Picker).
    await new Promise((resolve) => setTimeout(resolve, 600));
    Alert.alert(
      'Price ready',
      'Submitting isn’t connected to the backend yet, so nothing was saved.',
      [
        {
          text: 'OK',
          onPress: () => {
            clearScan();
            navigation.popToTop();
          },
        },
      ]
    );
  });

  const brandSize = [values.brand, values.unitSize].filter(Boolean).join(' · ');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Feather name="chevron-left" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle} accessibilityRole="header">
            {fromScan ? 'Confirm Details' : 'Add a Price'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {fromScan && (
            <View style={styles.banner}>
              <Feather name="camera" size={18} color={colors.scanBannerText} />
              <Text style={styles.bannerText}>
                Scanned from your photo, please check everything below before
                submitting.
              </Text>
            </View>
          )}

          <Text style={styles.heading}>
            {fromScan ? 'Almost done' : 'Support others save nearby'}
          </Text>
          <Text style={styles.subheading}>
            {fromScan
              ? 'Tap any field to fix what we got wrong.'
              : 'Your price posts to the community right away.'}
          </Text>

          {/* Item */}
          <FieldLabel
            label="Item"
            scanned={isScanned('itemName')}
            missing={needsInput('itemName')}
          />
          <View
            style={[
              styles.card,
              styles.itemCard,
              outline(isScanned('itemName'), needsInput('itemName')),
              errors.itemName && styles.cardError,
            ]}
          >
            <Pressable
              onPress={() => setEditingItem((on) => !on)}
              accessibilityRole="button"
              accessibilityLabel={
                values.itemName
                  ? `Item: ${values.itemName}${brandSize ? `, ${brandSize}` : ''}. Change`
                  : 'Add the item'
              }
              style={styles.itemRow}
            >
              {photo && fromScan ? (
                <Image source={{ uri: photo.uri }} style={styles.thumb} />
              ) : (
                <View style={styles.thumb} />
              )}
              <View style={styles.itemText}>
                <Text
                  style={[
                    styles.itemName,
                    !values.itemName && styles.placeholder,
                  ]}
                  numberOfLines={1}
                >
                  {values.itemName || 'Add the item name'}
                </Text>
                {brandSize ? (
                  <Text style={styles.itemMeta} numberOfLines={1}>
                    {brandSize}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.changeText}>
                {editingItem ? 'Done' : 'Change'}
              </Text>
            </Pressable>

            {editingItem && (
              <View style={styles.itemFields}>
                <InlineField
                  control={control}
                  name="itemName"
                  label="Item name"
                  placeholder="Chicken Breast, Boneless"
                  rules={{ validate: (v) => !!v.trim() || 'Add the item name' }}
                />
                <InlineField
                  control={control}
                  name="brand"
                  label="Brand"
                  placeholder="Perdue (optional)"
                />
                <InlineField
                  control={control}
                  name="unitSize"
                  label="Size"
                  placeholder="1.5 lb (optional)"
                />
              </View>
            )}
          </View>
          {errors.itemName && <ErrorText message={errors.itemName.message} />}

          {/* Store */}
          <FieldLabel label="Store" />
          <Pressable
            // TODO: open the Store Picker screen (Figma "Store Picker") once it's built.
            onPress={() =>
              Alert.alert(
                'Coming soon',
                'Picking a different store isn’t built yet.'
              )
            }
            accessibilityRole="button"
            accessibilityLabel={
              store
                ? `Store: ${store.name}, ${formatDistance(store.distanceMi)}. Change store`
                : 'Choose a store'
            }
            style={({ pressed }) => [
              styles.card,
              styles.storeCard,
              pressed && styles.pressed,
            ]}
          >
            <Feather name="map-pin" size={15} color={colors.text} />
            <Text style={styles.storeText} numberOfLines={1}>
              {store
                ? `${store.name} · ${formatDistance(store.distanceMi)}`
                : 'Choose a store'}
            </Text>
            <Feather name="chevron-right" size={15} color={colors.text} />
          </Pressable>
          {store && (
            <Text style={styles.hint}>
              Guessed from your location — change if this isn’t right.
            </Text>
          )}

          {/* Price */}
          <FieldLabel
            label="Price"
            scanned={isScanned('price')}
            missing={needsInput('price')}
          />
          <Controller
            control={control}
            name="price"
            rules={{
              validate: (v) => {
                const n = Number(v);
                if (!v.trim()) return 'Enter the price, like 5.29';
                if (!Number.isFinite(n) || n <= 0 || n > 1000)
                  return 'That doesn’t look like a price';
                return true;
              },
            }}
            render={({ field }) => (
              <View
                style={[
                  styles.card,
                  styles.priceCard,
                  outline(isScanned('price'), needsInput('price')),
                  errors.price && styles.cardError,
                ]}
              >
                <Text style={styles.priceText}>$</Text>
                <TextInput
                  ref={field.ref}
                  value={field.value}
                  onChangeText={(text) =>
                    field.onChange(text.replace(/[^0-9.]/g, ''))
                  }
                  onBlur={field.onBlur}
                  placeholder="0.00"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  accessibilityLabel="Price in dollars"
                  style={[styles.priceText, styles.priceInput]}
                />
                {values.unitSize ? (
                  <Text style={styles.perText}>per {values.unitSize}</Text>
                ) : null}
              </View>
            )}
          />
          {errors.price && <ErrorText message={errors.price.message} />}

          {/* Share publicly */}
          <Controller
            control={control}
            name="sharePublicly"
            render={({ field }) => (
              <View style={[styles.card, styles.shareCard]}>
                <View style={styles.shareText}>
                  <Text style={styles.shareTitle}>Share Publicly</Text>
                  <Text style={styles.shareSubtitle}>
                    Visible to everyone nearby
                  </Text>
                </View>
                <Switch
                  value={field.value}
                  onValueChange={field.onChange}
                  accessibilityLabel="Share publicly"
                  trackColor={{ true: colors.positive, false: colors.card }}
                />
              </View>
            )}
          />
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={() => onSubmit()}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityState={{ busy: isSubmitting, disabled: isSubmitting }}
            style={({ pressed }) => [styles.submit, pressed && styles.pressed]}
          >
            {isSubmitting ? (
              <ActivityIndicator
                color={colors.onDark}
                accessibilityLabel="Submitting"
              />
            ) : (
              <Text style={styles.submitText}>
                {fromScan ? 'Looks Good, Submit' : 'Submit Price'}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function outline(scanned: boolean, missing: boolean): StyleProp<ViewStyle> {
  if (scanned) return styles.cardScanned;
  if (missing) return styles.cardMissing;
  return null;
}

function FieldLabel({
  label,
  scanned,
  missing,
}: {
  label: string;
  scanned?: boolean;
  missing?: boolean;
}) {
  return (
    <View style={styles.labelRow}>
      <Text style={typography.label}>{label}</Text>
      {scanned && <Text style={styles.badge}>SCANNED</Text>}
      {missing && (
        <Text style={[styles.badge, styles.badgeMissing]}>ADD THIS</Text>
      )}
    </View>
  );
}

function InlineField({
  control,
  name,
  label,
  placeholder,
  rules,
}: {
  control: ReturnType<typeof useForm<FormValues>>['control'];
  name: 'itemName' | 'brand' | 'unitSize';
  label: string;
  placeholder: string;
  rules?: { validate: (value: string) => true | string };
}) {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field }) => (
        <View style={styles.inlineField}>
          <Text style={styles.inlineLabel}>{label}</Text>
          <TextInput
            ref={field.ref}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={placeholder}
            placeholderTextColor={colors.placeholder}
            accessibilityLabel={label}
            autoCapitalize="words"
            style={styles.inlineInput}
          />
        </View>
      )}
    />
  );
}

function ErrorText({ message }: { message?: string }) {
  return (
    <Text style={styles.error} accessibilityLiveRegion="polite">
      {message}
    </Text>
  );
}

const ROUND_SIZE = 47;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 25,
    paddingTop: spacing.sm,
  },
  backButton: {
    width: ROUND_SIZE,
    height: ROUND_SIZE,
    borderRadius: ROUND_SIZE / 2,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: ROUND_SIZE },
  headerTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.text },
  content: { paddingHorizontal: 31, paddingTop: 20, paddingBottom: spacing.xl },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.scanBanner,
    borderRadius: 18,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: 22,
  },
  bannerText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.scanBannerText,
  },
  heading: { fontFamily: fonts.heading, fontSize: 20, color: colors.text },
  subheading: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  badge: {
    fontFamily: fonts.bodySemibold,
    fontSize: 8,
    letterSpacing: 0.4,
    color: colors.scannedBadge,
  },
  badgeMissing: { color: colors.needsInput },
  card: {
    backgroundColor: colors.imageBox,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardScanned: { borderColor: colors.scanned },
  cardMissing: { borderColor: colors.needsInput },
  cardError: { borderColor: colors.error },
  itemCard: { paddingHorizontal: spacing.md },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 50,
  },
  thumb: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: colors.card,
  },
  itemText: { flex: 1, gap: 1 },
  itemName: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    color: colors.text,
  },
  placeholder: { color: colors.placeholder },
  itemMeta: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textSecondary,
  },
  changeText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    color: colors.change,
  },
  itemFields: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  inlineField: { gap: 2 },
  inlineLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: colors.textSecondary,
  },
  inlineInput: {
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  storeText: {
    flex: 1,
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    color: colors.text,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
  priceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.md,
  },
  priceText: { fontFamily: fonts.badge, fontSize: 24, color: colors.text },
  priceInput: { flex: 1, paddingVertical: 0, marginLeft: 2 },
  perText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: colors.textSecondary,
  },
  shareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  shareText: { flex: 1 },
  shareTitle: {
    fontFamily: fonts.headingSemibold,
    fontSize: 15,
    color: colors.text,
  },
  shareSubtitle: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textSecondary,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.error,
    marginTop: spacing.xs,
  },
  footer: {
    paddingHorizontal: 31,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  submit: {
    alignSelf: 'stretch',
    height: 54,
    borderRadius: 30,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 18,
    color: colors.field,
  },
  pressed: { opacity: 0.7 },
});
