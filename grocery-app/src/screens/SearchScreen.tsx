import { useState } from 'react';
import { View, TextInput, FlatList, Text, StyleSheet } from 'react-native';
import { useSearchItems } from '../hooks/useSearchItems';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const { data: items, isLoading, isError } = useSearchItems(query);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Search for an item (e.g. chicken breast)"
        value={query}
        onChangeText={setQuery}
      />

      {isLoading && <Text>Loading...</Text>}
      {isError && <Text>Something went wrong.</Text>}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <Text style={styles.itemName}>{item.name}</Text>
            {item.prices.map((price) => (
              <Text key={price.id}>
                ${price.price.toFixed(2)}/{price.unit} at {price.store}
              </Text>
            ))}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 60 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  itemCard: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  itemName: { fontWeight: 'bold', marginBottom: 4 },
});
