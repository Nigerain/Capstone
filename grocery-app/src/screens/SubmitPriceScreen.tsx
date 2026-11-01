import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { PriceForm } from '../components/PriceForm';
import type { RootStackParamList } from '../navigation/types';
import { useScanStore } from '../store/useScanStore';

type Props = NativeStackScreenProps<RootStackParamList, 'ManualEntry'>;

// Built from the Figma frame "Submission (Manual) Screen": the same price
// form as Confirm Details, starting empty. Opened from "Enter manually" on
// Add a Price, the Couldn't Read screen, or the camera permission prompt.
export function SubmitPriceScreen({ navigation }: Props) {
  const clearScan = useScanStore((s) => s.clear);

  // X closes the whole Add a Price flow, like the other X buttons in it.
  const close = () => {
    clearScan();
    navigation.popToTop();
  };

  return (
    <PriceForm
      scan={null}
      photo={null}
      leading="close"
      onLeadingPress={close}
      onSubmitted={close}
    />
  );
}
