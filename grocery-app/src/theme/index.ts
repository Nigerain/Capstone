import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  background: '#F2F0EF', // screen + header + tab bar
  border: '#F0E9E9', // header/tab bar edges, active tab
  card: '#D9D9D9', // gray cards (categories, results)
  field: '#FAFAFA', // inputs, search bar
  imageBox: '#FCFBFB', // white box behind product images
  surface: '#FFFFFF', // suggestion panel, icon circles
  text: '#000000',
  textSecondary: '#716B6B', // "Key Food · 0.4 mi"
  textMuted: '#8C8787', // placeholders, "0.4 mi"
  textBody: '#676464', // Inter subtitles
  link: '#81B16A', // "See all", "Clear"
  positive: '#799F56', // price drop %, store line
  badge: '#77B75D', // BEST badge
  dark: '#1F1E1E', // Submit / Add a Price buttons
  darkButton: '#1D1919', // center + button
  onDark: '#FFFFFF',
} as const;

export const fonts = {
  heading: 'Fraunces_700Bold',
  semibold: 'WorkSans_600SemiBold',
  medium: 'WorkSans_500Medium',
  regular: 'WorkSans_400Regular',
  body: 'Inter_400Regular',
  badge: 'Unna_700Bold',
} as const;

export const typography = {
  heading: { fontFamily: fonts.heading, fontSize: 24, color: colors.text }, // "Browse categories"
  label: { fontFamily: fonts.heading, fontSize: 15, color: colors.text }, // form labels "Store", "Price"
  title: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text }, // category names
  cardTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text }, // product name, price
  meta: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }, // store · distance
  input: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  small: { fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary }, // unit price, %
  subtitle: { fontFamily: fonts.body, fontSize: 15, color: colors.textBody },
  link: { fontFamily: fonts.semibold, fontSize: 14, color: colors.link },
  badge: { fontFamily: fonts.badge, fontSize: 10, color: colors.onDark },
} satisfies Record<string, TextStyle>;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, gutter: 24 } as const;

export const radius = { image: 9, field: 11, card: 12, chip: 20, round: 999 } as const;

export const shadow: ViewStyle = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 4 },
  default: { elevation: 4 },
});