import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
};

export function SearchBar({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'Search groceries…',
  autoFocus = false,
}: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.bar, focused && styles.barFocused]}>
      <Feather name="search" size={20} color={colors.text} />

      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        selectionColor={colors.link}
        accessibilityLabel="Search groceries"
        style={styles.input}
      />

      {value.length > 0 && (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={10}
        >
          <Feather name="x" size={18} color={colors.text} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.field,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.card,
  },
  barFocused: {
    borderWidth: 1.5,
    borderColor: colors.link,
  },
  input: {
    ...typography.input,
    flex: 1,
    paddingVertical: 0, // removes Android's extra built-in padding
  },
});