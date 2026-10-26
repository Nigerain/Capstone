import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../navigation/types';
import { useScanStore } from '../store/useScanStore';
import { colors, fonts, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanReview'>;

// TEMPORARY: shows the cropped photo so we can check the crop on a real phone.
// Replace with the OCR loading state + "Choose a Tag" / "Confirmed Scan" screens
// once the backend OCR endpoint is connected.
export function ScanReviewScreen({ navigation }: Props) {
  const photo = useScanStore((s) => s.photo);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Pressable
        onPress={() => navigation.popToTop()}
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={8}
        style={styles.close}
      >
        <Feather name="x" size={24} color={colors.text} />
      </Pressable>

      <View style={styles.body}>
        <Text style={typography.heading}>Photo captured</Text>
        <Text style={typography.subtitle}>
          Reading the tag is coming soon. This is what will be sent for OCR.
        </Text>

        {photo ? (
          <>
            <Image
              source={{ uri: photo.uri }}
              style={[
                styles.photo,
                { aspectRatio: photo.width / photo.height },
              ]}
              resizeMode="contain"
              accessibilityLabel="Cropped photo of the price tag"
            />
            <Text style={styles.meta}>
              {photo.width} × {photo.height} px · from {photo.source}
            </Text>
          </>
        ) : (
          <Text style={typography.subtitle}>No photo yet.</Text>
        )}

        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Feather name="rotate-ccw" size={18} color={colors.onDark} />
          <Text style={styles.buttonText}>Retake</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  close: { margin: spacing.xl, alignSelf: 'flex-start' },
  body: { paddingHorizontal: spacing.gutter, gap: spacing.md },
  photo: { width: '100%', borderRadius: 12, backgroundColor: colors.card },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dark,
    borderRadius: 24,
    paddingVertical: 14,
    marginTop: spacing.sm,
  },
  buttonText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 16,
    color: colors.onDark,
  },
  pressed: { opacity: 0.7 },
});
