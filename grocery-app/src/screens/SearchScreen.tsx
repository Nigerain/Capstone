import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { ProductCard } from '../components/ProductCard';
import { SearchBar } from '../components/SearchBar';
import { useSearchItems } from '../hooks/useSearchItems';
import { colors, spacing, typography } from '../theme';
import { getBestPrice, getUnitPrice } from '../utils/price';
import { formatDistance, formatSize, formatUnitPrice } from '../utils/format';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const { data: items, isLoading, isError } = useSearchItems(query);

  // For each item, keep only its cheapest price, and skip items with no prices.
  const results = (items ?? [])
    .map((item) => {
      const best = getBestPrice(item);
      return best ? { item, best, unitPrice: getUnitPrice(item, best) } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

    const lowestUnitPrice = Math.min(...results.map((r) => r.unitPrice));

  return (
    <View style={styles.container}>
      <SearchBar value={query} onChangeText={setQuery} />

      {isLoading && <Text style={[typography.meta, styles.status]}>Loading…</Text>}
      {isError && <Text style={[typography.meta, styles.status]}>Something went wrong.</Text>}

      <FlatList
        data={results}
        keyExtractor={(r) => r.item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
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
  status: { marginTop: spacing.md },
  list: { gap: 10, paddingTop: spacing.lg, paddingBottom: spacing.xl },
});