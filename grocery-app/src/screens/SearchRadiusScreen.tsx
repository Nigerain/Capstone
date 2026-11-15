import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PickerLayout } from '../components/PickerLayout';
import { PickerRow } from '../components/PickerRow';
import type { RootStackParamList } from '../navigation/types';
import {
  SEARCH_RADIUS_OPTIONS,
  useSettingsStore,
  type SearchRadius,
} from '../store/useSettingsStore';
import { colors, fonts, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SearchRadius'>;

// Not in Figma: opened from Profile's "Search radius" row. Reuses the Store
// Picker's layout and rows so it looks like the rest of the app.
export function SearchRadiusScreen({ navigation }: Props) {
  const current = useSettingsStore((s) => s.searchRadiusMi);
  const setSearchRadius = useSettingsStore((s) => s.setSearchRadius);
  const [selected, setSelected] = useState<SearchRadius>(current);

  const confirm = () => {
    setSearchRadius(selected);
    navigation.goBack();
  };

  return (
    <PickerLayout
      title="Search Radius"
      leading="close"
      onLeadingPress={() => navigation.goBack()}
      buttonLabel={`Use ${selected} mi`}
      onButtonPress={confirm}
    >
      <View style={styles.body}>
        <Text style={styles.hint}>
          Show prices from stores within this distance of you.
        </Text>
        {SEARCH_RADIUS_OPTIONS.map((miles) => (
          <PickerRow
            key={miles}
            lead={{ kind: 'none' }}
            title={`${miles} ${miles === 1 ? 'mile' : 'miles'}`}
            selected={miles === selected}
            onPress={() => setSelected(miles)}
          />
        ))}
      </View>
    </PickerLayout>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, paddingTop: spacing.md, gap: spacing.md },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
