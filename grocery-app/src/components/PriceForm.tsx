import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Controller, useForm, useFormState, useWatch } from 'react-hook-form';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
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

import { useSubmitPrice } from '../hooks/useSubmitPrice';
import { guessStore } from '../services/storeService';
import {
  GROCERY_UNITS,
  isAuthError,
  splitScannedSize,
  submitErrorMessage,
  unitLabel,
  type GroceryUnit,
} from '../services/submitService';
import { usePickerStore } from '../store/usePickerStore';
import type { RootStackParamList } from '../navigation/types';
import type { ScanPhoto } from '../store/useScanStore';
import { colors, fonts, spacing, typography } from '../theme';
import type { ScanResult } from '../types/scan';
import { formatDistance } from '../utils/format';

type Props = {
  // What OCR read, or null when the user is typing everything in.
  scan: ScanResult | null;
  photo: ScanPhoto | null; // shown as the item thumbnail after a scan
  // "back" (chevron) mid-flow, "close" (X) when it's the first screen of its own.
  leading: 'back' | 'close';
  onLeadingPress: () => void;
  // After a successful submit, with what to show on Price Posted.
  onSubmitted: (
    posted: Omit<RootStackParamList['PricePosted'], 'fromScan'>
  ) => void;
};

type FormValues = {
  itemName: string;
  brand: string;
  // Size is two fields: the number as typed, and a unit picked from the list
  // (the backend's GroceryUnit). Both empty = no size, which is allowed.
  unitAmount: string;
  unit: GroceryUnit | '';
  price: string; // kept as typed; parsed on submit
  sharePublicly: boolean;
};

// What the form starts with. A price OCR wasn't sure about starts blank,
// so the user types it instead of trusting a bad read.
function toFormValues(result: ScanResult | null): FormValues {
  const trustedPrice =
    result && result.status === 'ok' && result.price !== null
      ? result.price.toFixed(2)
      : '';
  return {
    itemName: result?.itemName ?? '',
    brand: result?.brand ?? '',
    // OCR still reads size as one string ("1.5 lb"), so split it to prefill.
    ...scannedSizeFields(result?.unitSize),
    price: trustedPrice,
    sharePublicly: true,
  };
}

function scannedSizeFields(
  unitSize: string | null | undefined
): Pick<FormValues, 'unitAmount' | 'unit'> {
  const { unitAmount, unit } = splitScannedSize(unitSize);
  return {
    unitAmount: unitAmount != null ? String(unitAmount) : '',
    unit: unit ?? '',
  };
}

// "1.5 lb", or '' until both size fields are filled
function sizeText(amount?: string, unit?: GroceryUnit | ''): string {
  return amount?.trim() && unit ? `${amount.trim()} ${unitLabel(unit)}` : '';
}

