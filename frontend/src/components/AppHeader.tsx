import { Feather } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, shadow, spacing } from '../theme';

type Props = {
  onLocationPress?: () => void;
};

export function AppHeader({ onLocationPress }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <Pressable
          onPress={onLocationPress}
          accessibilityRole="button"
          accessibilityLabel="Change location"
          hitSlop={8}
          style={styles.side}
        >
          <Feather name="map-pin" size={28} color={colors.text} />
        </Pressable>

        <Image
          source={require('../../assets/nav-image.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Grocery PricePal"
        />

        {/* Empty box the same width as the pin, so the logo stays centered */}
        <View style={styles.side} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 1,
    ...shadow,
  },
  row: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.gutter,
  },
  side: { width: 44, justifyContent: 'center' },
  logo: { width: 47, height: 45 },
});