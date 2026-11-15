import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, fonts } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  busy?: boolean;
  busyLabel?: string; // read by screen readers while the spinner shows
  style?: StyleProp<ViewStyle>;
};

// Figma component "Button/Secondary": outlined pill for the alternative
// action, e.g. "Log out" on the Profile tab.
export function SecondaryButton({
  label,
  onPress,
  busy = false,
  busyLabel,
  style,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: busy }}
      style={({ pressed }) => [styles.button, style, pressed && styles.pressed]}
    >
      {busy ? (
        <ActivityIndicator color={colors.dark} accessibilityLabel={busyLabel} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 54,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  label: { fontFamily: fonts.semibold, fontSize: 17, color: colors.dark },
});
