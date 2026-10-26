import { create } from 'zustand';

// The photo the user just took (or picked) in the scan flow, already cropped
// and shrunk. The OCR step will read it from here instead of a route param,
// so the URI doesn't end up in navigation state.
export type ScanPhoto = {
  uri: string;
  width: number;
  height: number;
  source: 'camera' | 'library';
};

type ScanState = {
  photo: ScanPhoto | null;
  setPhoto: (photo: ScanPhoto) => void;
  clear: () => void;
};

export const useScanStore = create<ScanState>()((set) => ({
  photo: null,
  setPhoto: (photo) => set({ photo }),
  clear: () => set({ photo: null }),
}));
