import type { NavigatorScreenParams } from '@react-navigation/native';

import type { ScanProblem } from '../types/scan';

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
  // The scan screens below read the photo and OCR result from useScanStore.
  ScanProcessing: undefined;
  ScanProblem: { problem: ScanProblem };
  ScanConfirm: undefined;
  ManualEntry: undefined;
  ProductDetail: { itemId: string };
  // `then: 'AddPrice'` = they tapped "+" while signed out; open Add a Price
  // after they sign in, instead of the Profile tab.
  Signup: { then?: 'AddPrice' } | undefined;
  Login: { then?: 'AddPrice' } | undefined;
};

// Lets useNavigation() know every screen name without extra typing.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
