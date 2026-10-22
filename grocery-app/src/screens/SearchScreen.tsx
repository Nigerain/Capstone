import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { FlatList, Keyboard, StyleSheet, Text, View } from 'react-native';

import { Chip } from '../components/Chip';
import { NoResults } from '../components/NoResults';
import { ProductCard } from '../components/ProductCard';
import { RecentSearches } from '../components/RecentSearches';
import { SearchBar } from '../components/SearchBar';
import { SearchSuggestions } from '../components/SearchSuggestions';
import { SearchResultsSkeleton } from '../components/Skeleton';
import { StateMessage } from '../components/StateMessage';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useSearchItems } from '../hooks/useSearchItems';
import { isNetworkError } from '../services/api';
import { useSearchStore, useSearchStoreHydrated } from '../store/useSearchStore';
import { colors, spacing, typography } from '../theme';
import { formatBrandSize, formatItemUnitPrice, formatStoreLine } from '../utils/format';
import { distanceForSorting, getBestPrice, getNearestPrice, getUnitPrice } from '../utils/price';

const MAX_SUGGESTIONS = 5;

type SortOption = 'unitPrice' | 'distance';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'unitPrice', label: 'Lowest unit price' },
  { value: 'distance', label: 'Nearest' },
];

export default function SearchScreen() {
  const navigation = useNavigation();
  const hydrated = useSearchStoreHydrated();
  const tabBarHeight = useBottomTabBarHeight();

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

  // keepPreviousData keeps the last search's results on screen while a new one loads.
  // Those belong to a different query, so treat them as "still loading", not as results.
  const isLoadingResults = resultsSearch.isPending || resultsSearch.isPlaceholderData;

  // "Nearest" only makes sense when stores have distances.
  const hasDistances = (resultsSearch.data ?? []).some((item) =>
    item.prices.some((p) => p.distanceMi != null),
  );
  const activeSort: SortOption = hasDistances ? sortBy : 'unitPrice';

  // The sort decides which store each card shows (cheapest or closest), then the order.
  const results = (isSubmitted && !isLoadingResults ? (resultsSearch.data ?? []) : [])
    .map((item) => {
      const shown = activeSort === 'distance' ? getNearestPrice(item) : getBestPrice(item);
      if (!shown) return null;
      const unitPrice = getUnitPrice(item, shown);
      // Compare by price per unit when the size is known, otherwise by sticker price.
      return { item, shown, compareValue: unitPrice ?? shown.price };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) =>
      activeSort === 'distance'
        ? distanceForSorting(a.shown) - distanceForSorting(b.shown) || a.compareValue - b.compareValue
        : a.compareValue - b.compareValue,
    );

  // BEST goes to the lowest price per unit among the cards shown.
  const lowestValue = Math.min(...results.map((r) => r.compareValue));

  const renderContent = () => {
    // 1. Empty box: recent searches, or helper text on first visit
    if (!hasQuery) {
      if (!hydrated) return null; 
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
    if (resultsSearch.isError && !resultsSearch.data) {
      const offline = isNetworkError(resultsSearch.error);
      return (
        <StateMessage
          icon={offline ? 'wifi-off' : 'alert-circle'}
          title={offline ? 'Can’t connect' : 'Something went wrong'}
          message={
            offline
              ? 'Check your internet connection, then try your search again.'
              : `We couldn’t load prices for “${submittedQuery}”. Please try again.`
          }
          action={{ label: 'Try Again', onPress: () => resultsSearch.refetch() }}
        />
      );
    }
    if (isLoadingResults) {
      return <SearchResultsSkeleton />;
    }
    if (results.length === 0) {
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
        // Extra bottom space so the last result isn't hidden behind the tab bar.
        contentContainerStyle={[
          styles.list,
          { paddingBottom: tabBarHeight + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={typography.meta}>
              {results.length} {results.length === 1 ? 'result' : 'results'} for “
              {submittedQuery}”
            </Text>
            <View style={styles.chips}>
            {SORT_OPTIONS.filter((option) => option.value !== 'distance' || hasDistances).map(
                (option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={activeSort === option.value}
                    onPress={() => setSortBy(option.value)}
                  />
                ),
              )}
            </View>
          </View>
        }
        renderItem={({ item: { item, shown, compareValue } }) => (
          <ProductCard
            name={item.name}
            brandSize={formatBrandSize(item)}
            price={shown.price}
            unitPrice={formatItemUnitPrice(item, shown) ?? undefined}
            store={formatStoreLine(shown)}
            isBest={compareValue === lowestValue}
            onPress={() => navigation.navigate('ProductDetail', { itemId: item.id })}
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
  list: { gap: 10, paddingTop: spacing.lg },
});