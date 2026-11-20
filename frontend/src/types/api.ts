// Shapes exactly as Ceren's FastAPI returns them (from the Swagger screenshots).
// Screens should never use these directly; mappers.ts converts them into types/price.ts.

export interface ApiStore {
    id: string;
    storeName: string;
    storeLocation: string; // e.g. "New York, NY", a city, not coordinates
  }
  
  export interface ApiItem {
    id: string;
    itemName: string;
    brand: string;
    // Two size formats exist right now; the converter reads whichever is present.
    unitSize?: string | null; // Ceren's: "6 oz" (currently comes back null)
    unitAmount?: number | null; // Dixon's: 1
    unit?: string | null; //                "LB"
  }

  // GET /api/v1/items/search?q=... wraps the list in "results"
  export interface ApiItemSearchResponse {
    results: ApiItem[];
  }
  
  // One entry in GET price history
  export interface ApiPriceEntry {
    id: string;
    price: number;
    dateRecorded: string; // e.g. "2026-10-13"
    isPublic: boolean;
    item: ApiItem;
    store: ApiStore;
  }
  
  // GET price history response
  export interface ApiPriceHistory {
    item_id: string; // note: snake_case, unlike the other fields
    prices: ApiPriceEntry[];
  }
  
  // POST /api/v1/items request body (requires sign-in)
  export interface ApiCreateItem {
    itemName: string;
    brand: string;
    unitSize: string;
  }
  
  // POST /api/v1/prices request body (requires sign-in)
  export interface ApiCreatePrice {
    itemId: string;
    storeId: string;
    price: number;
    isPublic: boolean;
  }
  
  // Simple confirmation responses, e.g. {"message": "Price submitted successfully"}
  export interface ApiMessage {
    message: string;
  }