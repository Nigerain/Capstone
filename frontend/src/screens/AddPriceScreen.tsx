import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AddPrice'>;

// Built from the Figma frame "Submission (entry point) Screen".
// Opened by the center "+" in the tab bar; the user picks scan or manual entry.
export function AddPriceScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
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
          Add a Price
        </Text>
        {/* Same width as the close button so the title stays centered. */}
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>How do you want to add it?</Text>
        <Text style={styles.subtitle}>
          Scan a price tag or receipt, or enter the details yourself.
        </Text>

        <View style={styles.options}>
          <OptionCard
            variant="dark"
            icon="camera"
            title="Scan a price tag"
            description="Fastest · auto-fills the form for you"
            onPress={() => navigation.navigate('ScanPrice')}
          />
          <OptionCard
            variant="light"
            icon="edit-3"
            title="Enter manually"
            description="Type in the item, store and price"
            onPress={() => navigation.navigate('ManualEntry')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type OptionCardProps = {
  variant: 'dark' | 'light';
  icon: ComponentProps<typeof Feather>['name'];
  title: string;
  description: string;
  onPress: () => void;
};

// One of the two big choice cards: dark = recommended (scan), light = manual.
function OptionCard({
  variant,
  icon,
  title,
  description,
  onPress,
}: OptionCardProps) {
  const dark = variant === 'dark';
  const iconColor = dark ? colors.onDark : colors.text;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
      style={({ pressed }) => [
        styles.card,
        dark ? styles.cardDark : styles.cardLight,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.iconTile,
          dark ? styles.iconTileDark : styles.iconTileLight,
        ]}
      >
        <Feather name={icon} size={25} color={iconColor} />
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, dark && styles.onDarkText]}>
          {title}
        </Text>
        <Text style={[styles.cardDescription, dark && styles.onDarkText]}>
          {description}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color={iconColor} />
    </Pressable>
  );
}

const CLOSE_SIZE = 47;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 21,
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
    paddingHorizontal: spacing.gutter,
    paddingTop: 37,
    paddingBottom: spacing.xl,
  },
  heading: {
    fontFamily: fonts.heading,
    fontSize: 24,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textBody,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 354,
  },
  options: { width: '100%', maxWidth: 320, gap: 36, marginTop: 47 },
  card: {
    minHeight: 107,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 9,
    gap: spacing.md,
  },
  cardDark: { backgroundColor: colors.dark },
  cardLight: { backgroundColor: colors.field },
  iconTile: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Figma: #D9D9D9 at 25% opacity. Only the fill is faded, so the icon stays white.
  iconTileDark: { backgroundColor: 'rgba(217, 217, 217, 0.25)' },
  iconTileLight: { backgroundColor: colors.card },
  cardText: { flex: 1, gap: 2 },
  cardTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: 18,
    color: colors.text,
  },
  cardDescription: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },
  onDarkText: { color: colors.field },
  pressed: { opacity: 0.7 },
});
