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
  // Select store for price submission
  StorePicker: undefined;
  // After a successful submit; replaces the whole Add a Price flow.
  PricePosted: {
    itemId: string | null; // from the backend; null hides "View item"
    itemName: string;
    brand: string | null;
    unitSize: string | null;
    storeName: string;
    price: number;
    isPublic: boolean;
    fromScan: boolean; // show the scan photo as the thumbnail
  };
  ProductDetail: { itemId: string };
  // `then: 'AddPrice'` = they tapped "+" while signed out; open Add a Price
  // after they sign in, instead of the Profile tab.
  // `then: 'back'` = their session expired on the price form; go back to
  // it after logging in (or signing up, if they switch to Sign up).
  Signup: { then?: 'AddPrice' | 'back' } | undefined;
  Login: { then?: 'AddPrice' | 'back' } | undefined;
};

// Lets useNavigation() know every screen name without extra typing.
declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
