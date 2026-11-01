// What the backend's POST /api/v1/ocr/scan sends back, as agreed with Shernice
// (Nov 1). One tag per response. Fields OCR couldn't find are null.
export type ApiScanResponse = {
  itemName: string | null;
  brand: string | null;
  unitSize: string | null;
  // Agreed as a number (1.79). Older test output sent "$1.79", so both are accepted.
  price: number | string | null;
  priceConfidence: number; // 0-1
  needsManualPrice?: boolean;
  status?: 'ok' | 'low_confidence';
};

// The same result, cleaned up for the screens.
export type ScanResult = {
  itemName: string | null;
  brand: string | null;
  unitSize: string | null;
  price: number | null;
  priceConfidence: number;
  // True when the price can't be trusted: the app asks the user to type it.
  needsManualPrice: boolean;
};

// Why a scan didn't produce a usable price. Each one has its own message
// on the "Couldn't read" screen.
export type ScanProblem =
  | 'unreadable' // nothing useful came back
  | 'price' // item details came back, the price didn't
  | 'network' // no internet, timeout, or backend down
  | 'server' // the backend or Vision returned an error
  | 'limit'; // daily scan limit reached (429)

// A store the user is probably standing in.
export type GuessedStore = { name: string; distanceMi: number };
