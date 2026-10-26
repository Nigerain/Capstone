import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';

// Temporary stand-in for screens in the Add a Price flow that aren't built yet.
// The X leaves the whole flow and returns to the tabs.
export function FlowPlaceholder({ title }: { title: string }) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

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
        <Text style={typography.heading}>{title}</Text>
        <Text style={typography.subtitle}>Coming soon</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  close: { margin: spacing.xl, alignSelf: 'flex-start' },
  body: { paddingHorizontal: spacing.gutter, gap: spacing.xs },
});
