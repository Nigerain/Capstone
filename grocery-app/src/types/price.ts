export interface Price {
    id: string;
    itemName: string;
    price: number;
    unit: 'lb' | 'oz' | 'each' | string;
    store: string;
    submittedBy: string;
    submitterReputation: number;
    submittedAt: string; // ISO timestamp
    confirmCount: number;
    disputeCount: number;
  }
  
  export interface Item {
    id: string;
    name: string;
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