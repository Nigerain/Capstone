import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AddPriceScreen } from '../screens/AddPriceScreen';
import { CameraScreen } from '../screens/CameraScreen';
import { CategoryScreen } from '../screens/CategoryScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { PricePostedScreen } from '../screens/PricePostedScreen';
import { ProductDetailScreen } from '../screens/ProductDetailScreen';
import { ScanConfirmScreen } from '../screens/ScanConfirmScreen';
import { ScanProblemScreen } from '../screens/ScanProblemScreen';
import { ScanProcessingScreen } from '../screens/ScanProcessingScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { StorePickerScreen } from '../screens/StorePickerScreen';
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
      {/* Same level as Product Detail: back button, no tab bar. */}
      <Stack.Screen name="Category" component={CategoryScreen} />
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
      {/* Processing swaps itself for Problem or Confirm, so Back skips the spinner. */}
      <Stack.Screen
        name="ScanProcessing"
        component={ScanProcessingScreen}
        options={{ presentation: 'modal', gestureEnabled: false }}
      />
      <Stack.Screen
        name="ScanProblem"
        component={ScanProblemScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="ScanConfirm"
        component={ScanConfirmScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="ManualEntry"
        component={SubmitPriceScreen}
        options={{ presentation: 'modal' }}
      />
      {/* Slides up over the price form and drops back to it. */}
      <Stack.Screen
        name="StorePicker"
        component={StorePickerScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="PricePosted"
        component={PricePostedScreen}
        options={{ presentation: 'modal', gestureEnabled: false }}
      />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}
