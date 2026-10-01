import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AddPriceScreen } from '../screens/AddPriceScreen';
import { colors } from '../theme';
import { TabNavigator } from './TabNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    >
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen name="AddPrice" component={AddPriceScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}