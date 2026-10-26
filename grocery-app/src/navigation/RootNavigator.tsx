import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AddPriceScreen } from '../screens/AddPriceScreen';
import { CameraScreen } from '../screens/CameraScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { ProductDetailScreen } from '../screens/ProductDetailScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { SubmitPriceScreen } from '../screens/SubmitPriceScreen';
import { colors } from '../theme';
import { TabNavigator } from './TabNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      {/* Add a Price flow: every step slides up as a sheet over the tabs. */}
      <Stack.Screen
        name="AddPrice"
        component={AddPriceScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="ScanPrice"
        component={CameraScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="ManualEntry"
        component={SubmitPriceScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}
