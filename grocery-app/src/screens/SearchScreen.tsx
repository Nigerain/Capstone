import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { FlatList, Keyboard, StyleSheet, Text, View } from 'react-native';

import { Chip } from '../components/Chip';
import { NoResults } from '../components/NoResults';
import { ProductCard } from '../components/ProductCard';
import { RecentSearches } from '../components/RecentSearches';
import { SearchBar } from '../components/SearchBar';
import { SearchSuggestions } from '../components/SearchSuggestions';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useSearchItems } from '../hooks/useSearchItems';
import { useSearchStore } from '../store/useSearchStore';
import { colors, spacing, typography } from '../theme';
import { formatDistance, formatSize, formatUnitPrice } from '../utils/format';
import { getBestPrice, getNearestPrice, getUnitPrice } from '../utils/price';

const MAX_SUGGESTIONS = 5;

type SortOption = 'unitPrice' | 'distance';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'unitPrice', label: 'Lowest unit price' },
  { value: 'distance', label: 'Nearest' },
];

export default function SearchScreen() {
  const navigation = useNavigation();

  const [query, setQuery] = useState(''); // what's in the box right now
  const [submittedQuery, setSubmittedQuery] = useState(''); // the last thing actually searched
  const [sortBy, setSortBy] = useState<SortOption>('unitPrice');
  const debouncedQuery = useDebouncedValue(query, 300);

  const suggestionsSearch = useSearchItems(debouncedQuery);
  const resultsSearch = useSearchItems(submittedQuery);

  const recentSearches = useSearchStore((s) => s.recentSearches);
  const addRecentSearch = useSearchStore((s) => s.addRecentSearch);
  const removeRecentSearch = useSearchStore((s) => s.removeRecentSearch);
  const clearRecentSearches = useSearchStore((s) => s.clearRecentSearches);

  const trimmed = query.trim();
  const hasQuery = trimmed.length > 0;
  const isSubmitted = hasQuery && trimmed === submittedQuery;

  // Every way of searching (keyboard, suggestion, recent, broader link) goes through here.
  const runSearch = (term: string) => {
    const cleaned = term.trim();
    if (!cleaned) return;
    setQuery(cleaned);
    setSubmittedQuery(cleaned);
    addRecentSearch(cleaned);
    Keyboard.dismiss();
  };

  // Unique item names that match what's typed, e.g. "chicken breast, boneless".
  const suggestions = [
    ...new Set((suggestionsSearch.data ?? []).map((item) => item.name.toLowerCase())),
  ].slice(0, MAX_SUGGESTIONS);

  // The sort decides which store each card shows (cheapest or closest), then the order.
  const results = (isSubmitted ? (resultsSearch.data ?? []) : [])
    .map((item) => {
      const shown = sortBy === 'distance' ? getNearestPrice(item) : getBestPrice(item);
      return shown ? { item, shown, unitPrice: getUnitPrice(item, shown) } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) =>
      sortBy === 'distance'
        ? a.shown.distanceMi - b.shown.distanceMi || a.unitPrice - b.unitPrice
        : a.unitPrice - b.unitPrice,
    );

  // BEST goes to the lowest price per unit among the cards shown.
  const lowestUnitPrice = Math.min(...results.map((r) => r.unitPrice));

  const renderContent = () => {
    // 1. Empty box: recent searches, or helper text on first visit
    if (!hasQuery) {
      return recentSearches.length > 0 ? (
        <RecentSearches
          searches={recentSearches}
          onSelect={runSearch}
          onRemove={removeRecentSearch}
          onClear={clearRecentSearches}
        />
      ) : (
        <Text style={[typography.subtitle, styles.message]}>
          Search for any grocery item to compare prices near you.
        </Text>
      );
    }

    // 2. Typing: suggestions
    if (!isSubmitted) {
      return (
        <SearchSuggestions query={trimmed} suggestions={suggestions} onSelect={runSearch} />
      );
    }

    // 3. Searched: loading, error, no results, or results
    if (resultsSearch.isLoading) {
      return <Text style={[typography.meta, styles.message]}>Loading…</Text>;
    }
    if (resultsSearch.isError) {
      return <Text style={[typography.meta, styles.message]}>Something went wrong.</Text>;
    }
    if (results.length === 0 && !resultsSearch.isFetching) {
      return (
        <NoResults
          query={submittedQuery}
          onAddPrice={() => navigation.navigate('AddPrice')}
          onSearch={runSearch}
        />
      );
    }

    return (
      <FlatList
        data={results}
        keyExtractor={(r) => r.item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={typography.meta}>
              {results.length} {results.length === 1 ? 'result' : 'results'} for “
              {submittedQuery}”
            </Text>
            <View style={styles.chips}>
              {SORT_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={sortBy === option.value}
                  onPress={() => setSortBy(option.value)}
                />
              ))}
            </View>
          </View>
        }
        renderItem={({ item: { item, shown, unitPrice } }) => (
          <ProductCard
            name={item.name}
            brandSize={`${item.brand} · ${formatSize(item.size, item.sizeUnit)}`}
            price={shown.price}
            unitPrice={formatUnitPrice(unitPrice, item.sizeUnit)}
            store={`${shown.store} · ${formatDistance(shown.distanceMi)}`}
            isBest={unitPrice === lowestUnitPrice}
          />
        )}
      />
    );
  };

  return (
    <View style={styles.container}>
      <SearchBar value={query} onChangeText={setQuery} onSubmit={() => runSearch(query)} />
      {renderContent()}
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
  message: { marginTop: spacing.md },
  header: { gap: spacing.md, marginBottom: spacing.xs },
  chips: { flexDirection: 'row', gap: spacing.sm },
  list: { gap: 10, paddingTop: spacing.lg, paddingBottom: spacing.xl },
});