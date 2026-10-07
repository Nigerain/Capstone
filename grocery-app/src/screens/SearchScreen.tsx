import { useState } from 'react';
import { FlatList, Keyboard, StyleSheet, Text, View } from 'react-native';

import { ProductCard } from '../components/ProductCard';
import { RecentSearches } from '../components/RecentSearches';
import { SearchBar } from '../components/SearchBar';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useSearchItems } from '../hooks/useSearchItems';
import { useSearchStore } from '../store/useSearchStore';
import { colors, spacing, typography } from '../theme';
import { formatDistance, formatSize, formatUnitPrice } from '../utils/format';
import { getBestPrice, getUnitPrice } from '../utils/price';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const { data: items, isLoading, isError } = useSearchItems(debouncedQuery);

  // One value per call: the screen only re-renders when that value changes.
  const recentSearches = useSearchStore((s) => s.recentSearches);
  const addRecentSearch = useSearchStore((s) => s.addRecentSearch);
  const removeRecentSearch = useSearchStore((s) => s.removeRecentSearch);
  const clearRecentSearches = useSearchStore((s) => s.clearRecentSearches);

  const hasQuery = query.trim().length > 0;

  // Pressing the keyboard's search key saves the term.
  const handleSubmit = () => addRecentSearch(query);

  // Tapping a recent search runs it again and moves it to the top.
  const handleSelectRecent = (term: string) => {
    setQuery(term);
    addRecentSearch(term);
    Keyboard.dismiss();
  };

  // For each item: its cheapest store, and that price per lb/oz/etc.
  const results = (hasQuery ? (items ?? []) : [])
    .map((item) => {
      const best = getBestPrice(item);
      return best ? { item, best, unitPrice: getUnitPrice(item, best) } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // BEST goes to the lowest price per unit, not the lowest sticker price.
  const lowestUnitPrice = Math.min(...results.map((r) => r.unitPrice));

  return (
    <View style={styles.container}>
      <SearchBar value={query} onChangeText={setQuery} onSubmit={handleSubmit} />

      {!hasQuery ? (
        recentSearches.length > 0 ? (
          <RecentSearches
            searches={recentSearches}
            onSelect={handleSelectRecent}
            onRemove={removeRecentSearch}
            onClear={clearRecentSearches}
          />
        ) : (
          <Text style={[typography.subtitle, styles.helper]}>
            Search for any grocery item to compare prices near you.
          </Text>
        )
      ) : (
        <>
          {isLoading && <Text style={[typography.meta, styles.status]}>Loading…</Text>}
          {isError && (
            <Text style={[typography.meta, styles.status]}>Something went wrong.</Text>
          )}

          <FlatList
            data={results}
            keyExtractor={(r) => r.item.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            renderItem={({ item: { item, best, unitPrice } }) => (
              <ProductCard
                name={item.name}
                brandSize={`${item.brand} · ${formatSize(item.size, item.sizeUnit)}`}
                price={best.price}
                unitPrice={formatUnitPrice(unitPrice, item.sizeUnit)}
                store={`${best.store} · ${formatDistance(best.distanceMi)}`}
                isBest={unitPrice === lowestUnitPrice}
              />
            )}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.lg,
  },
  helper: { marginTop: spacing.md },
  status: { marginTop: spacing.md },
  list: { gap: 10, paddingTop: spacing.lg, paddingBottom: spacing.xl },
});