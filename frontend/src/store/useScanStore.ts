import { create } from 'zustand';

import type { ScanResult } from '../types/scan';

// The photo the user just took (or picked) in the scan flow, already cropped
// and shrunk, and what OCR read from it. Screens read these from here instead
// of route params, so the URI doesn't end up in navigation state.
export type ScanPhoto = {
  uri: string;
  width: number;
  height: number;
  source: 'camera' | 'library';
};

type ScanState = {
  photo: ScanPhoto | null;
  result: ScanResult | null;
  setPhoto: (photo: ScanPhoto) => void;
  setResult: (result: ScanResult | null) => void;
  clear: () => void;
};

export const useScanStore = create<ScanState>()((set) => ({
  photo: null,
  result: null,
  // A new photo means any earlier result no longer applies.
  setPhoto: (photo) => set({ photo, result: null }),
  setResult: (result) => set({ result }),
  clear: () => set({ photo: null, result: null }),
}));
