import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PickerLayout } from '../components/PickerLayout';
import { PickerRow, PickerRowsSkeleton } from '../components/PickerRow';
import { SearchBar } from '../components/SearchBar';
import { StateMessage } from '../components/StateMessage';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useStores } from '../hooks/useStores';
import type { RootStackParamList } from '../navigation/types';
import { usePickerStore } from '../store/usePickerStore';
import { colors, fonts, spacing } from '../theme';
import type { Store } from '../types/price';
import { formatDistance } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'StorePicker'>;

// Show store address and distance when available
function storeDetails(store: Store): string {
  return [
    store.distanceMi != null ? formatDistance(store.distanceMi) : null,
    store.address ?? null,
  ]
    .filter(Boolean)
    .join(' · ');
}

// Select store for price submission
export function StorePickerScreen({ navigation }: Props) {
  const formStore = usePickerStore((s) => s.store);
  const setStore = usePickerStore((s) => s.setStore);
  const [selected, setSelected] = useState<Store | null>(formStore);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);
  const searching = debouncedQuery.trim().length > 0;

  const {
    data: stores,
    isPending,
    isError,
    refetch,
  } = useStores(debouncedQuery);

  const confirm = () => {
    if (!selected) return;
    setStore(selected);
    navigation.goBack();
  };

  // Store creation is not connected yet
  const addStore = () =>
    Alert.alert('Coming soon', 'Adding a new store isn’t built yet.');

  let body;
  if (isPending) {
    body = <PickerRowsSkeleton />;
  } else if (isError) {
    body = (
      <StateMessage
        icon="wifi-off"
        title="Couldn’t load stores"
        message="Check your connection and try again."
        action={{ label: 'Try Again', onPress: () => refetch() }}
      />
    );
  } else {
    body = (
      <FlatList
        data={stores}
        keyExtractor={(store) => store.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={RowGap}
        ListHeaderComponent={
          <Text style={styles.sectionLabel}>
            {searching
              ? matchCount(stores.length, debouncedQuery.trim())
              : 'Stores'}
          </Text>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            Try a different store name.
          </Text>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <Pressable onPress={addStore} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.addLink}>Can’t find your store? Add it</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item: store }) => (
          <PickerRow
            lead={{ kind: 'store' }}
            title={store.name}
            subtitle={storeDetails(store)}
            selected={store.id === selected?.id}
            onPress={() => setSelected(store)}
          />
        )}
      />
    );
  }

  return (
    <PickerLayout
      title="Choose a Store"
      leading="close"
      onLeadingPress={() => navigation.goBack()}
      buttonLabel={selected ? `Use ${selected.name}` : 'Choose a store'}
      buttonDisabled={!selected}
      onButtonPress={confirm}
    >
      <View style={styles.top}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search stores"
          accessibilityLabel="Search stores"
        />

      </View>
      <View style={styles.body}>{body}</View>
    </PickerLayout>
  );
}

function matchCount(count: number, query: string): string {
  return `${count} ${count === 1 ? 'store matches' : 'stores match'} “${query}”`;
}

function RowGap() {
  return <View style={styles.rowGap} />;
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 24, gap: spacing.md },
  body: { flex: 1, paddingTop: spacing.md, paddingHorizontal: 24 },
  list: { paddingBottom: spacing.xl },
  sectionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  rowGap: { height: spacing.md },
  empty: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  footer: { marginTop: spacing.md, alignItems: 'center' },
  addLink: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.positive,
    textAlign: 'center',
  },
});
