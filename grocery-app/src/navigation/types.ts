import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Home: undefined;
  Search: undefined;
  Activity: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  // Add a Price flow, opened from the "+" in the tab bar.
  AddPrice: undefined;
  ScanPrice: undefined;
  ManualEntry: undefined;
  ProductDetail: { itemId: string };
  Signup: undefined;
  Login: undefined;
};

// Lets useNavigation() know every screen name without extra typing.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}

