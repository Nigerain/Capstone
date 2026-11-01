// What the backend's POST /api/v1/ocr/scan sends back, as Shernice defined it
// (Nov 1). One tag per response. Every response has every field; anything OCR
// couldn't find is null.
export type ApiScanResponse = {
  status: 'ok' | 'low_confidence';
  // null on a good scan. When status is "low_confidence":
  //   low_score   - a price was found but it's unclear (price is null)
  //   no_price    - no price found (price is null)
  //   read_failed - couldn't read the photo at all (every field is null)
  reason: 'low_score' | 'no_price' | 'read_failed' | null;
  itemName: string | null;
  brand: string | null;
  unitSize: string | null;
  // A number (1.79). Older test output sent "$1.79", so both are accepted.
  price: number | string | null;
  priceConfidence?: number | null; // for the OCR team's testing; the app ignores it
};

// The same result, cleaned up for the screens.
export type ScanResult = {
  status: ApiScanResponse['status'];
  reason: ApiScanResponse['reason'];
  itemName: string | null;
  brand: string | null;
  unitSize: string | null;
  price: number | null; // always null when status is "low_confidence"
};

// Why a scan didn't produce a usable price. Each one has its own message
// on the "Couldn't read" screen.
export type ScanProblem =
  | 'unreadable' // read_failed, or nothing useful came back
  | 'price' // item details came back, the price didn't (low_score / no_price)
  | 'network' // no internet, timeout, or backend down
  | 'server' // the backend or Vision returned an error
  | 'limit'; // daily scan limit reached (429)

// A store the user is probably standing in.
export type GuessedStore = { name: string; distanceMi: number };
