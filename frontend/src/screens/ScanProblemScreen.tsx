import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../navigation/types';
import { useScanStore } from '../store/useScanStore';
import { colors, fonts, spacing } from '../theme';
import type { ScanProblem } from '../types/scan';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanProblem'>;

type FeatherName = ComponentProps<typeof Feather>['name'];

type Copy = {
  icon: FeatherName;
  title: string;
  message: string;
  tips: boolean;
  primary: 'retake' | 'retry' | 'manual' | 'signin';
  link: string | null; // the small text link under the button
  devHint?: string; // extra line shown only in development builds
};

// "unreadable" is the Figma frame "Scan – Couldn't Read". The others reuse its
// layout with their own words (not in Figma yet).
const COPY: Record<ScanProblem, Copy> = {
  unreadable: {
    icon: 'camera-off',
    title: 'Couldn’t read that tag',
    message: 'The photo may be blurry, too dark, or the price was cut off.',
    tips: true,
    primary: 'retake',
    link: 'Enter manually instead',
  },
  price: {
    icon: 'dollar-sign',
    title: 'Couldn’t read the price',
    message:
      'We got the item details, but not the price. Retake the photo or type the price in.',
    tips: true,
    primary: 'retake',
    link: 'Type the price in',
  },
  network: {
    icon: 'wifi-off',
    title: 'Couldn’t reach the server',
    message: 'Check your connection and try again. Your photo is still here.',
    tips: false,
    primary: 'retry',
    link: 'Enter manually instead',
  },
  server: {
    icon: 'alert-circle',
    title: 'Something went wrong',
    message:
      'We couldn’t read the tag this time. Please try again in a moment.',
    tips: false,
    primary: 'retry',
    link: 'Enter manually instead',
  },
  limit: {
    icon: 'clock',
    title: 'You’ve used today’s scans',
    message:
      'You can scan 10 tags a day. Scans reset tomorrow, and you can still type prices in.',
    tips: false,
    primary: 'manual',
    link: null,
  },
  auth: {
    icon: 'lock',
    title: 'Sign in to keep scanning',
    message:
      'You need to be signed in to add prices. Sign in and you’ll be right back here.',
    tips: false,
    primary: 'signin',
    link: null,
    // Until Firebase Auth is connected, this almost always means the dev token
    // in .env expired (they last about an hour).
    devHint:
      'Dev: your test token probably expired. Run npm run dev-token, then restart with npx expo start -c.',
  },
};

const PRIMARY_LABEL = {
  retake: 'Retake Photo',
  retry: 'Try Again',
  manual: 'Enter Manually',
  signin: 'Sign In',
} as const;

const TIPS = [
  'Hold your phone steady, then tap to focus',
  'Fit the whole tag inside the frame',
  'Turn on the flash in dim aisles',
];

export function ScanProblemScreen({ navigation, route }: Props) {
  const { problem } = route.params;
  const copy = COPY[problem];
  const setResult = useScanStore((s) => s.setResult);

  // "price": Confirm Details, keeping the item details OCR read.
  // Anything else: the empty manual entry form.
  const enterManually = () => {
    if (problem === 'price') {
      navigation.navigate('ScanConfirm');
    } else {
      setResult(null);
      navigation.navigate('ManualEntry');
    }
  };

  const onPrimary = () => {
    if (copy.primary === 'retake')
      navigation.goBack(); // back to the camera
    else if (copy.primary === 'retry') navigation.replace('ScanProcessing');
    else if (copy.primary === 'signin')
      navigation.navigate('Login', { then: 'AddPrice' });
    else enterManually();
  };

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
          <Feather name="x" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Scan Tag
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.illustration}>
          <Feather name={copy.icon} size={44} color={colors.textMuted} />
        </View>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.message}>{copy.message}</Text>
        {__DEV__ && copy.devHint ? (
          <Text style={styles.devHint}>{copy.devHint}</Text>
        ) : null}

        {copy.tips && (
          <View style={styles.tips}>
            <Text style={styles.tipsTitle}>Tips for a better scan</Text>
            {TIPS.map((tip) => (
              <View key={tip} style={styles.tip}>
                <View style={styles.tipDot} />
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={onPrimary}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryText}>{PRIMARY_LABEL[copy.primary]}</Text>
        </Pressable>
        {copy.link && (
          <Pressable
            onPress={enterManually}
            accessibilityRole="button"
            hitSlop={12}
            style={({ pressed }) => [styles.link, pressed && styles.pressed]}
          >
            <Text style={styles.linkText}>{copy.link}</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const CLOSE_SIZE = 47;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 25,
    paddingTop: spacing.sm,
  },
  closeButton: {
    width: CLOSE_SIZE,
    height: CLOSE_SIZE,
    borderRadius: CLOSE_SIZE / 2,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: CLOSE_SIZE },
  headerTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.text },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 57,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  illustration: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 24,
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textBody,
    textAlign: 'center',
    maxWidth: 290,
  },
  devHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.error,
    textAlign: 'center',
    maxWidth: 300,
  },
  tips: {
    alignSelf: 'stretch',
    backgroundColor: colors.field,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  tipsTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
    color: colors.text,
  },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.scanned,
  },
  tipText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text,
  },
  footer: {
    paddingHorizontal: 31,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  primaryButton: {
    alignSelf: 'stretch',
    height: 54,
    borderRadius: 30,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 18,
    color: colors.field,
  },
  link: { paddingVertical: spacing.sm },
  linkText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    color: colors.textMuted,
  },
  pressed: { opacity: 0.7 },
});
