import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { PriceForm } from '../components/PriceForm';
import type { RootStackParamList } from '../navigation/types';
import { useScanStore } from '../store/useScanStore';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanConfirm'>;

// Built from the Figma frame "Confirmed Scan Screen": the price form,
// prefilled with what OCR read from the photo.
export function ScanConfirmScreen({ navigation }: Props) {
  const photo = useScanStore((s) => s.photo);
  const result = useScanStore((s) => s.result);
  const clearScan = useScanStore((s) => s.clear);

  return (
    <PriceForm
      scan={result}
      photo={photo}
      leading="back"
      onLeadingPress={() => navigation.goBack()}
      onSubmitted={() => {
        clearScan();
        navigation.popToTop();
      }}
    />
  );
}
