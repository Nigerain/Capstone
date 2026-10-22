import { Feather } from '@expo/vector-icons';
import { forwardRef, type ComponentProps, type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { colors, fonts, spacing, typography } from '../theme';

// Labeled input from the Signup design: Fraunces label, rounded white field,
// Feather icon on the left, optional button on the right (e.g. show password).

type Props = TextInputProps & {
  label: string;
  icon: ComponentProps<typeof Feather>['name'];
  error?: string;
  right?: ReactNode;
};

export const FormField = forwardRef<TextInput, Props>(function FormField(
  { label, icon, error, right, style, ...inputProps },
  ref
) {
  return (
    <View style={styles.group}>
      <Text style={typography.label}>{label}</Text>
      <View style={[styles.field, error ? styles.fieldError : null]}>
        <Feather name={icon} size={19} color={colors.placeholder} />
        <TextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={colors.placeholder}
          accessibilityLabel={label}
          accessibilityHint={error}
          {...inputProps}
        />
        {right}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  field: {
    height: 51,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.field,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  fieldError: { borderColor: colors.error },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: fonts.bodySemibold,
    fontSize: 13,
    color: colors.text,
  },
  error: { fontFamily: fonts.body, fontSize: 12, color: colors.error },
});
