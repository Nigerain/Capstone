import { Text } from 'react-native';

import { Screen } from '../components/Screen';
import { typography } from '../theme';

export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <Screen>
      <Text style={typography.heading}>{title}</Text>
      <Text style={typography.subtitle}>Coming soon</Text>
    </Screen>
  );
}
