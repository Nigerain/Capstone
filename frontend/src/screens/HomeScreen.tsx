import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';

import { CategoryCard } from '../components/CategoryCard';
import { ProductCard } from '../components/ProductCard';
import { useHideTabBarOnScroll } from '../hooks/useHideTabBarOnScroll';
import { usePriceDrops } from '../hooks/usePriceDrops';
import { colors, spacing, typography } from '../theme';
import type { Category } from '../types/price';
import { formatDistance, formatSize, formatStoreLine } from '../utils/format';

// How many price drops to show on Home.
const MAX_DROPS = 3;

// Export each illustration from the Home Screen frame in Figma into
// assets/categories/, then uncomment its line. Until then a placeholder icon shows.
const CATEGORIES: { name: Category; image?: ImageSourcePropType }[] = [
  { name: 'Dairy' /* image: require('../../assets/categories/dairy.png') */ },
  { name: 'Meat' /* image: require('../../assets/categories/meat.png') */ },
  {
    name: 'Produce' /* image: require('../../assets/categories/produce.png') */,
  },
  { name: 'Pantry' /* image: require('../../assets/categories/pantry.png') */ },
  { name: 'Frozen' /* image: require('../../assets/categories/frozen.png') */ },
];

export function HomeScreen() {
  const navigation = useNavigation();
  const drops = usePriceDrops();
  const tabBarHeight = useBottomTabBarHeight();
  const hideTabBarOnScroll = useHideTabBarOnScroll();

  const renderDrops = () => {
    if (drops.isLoading) {
      return <Text style={typography.meta}>Loading…</Text>;
    }
    if (drops.isError) {
      return <Text style={typography.meta}>Couldn’t load price drops.</Text>;
    }
    if (!drops.data?.length) {
      return <Text style={typography.meta}>No price drops near you yet.</Text>;
    }

    return drops.data
      .slice(0, MAX_DROPS)
      .map(({ item, price, dropPercent }) => (
        <ProductCard
          key={price.id}
          variant="deal"
          name={[item.name, formatSize(item.size, item.sizeUnit)].filter(Boolean).join(', ')}
          price={price.price}
          store={formatStoreLine(price)}
          dropPercent={dropPercent}
          imageUri={item.imageUri}
          onPress={() =>
            navigation.navigate('ProductDetail', { itemId: item.id })
          }
        />
      ));
  };

  return (
    <ScrollView
      style={styles.screen}
      // Extra bottom space so the last card isn't hidden behind the tab bar.
      contentContainerStyle={[
        styles.content,
        { paddingBottom: tabBarHeight + spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
      {...hideTabBarOnScroll}
    >
      <Text style={typography.heading}>Browse categories</Text>
      <View style={styles.list}>
        {CATEGORIES.map(({ name, image }) => (
          <CategoryCard
            key={name}
            name={name}
            image={image}
            // TODO: open a category results screen once it's designed.
            onPress={() => navigation.navigate('Tabs', { screen: 'Search' })}
          />
        ))}
      </View>

      <Text style={[typography.heading, styles.sectionGap]}>
        Price drops near you
      </Text>
      <View style={styles.list}>{renderDrops()}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.lg,
  },
  list: { gap: 13, marginTop: spacing.md },
  sectionGap: { marginTop: spacing.xl },
});
