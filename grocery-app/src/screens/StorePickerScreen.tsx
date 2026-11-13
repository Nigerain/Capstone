import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
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
import { getNearbyStores } from '../services/storeService';
import { usePickerStore } from '../store/usePickerStore';
import { colors, fonts, spacing } from '../theme';
import type { Store } from '../types/price';
import { formatDistance } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'StorePicker'>;

// "0.4 mi · Open until 10 PM", skipping whatever we don't know.
function storeDetails(store: Store): string {
  return [
    store.distanceMi != null ? formatDistance(store.distanceMi) : null,
    store.closesAt ? `Open until ${store.closesAt}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

// Built from the Figma frame "Store Picker". Opened from the Store field on
// the price form; the choice goes back through usePickerStore.
export function StorePickerScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const current = usePickerStore((s) => s.store);
  const setStore = usePickerStore((s) => s.setStore);

  // Start with the form's store checked, so "Use Key Food" works right away.
  const [selected, setSelected] = useState<Store | null>(current);
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
    setStore(selected, 'user');
    navigation.goBack();
  };

  // TODO(location): ask for the phone's location (expo-location) and re-sort
  // by real distance with Dixon's haversine helper. For now: pick the closest.
  const useCurrentLocation = async () => {
    setQuery('');
    const nearby = await queryClient.fetchQuery({
      queryKey: ['stores', 'nearby', ''],
      queryFn: () => getNearbyStores(''),
    });
    if (nearby[0]) setSelected(nearby[0]);
  };

  // TODO(backend): needs a POST /api/v1/stores endpoint.
  const addStore = () =>
    Alert.alert('Coming soon', 'Adding a new store isn’t built yet.');

  const addStoreLink = (
    <Pressable onPress={addStore} accessibilityRole="button" hitSlop={8}>
      <Text style={styles.addLink}>Can’t find your store? Add it</Text>
    </Pressable>
  );

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
              : 'Near you'}
          </Text>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            Try a different name, or add the store.
          </Text>
        }
        ListFooterComponent={<View style={styles.footer}>{addStoreLink}</View>}
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
        <Pressable
          onPress={useCurrentLocation}
          accessibilityRole="button"
          hitSlop={6}
          style={({ pressed }) => [
            styles.locationRow,
            pressed && styles.pressed,
          ]}
        >
          <Feather name="navigation" size={18} color={colors.positive} />
          <Text style={styles.locationText}>Use my current location</Text>
        </Pressable>
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
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  locationText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.positive,
  },
  pressed: { opacity: 0.7 },
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
