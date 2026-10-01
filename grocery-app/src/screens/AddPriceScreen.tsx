import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '../components/Screen';
import { colors, typography } from '../theme';

export function AddPriceScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
        >
          <Feather name="x" size={24} color={colors.text} />
        </Pressable>
        <Text style={[typography.heading, { marginTop: 16 }]}>Add a Price</Text>
      </Screen>
    </SafeAreaView>
  );
}