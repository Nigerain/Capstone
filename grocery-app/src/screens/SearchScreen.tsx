import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { ProductCard } from '../components/ProductCard';
import { SearchBar } from '../components/SearchBar';
import { useSearchItems } from '../hooks/useSearchItems';
import { colors, spacing, typography } from '../theme';
import { formatPrice } from '../utils/format';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const { data: items, isLoading, isError } = useSearchItems(query);

  // For each item, keep only its cheapest price, and skip items with no prices.
  const results = (items ?? [])
    .map((item) => {
      const best = [...item.prices].sort((a, b) => a.price - b.price)[0];
      return best ? { item, best } : null;
    })
    .filter((r) => r !== null);

  const lowestPrice = Math.min(...results.map((r) => r.best.price));

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
        renderItem={({ item: { item, best } }) => (
          <ProductCard
            name={item.name}
            price={best.price}
            unitPrice={`${formatPrice(best.price)}/${best.unit}`}
            store={best.store}
            isBest={best.price === lowestPrice}
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