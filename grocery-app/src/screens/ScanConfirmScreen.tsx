import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { PriceForm } from '../components/PriceForm';
import type { RootStackParamList } from '../navigation/types';
import { showPricePosted } from './PricePostedScreen';
import { useScanStore } from '../store/useScanStore';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanConfirm'>;

// Built from the Figma frame "Confirmed Scan Screen": the price form,
// prefilled with what OCR read from the photo.
export function ScanConfirmScreen({ navigation }: Props) {
  const photo = useScanStore((s) => s.photo);
  const result = useScanStore((s) => s.result);

  return (
    <PriceForm
      scan={result}
      photo={photo}
      leading="back"
      onLeadingPress={() => navigation.goBack()}
      // Price Posted shows the photo, then clears the scan when it closes.
      onSubmitted={(posted) =>
        showPricePosted(navigation, { ...posted, fromScan: true })
      }
    />
  );
}
