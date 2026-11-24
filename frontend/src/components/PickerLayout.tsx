import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts } from '../theme';

type Props = {
  title: string;
  // "close" (X) on the Store Picker, "back" (chevron) on the Item Picker, per Figma.
  leading: 'back' | 'close';
  onLeadingPress: () => void;
  buttonLabel: string;
  buttonDisabled?: boolean;
  onButtonPress: () => void;
  children: ReactNode; // the search bar and list
};

// Shared frame for the Store Picker and Item Picker: round header button,
// centered title, content, and a dark "Use …" button pinned to the bottom.
export function PickerLayout({
  title,
  leading,
  onLeadingPress,
  buttonLabel,
  buttonDisabled = false,
  onButtonPress,
  children,
}: Props) {
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
              styles.roundButton,
              pressed && styles.pressed,
            ]}
          >
            <Feather
              name={leading === 'back' ? 'chevron-left' : 'x'}
              size={22}
              color={colors.text}
            />
          </Pressable>
          <Text
            style={styles.title}
            accessibilityRole="header"
            numberOfLines={1}
          >
            {title}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.flex}>{children}</View>

        <View style={styles.footer}>
          <Pressable
            onPress={onButtonPress}
            disabled={buttonDisabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: buttonDisabled }}
            style={({ pressed }) => [
              styles.button,
              buttonDisabled && styles.buttonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.buttonText} numberOfLines={1}>
              {buttonLabel}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    paddingHorizontal: 21,
    paddingTop: 8,
    paddingBottom: 26,
  },
  roundButton: {
    width: ROUND_SIZE,
    height: ROUND_SIZE,
    borderRadius: ROUND_SIZE / 2,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: ROUND_SIZE },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.headingSemibold,
    fontSize: 20,
    color: colors.darkButton,
  },
  footer: { paddingHorizontal: 31, paddingTop: 8, paddingBottom: 12 },
  button: {
    height: 54,
    borderRadius: 30,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    color: colors.onDark,
  },
  pressed: { opacity: 0.7 },
});
