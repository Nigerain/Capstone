import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProductDetailScreen } from '../screens/ProductDetailScreen'; 
import { AddPriceScreen } from '../screens/AddPriceScreen';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { colors } from '../theme';
import { TabNavigator } from './TabNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const LoginPlaceholder = () => <PlaceholderScreen title="Log in" />;

export function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    >
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="AddPrice" component={AddPriceScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      {/* TEMPORARY until the Login screen is built from Figma */}
      <Stack.Screen
        name="Login"
        component={LoginPlaceholder}
        options={{ headerShown: true, title: 'Log in', headerBackTitle: 'Back' }}
      />
    </Stack.Navigator>
  );
}