// - "Confirmed Scan Screen" (scan given): fields OCR filled get a yellow outline
//   and "SCANNED"; fields it couldn't fill get an orange outline.
// - "Submission (Manual) Screen" (scan = null): the same fields, empty.
// Every field is editable in place, so neither needs a separate edit mode.
export function PriceForm({
  scan: result,
  photo,
  leading,
  onLeadingPress,
  onSubmitted,
}: Props) {
  // Snapshot of what OCR read, used to label fields "SCANNED".
  const [scanned] = useState(() => toFormValues(result));
  const fromScan = result !== null;

  const navigation = useNavigation();

  // Store chosen on the Store Picker (see usePickerStore).
  const store = usePickerStore((s) => s.store);
  const storeSource = usePickerStore((s) => s.storeSource);
  const [storeMissing, setStoreMissing] = useState(false);

  // Start with the closest store, unless one is already chosen.
  useEffect(() => {
    let cancelled = false;
    guessStore().then((guess) => {
      const { store: chosen, setStore } = usePickerStore.getState();
      if (!cancelled && guess && !chosen) setStore(guess, 'guess');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Leaving the form (submit, X, back) forgets the store, so the next price
  // starts fresh. The Store Picker opens on top, so it doesn't unmount the form.
  useEffect(() => () => usePickerStore.getState().clear(), []);

  const {
    control,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: toFormValues(result) });

  const values = useWatch({ control });

  // A field is "scanned" while it still holds exactly what OCR read.
  // After a scan, any of the four OCR fields left empty is highlighted
  type OcrField = 'itemName' | 'brand' | 'unitAmount' | 'unit' | 'price';
  const isScanned = (field: OcrField) =>
    fromScan && scanned[field] !== '' && values[field] === scanned[field];
  const needsInput = (field: OcrField) => fromScan && !values[field];

  const sizeMissing = needsInput('unitAmount') || needsInput('unit');
  const itemMissing =
    needsInput('itemName') || needsInput('brand') || sizeMissing;
  const itemScanned = !itemMissing && isScanned('itemName');

  // Start with the item fields open when there's something to fill in.
  const [editingItem, setEditingItem] = useState(
    () =>
      !result?.itemName || !result.brand || !scanned.unitAmount || !scanned.unit
  );

  const openStorePicker = () => {
    setStoreMissing(false);
    navigation.navigate('StorePicker');
  };

  // Jump straight to the empty price when that's the only thing missing.
  useEffect(() => {
    if (result?.itemName && !scanned.price) {
      const timer = setTimeout(() => setFocus('price'), 400);
      return () => clearTimeout(timer);
    }
  }, [result, scanned.price, setFocus]);

  const submit = useSubmitPrice();
  // Why the last submit failed, shown above the button. Nothing was saved
  // then, and every field keeps what the user typed so they can retry.
  const [submitError, setSubmitError] = useState<{
    message: string;
    needsLogin: boolean;
  } | null>(null);

  const onSubmit = handleSubmit(async (form) => {
    setSubmitError(null);
    if (!store) {
      setStoreMissing(true);
      return;
    }

    let saved;
    try {
      // Mock store ids ("store-key-food") need replacing with real ones
      // before EXPO_PUBLIC_USE_MOCK_SUBMIT=false can work.
      saved = await submit.mutateAsync({
        itemName: form.itemName,
        brand: form.brand,
        unitAmount: form.unitAmount.trim() ? Number(form.unitAmount) : null,
        unit: form.unit || null,
        storeId: store.id,
        price: Number(form.price),
        isPublic: form.sharePublicly,
      });
    } catch (error) {
      setSubmitError({
        message: submitErrorMessage(error),
        needsLogin: isAuthError(error),
      });
      return;
    }

    onSubmitted({
      itemId: saved.itemId || null,
      itemName: form.itemName.trim(),
      brand: form.brand.trim() || null,
      unitSize: sizeText(form.unitAmount, form.unit) || null,
      storeName: store.name,
      price: saved.price,
      isPublic: saved.isPublic,
    });
  });

  const size = sizeText(values.unitAmount, values.unit);
  const brandSize = [values.brand, size].filter(Boolean).join(' · ');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={onLeadingPress}
            accessibilityRole="button"
            accessibilityLabel={leading === 'back' ? 'Go back' : 'Close'}
            hitSlop={8}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Feather
              name={leading === 'back' ? 'chevron-left' : 'x'}
              size={24}
              color={colors.text}
            />
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

          <Text style={fromScan ? styles.heading : styles.manualHeading}>
            {fromScan ? 'Almost done' : 'Help others save nearby'}
          </Text>
          <Text style={fromScan ? styles.subheading : styles.manualSubheading}>
            {fromScan
              ? 'Tap any field to fix what we got wrong.'
              : 'Your price posts to the community right away.'}
          </Text>

          {/* Item */}
          <FieldLabel
            label="Item"
            scanned={itemScanned}
            missing={itemMissing}
          />
          <View
            style={[
              styles.card,
              styles.itemCard,
              outline(itemScanned, itemMissing),
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
                {fromScan ? (
                  // After a scan, say which of brand / size is still missing.
                  <Text style={styles.itemMeta} numberOfLines={1}>
                    <MetaPart value={values.brand} missingLabel="Add brand" />
                    {' · '}
                    <MetaPart value={size} missingLabel="Add size" />
                  </Text>
                ) : brandSize ? (
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
                  missing={needsInput('itemName')}
                  rules={{ validate: (v) => !!v.trim() || 'Add the item name' }}
                />
                <InlineField
                  control={control}
                  name="brand"
                  label="Brand"
                  placeholder="Perdue (optional)"
                  missing={needsInput('brand')}
                />
                <SizeFields
                  control={control}
                  amountMissing={needsInput('unitAmount')}
                  unitMissing={needsInput('unit')}
                />
              </View>
            )}
          </View>
          {errors.itemName && <ErrorText message={errors.itemName.message} />}

          {/* Store */}
          <FieldLabel label="Store" />
          <Pressable
            onPress={openStorePicker}
            accessibilityRole="button"
            accessibilityLabel={
              store
                ? `Store: ${storeLine(store)}. Change store`
                : 'Choose a store'
            }
            style={({ pressed }) => [
              styles.card,
              styles.storeCard,
              storeMissing && styles.cardError,
              pressed && styles.pressed,
            ]}
          >
            <Feather name="map-pin" size={15} color={colors.text} />
            <Text
              style={[styles.storeText, !store && styles.placeholder]}
              numberOfLines={1}
            >
              {store ? storeLine(store) : 'Choose a store'}
            </Text>
            <Feather name="chevron-right" size={15} color={colors.text} />
          </Pressable>
          {storeMissing && <ErrorText message="Choose the store" />}
          {/* Only after a scan, per Figma; the manual frame has no hint. */}
          {store && fromScan && storeSource === 'guess' && (
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
                {size ? <Text style={styles.perText}>per {size}</Text> : null}
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
                  <View style={styles.shareTitleRow}>
                    <Text style={styles.shareTitle}>Share Publicly</Text>
                    <Switch
                      style={styles.shareSwitch}
                      value={field.value}
                      onValueChange={field.onChange}
                      accessibilityLabel="Share publicly"
                      trackColor={{ true: '#34C759', false: colors.card }}
                    />
                  </View>
                  <Text style={styles.shareSubtitle}>
                    Visible to everyone nearby
                  </Text>
                </View>
              </View>
            )}
          />
        </ScrollView>

        <View style={styles.footer}>
          {submitError && (
            <View style={styles.submitError} accessibilityLiveRegion="polite">
              <Feather name="alert-circle" size={15} color={colors.error} />
              <Text style={styles.submitErrorText}>
                {submitError.message}
                {submitError.needsLogin && (
                  <Text
                    style={styles.submitErrorLink}
                    accessibilityRole="link"
                    onPress={() =>
                      navigation.navigate('Login', { then: 'back' })
                    }
                  >
                    {' '}
                    Log in
                  </Text>
                )}
              </Text>
            </View>
          )}
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

// "Key Food · 0.4 mi", or just "Key Food" when the distance is unknown.
function storeLine(store: { name: string; distanceMi?: number }): string {
  return store.distanceMi != null
    ? `${store.name} · ${formatDistance(store.distanceMi)}`
    : store.name;
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
  missing,
  rules,
}: {
  control: ReturnType<typeof useForm<FormValues>>['control'];
  name: 'itemName' | 'brand';
  label: string;
  placeholder: string;
  missing: boolean; // OCR left it empty: orange outline
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
            style={[styles.inlineInput, missing && styles.inlineInputMissing]}
          />
        </View>
      )}
    />
  );
}

// Size as two fields on one row: a short amount box, then a unit dropdown,
// so the unit always matches a backend GroceryUnit.
// Both are optional, but filling one means filling the other.
function SizeFields({
  control,
  amountMissing,
  unitMissing,
}: {
  control: ReturnType<typeof useForm<FormValues>>['control'];
  amountMissing: boolean; // OCR left it empty: orange outline
  unitMissing: boolean;
}) {
  const [unitMenuOpen, setUnitMenuOpen] = useState(false);
  const { errors } = useFormState({ control, name: ['unitAmount', 'unit'] });

  return (
    <View style={styles.inlineField}>
      <Text style={styles.inlineLabel}>Size (optional)</Text>
      <View style={styles.sizeRow}>
        <Controller
          control={control}
          name="unitAmount"
          rules={{
            deps: ['unit'],
            validate: (v, form) => {
              if (!v.trim()) return form.unit ? 'Add the amount, like 1.5' : true;
              const n = Number(v);
              if (!Number.isFinite(n) || n <= 0) return 'Enter a size above 0';
              return true;
            },
          }}
          render={({ field }) => (
            <TextInput
              ref={field.ref}
              value={field.value}
              onChangeText={(text) =>
                field.onChange(text.replace(/[^0-9.]/g, ''))
              }
              onBlur={field.onBlur}
              placeholder="1.5"
              placeholderTextColor={colors.placeholder}
              keyboardType="decimal-pad"
              accessibilityLabel="Size amount"
              style={[
                styles.inlineInput,
                styles.amountInput,
                (amountMissing || !!errors.unitAmount) && styles.inlineInputMissing,
              ]}
            />
          )}
        />
        <Controller
          control={control}
          name="unit"
          rules={{
            deps: ['unitAmount'],
            validate: (v, form) =>
              !form.unitAmount.trim() || !!v || 'Pick a unit',
          }}
          render={({ field }) => (
            <>
              <Pressable
                onPress={() => setUnitMenuOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Size unit"
                accessibilityState={{ expanded: unitMenuOpen }}
                style={[
                  styles.inlineInput,
                  styles.unitButton,
                  (unitMissing || !!errors.unit) && styles.inlineInputMissing,
                ]}
              >
                <Text
                  style={[
                    styles.unitButtonText,
                    !field.value && styles.placeholder,
                  ]}
                  numberOfLines={1}
                >
                  {field.value ? unitLabel(field.value) : 'unit'}
                </Text>
                <Feather
                  name="chevron-down"
                  size={16}
                  color={colors.textSecondary}
                />
              </Pressable>
              <Modal
                visible={unitMenuOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setUnitMenuOpen(false)}
              >
                <View style={styles.unitMenuBackdrop}>
                  <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={() => setUnitMenuOpen(false)}
                    accessibilityLabel="Close unit menu"
                  />
                  <View style={styles.unitMenu}>
                    <ScrollView
                      style={styles.unitMenuList}
                      keyboardShouldPersistTaps="handled"
                    >
                      {GROCERY_UNITS.map((u) => {
                        const selected = field.value === u.value;
                        return (
                          <Pressable
                            key={u.value}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            accessibilityHint={
                              selected
                                ? 'Clears the unit'
                                : undefined
                            }
                            onPress={() => {
                              // Tapping the selected unit again clears it.
                              field.onChange(selected ? '' : u.value);
                              setUnitMenuOpen(false);
                            }}
                            style={[
                              styles.unitOption,
                              selected && styles.unitOptionSelected,
                            ]}
                          >
                            <Text style={styles.unitOptionText}>{u.label}</Text>
                            {selected ? (
                              <Feather
                                name="check"
                                size={16}
                                color={colors.change}
                              />
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>
              </Modal>
            </>
          )}
        />
      </View>
      {typeof errors.unitAmount?.message === 'string' && (
        <ErrorText message={errors.unitAmount.message} />
      )}
      {typeof errors.unit?.message === 'string' && (
        <ErrorText message={errors.unit.message} />
      )}
    </View>
  );
}

// One half of "Perdue · 1.5 lb", or an orange "Add brand" when OCR missed it.
function MetaPart({
  value,
  missingLabel,
}: {
  value?: string;
  missingLabel: string;
}) {
  if (value) return <Text>{value}</Text>;
  return <Text style={styles.metaMissing}>{missingLabel}</Text>;
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
  // Manual frame: bigger, centered heading.
  manualHeading: {
    fontFamily: fonts.heading,
    fontSize: 24,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  manualSubheading: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
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
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  inlineInputMissing: { borderColor: colors.needsInput },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  amountInput: { width: 72, flexShrink: 0, textAlign: 'center' },
  unitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  unitButtonText: {
    flex: 1,
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
    color: colors.text,
  },
  unitMenuBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 48,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  unitMenu: {
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.pickerRowBorder,
    overflow: 'hidden',
  },
  unitMenuList: { maxHeight: 280 },
  unitOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  unitOptionSelected: { backgroundColor: colors.pickerSelected },
  unitOptionText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
    color: colors.text,
  },
  metaMissing: { color: colors.needsInput, fontFamily: fonts.bodyMedium },
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
    minHeight: 54,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  shareText: { flex: 1 },
  shareTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shareSwitch: { alignSelf: 'center' },
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
  submitError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    alignSelf: 'stretch',
    marginBottom: spacing.sm,
  },
  submitErrorText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.error,
  },
  submitErrorLink: {
    fontFamily: fonts.bodyBold,
    textDecorationLine: 'underline',
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
