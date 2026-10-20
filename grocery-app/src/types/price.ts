export type SizeUnit = 'lb' | 'oz' | 'gal' | 'fl oz' | 'ct' | 'each';

export type Category = 'Dairy' | 'Meat' | 'Produce' | 'Pantry' | 'Frozen';

export interface Price {
  id: string;
  itemName: string;
  price: number; // shelf price for the whole package
  unit?: string; // same unit as the item's size, when known
  store: string;
  storeId?: string; // needed later, when submitting prices
  distanceMi?: number; // missing until stores have coordinates
  submittedAt: string; // date the price was recorded
  // Voting and reputation: not sent by the backend yet
  submittedBy?: string;
  submitterReputation?: number;
  confirmCount?: number;
  disputeCount?: number;
}

export interface Item {
  id: string;
  name: string;
  brand: string;
  size: number | null; // null when nobody entered a size
  sizeUnit: string | null; // e.g. 'lb', 'oz'; null when unknown
  category?: Category; // the backend doesn't send this yet
  imageUri?: string;
  prices: Price[];
}

// A store's price for an item that went down since it was last reported.
export interface PriceDrop {
  item: Item;
  price: Price; // the new, lower price
  previousPrice: number; // what it cost before, e.g. 6.01
  dropPercent: number; // whole number, e.g. 12 → "12%"
}

export interface OcrResult {
  itemName: string | null;
  price: number | null;
  unit: string | null;
  confidence: {
    itemName: number;
    price: number;
    unit: number;
  };
}