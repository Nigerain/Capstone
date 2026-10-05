export type SizeUnit = 'lb' | 'oz' | 'gal' | 'fl oz' | 'ct' | 'each';

export type Category = 'Dairy' | 'Meat' | 'Produce' | 'Pantry' | 'Frozen';

export interface Price {
  id: string;
  itemName: string;
  price: number; // shelf price for the whole package, e.g. 5.29 for a 1.5 lb pack
  unit: SizeUnit | string; // same unit as the item's size
  store: string;
  distanceMi: number; // distance from the user to the store
  submittedBy: string;
  submitterReputation: number;
  submittedAt: string; // ISO timestamp
  confirmCount: number;
  disputeCount: number;
}

export interface Item {
  id: string;
  name: string;
  brand: string;
  size: number; // e.g. 1.5
  sizeUnit: SizeUnit; // e.g. 'lb'  →  "1.5 lb"
  category: Category;
  imageUri?: string;
  prices: Price[];
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