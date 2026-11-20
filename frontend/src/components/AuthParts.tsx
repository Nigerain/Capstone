import { Feather } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, fonts, radius } from '../theme';

// Pieces shared by the Signup and Login screens.

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={8}
      style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
    >
      <Feather name="chevron-left" size={24} color={colors.text} />
    </Pressable>
  );
}

// Dark pill button ("Create Account", "Log In") with a spinner while busy.
export function AuthButton({
  label,
  busyLabel,
  busy,
  onPress,
  style,
}: {
  label: string;
  busyLabel: string;
  busy: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: busy }}
      style={({ pressed }) => [
        styles.primaryButton,
        style,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator
          color={colors.onDark}
          accessibilityLabel={busyLabel}
        />
      ) : (
        <Text style={styles.primaryText}>{label}</Text>
      )}
    </Pressable>
  );
}

// The thin "—— or ——" line between email and Google sign-in.
export function OrDivider({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[styles.divider, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>or</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

// Placeholder until Google sign-in is set up (needs Firebase + a development build).
export function GoogleButton({ style }: { style?: StyleProp<ViewStyle> }) {
  const showComingSoon = () =>
    Alert.alert(
      'Coming soon',
      'Google sign-in isn’t set up yet. Use your email for now.'
    );

  return (
    <Pressable
      onPress={showComingSoon}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.googleButton,
        style,
        pressed && styles.pressed,
      ]}
    >
      <Image
        source={require('../../assets/google.png')}
        style={styles.googleIcon}
        accessibilityIgnoresInvertColors
      />
      <Text style={styles.googleText}>Continue with Google</Text>
    </Pressable>
  );
}

// The eye icon inside a password field.
export function PasswordToggle({
  shown,
  onToggle,
}: {
  shown: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={shown ? 'Hide password' : 'Show password'}
    >
      <Feather
        name={shown ? 'eye-off' : 'eye'}
        size={19}
        color={colors.placeholder}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  backButton: {
    width: 47,
    height: 47,
    borderRadius: 24,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    height: 44,
    borderRadius: radius.round,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.field,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#B5ACAC',
  },
  dividerText: { fontFamily: fonts.body, fontSize: 12, color: '#B5ACAC' },
  googleButton: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: radius.round,
    backgroundColor: '#FDFAFA',
  },
  googleIcon: { width: 18, height: 18 },
  googleText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.text },
});
