import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { AppHeader } from '../components/AppHeader';
import { TabBar } from '../components/TabBar';
import { ActivityScreen } from '../screens/ActivityScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import SearchScreen from '../screens/SearchScreen';
import { useAuthStore } from '../store/useAuthStore';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{ header: () => <AppHeader /> }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        listeners={({ navigation }) => ({
          // Signed out: the user icon opens Sign up instead of the Profile tab.
          tabPress: (event) => {
            if (useAuthStore.getState().user) return;
            event.preventDefault();
            // Signup lives in the root stack, one level above the tabs.
            navigation.getParent()?.navigate('Signup');
          },
        })}
      />
    </Tab.Navigator>
  );
}